import { createRequire } from 'node:module'
import {
    cleanEnv,
    loadYandexAuthConfig,
    type YandexAuthConfig,
} from '@boxlab/yandex-mcp-core'
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
export const EMBEDDED_OAUTH_CLIENT_ID = '1b4119ec1d584be6af98767ec0761476'

/** OAuth scopes the Webmaster tools need: read stats + read/write verification. */
const SCOPE = 'webmaster:hostinfo webmaster:verify'

/**
 * Yandex ID OAuth host. `.ru` matches the redirect URI registered for the
 * built-in Webmaster app; oauth.yandex.ru and oauth.yandex.com share a backend.
 */
const OAUTH_BASE_URL = 'https://oauth.yandex.ru'

/**
 * Token-cache dir segment (kept as the unscoped name so the path stays
 * `~/.config/yandex-webmaster-mcp/token.json` even though the package is scoped).
 */
const APP_NAME = 'yandex-webmaster-mcp'

/**
 * Resolved, validated domain configuration for the server. Auth lives in a
 * separate {@link YandexAuthConfig} (see {@link loadAuthConfig}); everything
 * here is sourced from environment variables so the server stays stateless.
 */
export interface Config {
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
 * Load and validate domain configuration from the given environment (defaults
 * to `process.env`). Throws a single, human-readable error listing every
 * problem. Auth is loaded separately via {@link loadAuthConfig}.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
    const parsed = EnvSchema.safeParse(cleanEnv(env))
    if (!parsed.success) {
        const issues = parsed.error.issues
            .map(i => `  - ${i.path.join('.')}: ${i.message}`)
            .join('\n')
        throw new Error(
            `Invalid Yandex Webmaster MCP configuration:\n${issues}`,
        )
    }

    const e = parsed.data
    return {
        defaultHostId: e.YANDEX_WEBMASTER_HOST_ID,
        baseUrl: e.YANDEX_WEBMASTER_BASE_URL.replace(/\/+$/, ''),
        maxConcurrency: MAX_CONCURRENCY,
        requestTimeoutMs: REQUEST_TIMEOUT_MS,
        defaultRowLimit: DEFAULT_ROW_LIMIT,
        userAgent: `${SERVER_NAME}/${SERVER_VERSION}`,
    }
}

/**
 * Load this server's Yandex auth configuration: the Webmaster scopes, the
 * embedded public client (or a user's own app via `YANDEX_OAUTH_CLIENT_ID`),
 * and the static-token env `YANDEX_WEBMASTER_TOKEN` (+ its `_FILE` override).
 */
export function loadAuthConfig(
    env: NodeJS.ProcessEnv = process.env,
): YandexAuthConfig {
    return loadYandexAuthConfig(env, {
        scope: SCOPE,
        appName: APP_NAME,
        embeddedClientId: EMBEDDED_OAUTH_CLIENT_ID,
        staticTokenEnv: 'YANDEX_WEBMASTER_TOKEN',
        oauthBaseUrl: OAUTH_BASE_URL,
    })
}
