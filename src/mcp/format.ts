import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { WebmasterApiError } from '../api/errors.js'

/** Wrap a structured object as a successful tool result (text + structured). */
export function toToolResult(
    structured: Record<string, unknown>,
): CallToolResult {
    return {
        content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
        structuredContent: structured,
    }
}

/** A short, actionable next step for the model based on the API error kind. */
function recoveryHint(err: WebmasterApiError): string | undefined {
    if (err.isUnauthorized) {
        return (
            'The access token is invalid or expired. Re-authenticate by running ' +
            '`npx -y @boxlab/yandex-webmaster-mcp auth` (or set a fresh YANDEX_WEBMASTER_TOKEN).'
        )
    }
    // 403 is a missing grant on the host, NOT a stale token — re-auth won't help.
    if (err.status === 403) {
        return (
            'Access denied: the token lacks rights to this host. Verify the host in ' +
            'Yandex Webmaster with this account, or call a hostId you can read.'
        )
    }
    if (err.status === 404) {
        return 'Host or resource not found. Check the hostId — list valid ones with `get_hosts`.'
    }
    if (err.isThrottled) {
        return 'Rate/quota limit hit. Wait a bit and retry with fewer parallel calls.'
    }
    if (err.errorTypes.includes('timeout')) {
        return 'The request timed out. Narrow the date range or reduce the requested data, then retry.'
    }
    if (err.errorTypes.includes('network_error')) {
        return 'Network error reaching the Webmaster API. Check connectivity and retry.'
    }
    return undefined
}

/** Wrap an error as a tool result the model can read and recover from. */
export function errorResult(err: unknown): CallToolResult {
    if (err instanceof WebmasterApiError) {
        const hint = recoveryHint(err)
        const text = hint
            ? `Error: ${err.message}\n${hint}`
            : `Error: ${err.message}`
        return {
            content: [{ type: 'text', text }],
            structuredContent: {
                error: err.message,
                status: err.status,
                error_types: err.errorTypes,
                ...(hint ? { hint } : {}),
            },
            isError: true,
        }
    }
    const message = err instanceof Error ? err.message : String(err)
    return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
    }
}
