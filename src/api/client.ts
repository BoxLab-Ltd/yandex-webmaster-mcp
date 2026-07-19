import { errorFromResponse, WebmasterApiError } from './errors.js'

/** Query parameter values accepted by the client; arrays become CSV. */
export type QueryParams = Record<
    string,
    string | number | boolean | Array<string | number> | undefined
>

export interface WebmasterClientOptions {
    baseUrl: string
    /** Supplies the current access token; awaited on every request. */
    getToken: () => Promise<string>
    /**
     * Optional hook invoked once when a request fails with 401/invalid token,
     * before a single retry — lets a token provider refresh reactively. Gets the
     * token that was rejected; resolves to a fresh token to retry with.
     */
    onUnauthorized?: (rejectedToken: string) => Promise<string>
    /** Whether a reactive refresh could ever yield a different token. */
    canRefresh?: () => boolean
    userAgent: string
    /** Max in-flight requests to the Webmaster API. */
    maxConcurrency: number
    requestTimeoutMs: number
    /** Injectable for tests. Defaults to global `fetch`. */
    fetchImpl?: typeof fetch
    /** Injectable for tests so backoff does not sleep for real. */
    sleep?: (ms: number) => Promise<void>
    maxRetries?: number
    baseRetryDelayMs?: number
    maxRetryDelayMs?: number
}

const DEFAULT_MAX_RETRIES = 4
const DEFAULT_BASE_RETRY_DELAY_MS = 500
const DEFAULT_MAX_RETRY_DELAY_MS = 30_000

/** A tiny FIFO semaphore that bounds concurrency to `max`. */
export class Semaphore {
    private active = 0
    private readonly waiters: Array<() => void> = []

    constructor(private readonly max: number) {}

    async acquire(): Promise<() => void> {
        await new Promise<void>(resolve => {
            if (this.active < this.max) {
                this.active += 1
                resolve()
            } else {
                this.waiters.push(() => {
                    this.active += 1
                    resolve()
                })
            }
        })

        let released = false
        return () => {
            if (released) return
            released = true
            this.active -= 1
            const next = this.waiters.shift()
            if (next) next()
        }
    }
}

function buildQuery(params: QueryParams): URLSearchParams {
    const sp = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue
        if (Array.isArray(value)) {
            // Webmaster multi-value params (e.g. query_indicator) are repeated
            // keys, not a CSV value.
            for (const v of value) sp.append(key, String(v))
        } else {
            sp.set(key, String(value))
        }
    }
    return sp
}

type HttpMethod = 'GET' | 'POST' | 'DELETE'

export interface RequestOptions {
    method?: HttpMethod
    params?: QueryParams
    /** JSON body for POST requests (e.g. submitting a URL for recrawl). */
    body?: unknown
}

/**
 * Framework-agnostic HTTP client for the Yandex Webmaster API. Knows nothing
 * about MCP. Handles auth, concurrency, timeouts, and retry/backoff. Returns
 * parsed JSON so callers validate/parse shape themselves.
 */
export class WebmasterClient {
    private readonly semaphore: Semaphore
    private readonly fetchImpl: typeof fetch
    private readonly sleep: (ms: number) => Promise<void>
    private readonly maxRetries: number
    private readonly baseRetryDelayMs: number
    private readonly maxRetryDelayMs: number

    constructor(private readonly options: WebmasterClientOptions) {
        this.semaphore = new Semaphore(options.maxConcurrency)
        this.fetchImpl = options.fetchImpl ?? fetch
        this.sleep =
            options.sleep ?? (ms => new Promise(r => setTimeout(r, ms)))
        this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
        this.baseRetryDelayMs =
            options.baseRetryDelayMs ?? DEFAULT_BASE_RETRY_DELAY_MS
        this.maxRetryDelayMs =
            options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS
    }

    /** GET `path` with `params`, returning parsed JSON (caller validates shape). */
    async request(path: string, params: QueryParams = {}): Promise<unknown> {
        return this.requestJson(path, { params })
    }

    /** Request `path` (GET/POST/DELETE) returning parsed JSON. */
    async requestJson(
        path: string,
        opts: RequestOptions = {},
    ): Promise<unknown> {
        const { status, text } = await this.send(path, opts.params ?? {}, {
            method: opts.method ?? 'GET',
            body: opts.body,
        })
        return this.parseJson(status, text)
    }

    private parseJson(status: number, text: string): unknown {
        // An empty 2xx body (e.g. a DELETE that returns 204) is "no content",
        // not malformed — surface it as null for callers to handle.
        if (text.trim() === '') return null
        try {
            return JSON.parse(text) as unknown
        } catch {
            throw new WebmasterApiError(
                status,
                'Webmaster API returned a non-JSON response',
            )
        }
    }

    private async send(
        path: string,
        params: QueryParams,
        opts: { method: HttpMethod; body?: unknown },
    ): Promise<{ status: number; text: string }> {
        const query = buildQuery(params).toString()
        const url = `${this.options.baseUrl}${path}${query ? `?${query}` : ''}`
        const release = await this.semaphore.acquire()
        try {
            return await this.withRetry(url, opts)
        } finally {
            release()
        }
    }

    private async withRetry(
        url: string,
        opts: { method: HttpMethod; body?: unknown },
    ): Promise<{ status: number; text: string }> {
        let attempt = 0
        let authRetried = false
        // Records the token doFetch actually sent, so a reactive refresh can
        // tell the provider which token was rejected.
        const sent = { token: '' }
        for (;;) {
            try {
                return await this.doFetch(url, sent, opts)
            } catch (err) {
                // Reactive auth refresh: on a 401/invalid token, refresh once
                // and retry immediately before falling back to normal backoff.
                // Skip when no provider can yield a different token (e.g. a
                // static token) — the retry would be guaranteed to fail.
                const canRefresh = this.options.canRefresh?.() ?? true
                if (
                    !authRetried &&
                    canRefresh &&
                    this.options.onUnauthorized &&
                    err instanceof WebmasterApiError &&
                    err.isUnauthorized
                ) {
                    authRetried = true
                    try {
                        await this.options.onUnauthorized(sent.token)
                    } catch {
                        // A refresh failure must not mask the original 401 —
                        // surface the API error the caller actually got.
                        throw err
                    }
                    continue
                }
                const retryable =
                    err instanceof WebmasterApiError ? err.isRetryable : true
                if (!retryable || attempt >= this.maxRetries) throw err
                await this.sleep(this.backoffDelay(attempt))
                attempt += 1
            }
        }
    }

    private backoffDelay(attempt: number): number {
        const exp = this.baseRetryDelayMs * 2 ** attempt
        const jitter = exp * 0.25 * Math.random()
        return Math.min(exp + jitter, this.maxRetryDelayMs)
    }

    private async doFetch(
        url: string,
        sent: { token: string },
        opts: { method: HttpMethod; body?: unknown },
    ): Promise<{ status: number; text: string }> {
        const token = await this.options.getToken()
        sent.token = token
        const controller = new AbortController()
        const timer = setTimeout(
            () => controller.abort(),
            this.options.requestTimeoutMs,
        )

        const headers: Record<string, string> = {
            Authorization: `OAuth ${token}`,
            'User-Agent': this.options.userAgent,
            Accept: 'application/json',
        }
        const hasBody = opts.body !== undefined
        if (hasBody) headers['Content-Type'] = 'application/json'

        let res: Response
        let text: string
        try {
            res = await this.fetchImpl(url, {
                method: opts.method,
                headers,
                body: hasBody ? JSON.stringify(opts.body) : undefined,
                signal: controller.signal,
            })
            // Read the body inside the timer scope so a stalled body is aborted too.
            text = await res.text()
        } catch (err) {
            // Map transport-level failures to a WebmasterApiError (status 0) so
            // the retry layer and the MCP error formatter can branch on them
            // instead of seeing an opaque, unactionable raw error.
            if (err instanceof WebmasterApiError) throw err
            if (err instanceof Error && err.name === 'AbortError') {
                throw new WebmasterApiError(
                    0,
                    `Request to Webmaster API timed out after ${this.options.requestTimeoutMs}ms`,
                    ['timeout'],
                )
            }
            const detail = err instanceof Error ? err.message : String(err)
            throw new WebmasterApiError(
                0,
                `Network error reaching the Webmaster API: ${detail}`,
                ['network_error'],
            )
        } finally {
            clearTimeout(timer)
        }

        if (!res.ok) {
            throw errorFromResponse(res.status, text)
        }
        return { status: res.status, text }
    }
}
