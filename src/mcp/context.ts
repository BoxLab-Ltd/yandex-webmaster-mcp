import type { WebmasterClient } from '../api/client.js'
import type { Config } from '../config.js'

/** Everything a tool handler needs: the API client, config, and user id. */
export interface ToolContext {
    client: WebmasterClient
    config: Config
    /** Resolve the numeric user id (cached after the first call). */
    getUserId(): Promise<number>
}

/**
 * Resolve the host id from a tool argument, falling back to the configured
 * default. Throws a clear, actionable error when neither is available.
 */
export function resolveHostId(
    hostId: string | undefined,
    config: Config,
): string {
    const resolved = hostId ?? config.defaultHostId
    if (resolved === undefined) {
        throw new Error(
            'No host id provided. Pass `hostId`, or set YANDEX_WEBMASTER_HOST_ID to use a default. ' +
                'Call `get_hosts` to list the hosts available to your token and their ids.',
        )
    }
    return resolved
}
