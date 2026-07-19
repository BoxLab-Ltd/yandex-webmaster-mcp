/**
 * Quick local smoke against the real Yandex Webmaster API — no MCP client needed.
 *
 *   bun run try            # after `bun run auth`
 *   YANDEX_WEBMASTER_TOKEN=<token> bun run try [hostId]
 *
 * Resolves your user id, lists the hosts your credentials can see, then (for the
 * chosen host, if any) its summary. Reuses the same auth + client code the
 * server uses, so a green run means the server itself will work too.
 */
import { WebmasterClient } from '../src/api/client.js'
import { getHostSummary, getUserId, listHosts } from '../src/api/webmaster.js'
import { resolveTokenProvider } from '../src/auth/resolve.js'
import { loadConfig } from '../src/config.js'

async function main(): Promise<void> {
    const config = loadConfig()
    const { provider, mode } = resolveTokenProvider(config)
    console.log(`auth source: ${mode}\n`)

    const client = new WebmasterClient({
        baseUrl: config.baseUrl,
        getToken: () => provider.getAccessToken(),
        onUnauthorized: rejected => provider.forceRefresh(rejected),
        canRefresh: () => provider.canRefresh(),
        userAgent: config.userAgent,
        maxConcurrency: config.maxConcurrency,
        requestTimeoutMs: config.requestTimeoutMs,
    })

    const userId = await getUserId(client)
    console.log(`user_id: ${userId}\n`)

    const hosts = await listHosts(client, userId)
    console.log(`hosts (${hosts.length}):`)
    for (const h of hosts) {
        const url = h.unicode_host_url ?? h.ascii_host_url ?? ''
        console.log(`  ${h.host_id}  ${url}  verified=${h.verified ?? '?'}`)
    }
    if (hosts.length === 0) {
        console.log(
            '  (none — is this account added to any site in Webmaster?)',
        )
    }

    const hostId = process.argv[2] ?? config.defaultHostId
    if (hostId) {
        console.log(`\nsummary for ${hostId}:`)
        console.log(
            JSON.stringify(
                await getHostSummary(client, userId, hostId),
                null,
                2,
            ),
        )
    }
}

main().catch((err: unknown) => {
    console.error('try failed:', err instanceof Error ? err.message : err)
    process.exit(1)
})
