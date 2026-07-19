import { z } from 'zod'

/**
 * Shape of a Yandex Webmaster API error body. The API returns
 * `{ error_code, error_message }`; we also accept a few defensive fallbacks so
 * drift in the error envelope never turns a real error into an opaque one.
 */
export const ApiErrorBodySchema = z.object({
    error_code: z.string().optional(),
    error_message: z.string().optional(),
    // Defensive fallbacks seen across Yandex APIs.
    code: z.union([z.number(), z.string()]).optional(),
    message: z.string().optional(),
    errors: z
        .array(
            z.object({
                error_type: z.string().optional(),
                message: z.string().optional(),
            }),
        )
        .optional(),
})

export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>

/**
 * An error returned by the Webmaster API (non-2xx response) or raised while
 * talking to it. Carries the HTTP status and the parsed `error_code`(s) so
 * callers and the retry layer can branch on them.
 */
export class WebmasterApiError extends Error {
    readonly status: number
    readonly errorTypes: string[]
    readonly body?: ApiErrorBody

    constructor(
        status: number,
        message: string,
        errorTypes: string[] = [],
        body?: ApiErrorBody,
    ) {
        super(message)
        this.name = 'WebmasterApiError'
        this.status = status
        this.errorTypes = errorTypes
        this.body = body
    }

    /** True when the API throttled us (rate/quota limit). */
    get isThrottled(): boolean {
        return (
            this.status === 429 ||
            this.status === 420 ||
            this.errorTypes.some(t => /QUOTA|LIMIT|TOO_MANY/i.test(t))
        )
    }

    /** Transient server-side conditions worth retrying. */
    get isRetryableServerError(): boolean {
        return this.status === 503 || this.status === 504
    }

    /**
     * Client-side transient failures (timeout/network) raised with status 0.
     * Retrying these can succeed, matching the behavior where a raw
     * AbortError/network error fell through to the retry layer.
     */
    get isTransientLocalError(): boolean {
        return (
            this.status === 0 ||
            this.errorTypes.includes('timeout') ||
            this.errorTypes.includes('network_error')
        )
    }

    /** Whether retrying this request could plausibly succeed. */
    get isRetryable(): boolean {
        return (
            this.isThrottled ||
            this.isRetryableServerError ||
            this.isTransientLocalError
        )
    }

    /** True when the token is invalid/expired (drives a reactive refresh). */
    get isUnauthorized(): boolean {
        return (
            this.status === 401 ||
            this.errorTypes.some(t => /INVALID_OAUTH|UNAUTHORIZED/i.test(t))
        )
    }
}

/** Build a WebmasterApiError from a non-2xx Response and its (maybe-JSON) body. */
export function errorFromResponse(
    status: number,
    rawBody: string,
): WebmasterApiError {
    let body: ApiErrorBody | undefined
    try {
        body = ApiErrorBodySchema.parse(JSON.parse(rawBody))
    } catch {
        body = undefined
    }
    const errorTypes = [
        body?.error_code,
        ...(body?.errors?.map(e => e.error_type) ?? []),
    ].filter((t): t is string => typeof t === 'string')
    const detail =
        body?.error_message ||
        body?.errors?.map(e => `${e.error_type}: ${e.message}`).join('; ') ||
        body?.message ||
        rawBody.slice(0, 500) ||
        'Unknown error'
    return new WebmasterApiError(
        status,
        `Webmaster API ${status}: ${detail}`,
        errorTypes,
        body,
    )
}
