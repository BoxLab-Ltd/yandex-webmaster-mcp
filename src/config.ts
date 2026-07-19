import { createRequire } from 'node:module'
import { z } from 'zod'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { name: string; version: string }

export const SERVER_NAME = pkg.name
export const SERVER_VERSION = pkg.version

/**
 * Built-in public OAuth client for the `auth` flow, so users don't have to
 * register their own Yandex app. It is a PUBLIC client: only the client_id ships
 * (no secret). PKCE authenticates the exchange; the long-lived token means
 * refresh (which would need a secret) isn't required. Override with
 * YANDEX_OAUTH_CLIENT_ID to use your own app (set YANDEX_OAUTH_CLIENT_SECRET too
 * to enable refresh). The app is registered with the `webmaster:hostinfo` and
 * `webmaster:verify` scopes.
 */
export const EMBEDDED_OAUTH_CLIENT_ID = '8cae2852e92d47ab80fd3d37799ca853'

/**
 * Resolved, validated runtime configuration for the server.
 *
 * Everything is sourced from environment variables so the server stays
 * stateless and secret-free on disk. See `.env.example` for the contract.
 */
export interface Config {
    /** Static Yandex Webmaster OAuth token (alternative to the `auth` login). */
    readonly token?: string
    /** OAuth client id used by `auth` — the embedded public client, or an override. */
    readonly oauthClientId: string
    /** True when using the user's own app (env override) rather than the embedded one. */
    readonly oauthIsCustomApp: boolean
    /** OAuth client secret (only for a user's own app; enables token refresh). */
    readonly oauthClientSecret?: string
    /** Yandex ID OAuth base URL. */
    readonly oauthBaseUrl: string
    /** Optional default host id used when a tool call omits `hostId`. */
    readonly defaultHostId?: string
    /** API base URL (overridable only for tests/mocks). */
    readonly baseUrl: string
    /** Max concurrent in-flight requests to the Webmaster API. */
    readonly maxConcurrency: number
    /** Per-request timeout in milliseconds. */
    readonly requestTimeoutMs: number
    /** Default row limit applied to list tools when the caller omits one. */
    readonly defaultRowLimit: number
    /** Value sent in the `User-Agent` header. */
    readonly userAgent: string
}

const EnvSchema = z.object({
    YANDEX_WEBMASTER_TOKEN: z.string().min(1).optional(),
    YANDEX_OAUTH_CLIENT_ID: z.string().min(1).optional(),
    YANDEX_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
    YANDEX_OAUTH_BASE_URL: z.url().default('https://oauth.yandex.ru'),
    YANDEX_WEBMASTER_HOST_ID: z.string().min(1).optional(),
    YANDEX_WEBMASTER_BASE_URL: z
        .url()
        .default('https://api.webmaster.yandex.net'),
})

/** Internal, non-env-tunable defaults that callers rarely need to change. */
const MAX_CONCURRENCY = 4
const REQUEST_TIMEOUT_MS = 60_000
const DEFAULT_ROW_LIMIT = 100

/**
 * Load and validate configuration from the given environment (defaults to
 * `process.env`). Throws a single, human-readable error listing every problem.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
    const parsed = EnvSchema.safeParse(env)
    if (!parsed.success) {
        const issues = parsed.error.issues
            .map(i => `  - ${i.path.join('.')}: ${i.message}`)
            .join('\n')
        throw new Error(
            `Invalid Yandex Webmaster MCP configuration:\n${issues}`,
        )
    }

    const e = parsed.data
    const isCustomApp = e.YANDEX_OAUTH_CLIENT_ID !== undefined
    return {
        token: e.YANDEX_WEBMASTER_TOKEN,
        oauthClientId: e.YANDEX_OAUTH_CLIENT_ID ?? EMBEDDED_OAUTH_CLIENT_ID,
        oauthIsCustomApp: isCustomApp,
        oauthClientSecret: e.YANDEX_OAUTH_CLIENT_SECRET,
        oauthBaseUrl: e.YANDEX_OAUTH_BASE_URL,
        defaultHostId: e.YANDEX_WEBMASTER_HOST_ID,
        baseUrl: e.YANDEX_WEBMASTER_BASE_URL.replace(/\/+$/, ''),
        maxConcurrency: MAX_CONCURRENCY,
        requestTimeoutMs: REQUEST_TIMEOUT_MS,
        defaultRowLimit: DEFAULT_ROW_LIMIT,
        userAgent: `${SERVER_NAME}/${SERVER_VERSION}`,
    }
}
