/** Live smoke for Phase 2 endpoints. Run after `bun run auth`. */
import { WebmasterClient } from '../src/api/client.js'
import {
    getDiagnostics,
    getExternalLinks,
    getExternalLinksHistory,
    getIndexingHistory,
    getIndexingSamples,
    getInSearchSamples,
    getUserId,
    listSitemaps,
} from '../src/api/webmaster.js'
import { resolveTokenProvider } from '../src/auth/resolve.js'
import { loadConfig } from '../src/config.js'

const HOST = process.argv[2] ?? 'https:boxlab.io:443'

async function main(): Promise<void> {
    const config = loadConfig()
    const { provider } = resolveTokenProvider(config)
    const client = new WebmasterClient({
        baseUrl: config.baseUrl,
        getToken: () => provider.getAccessToken(),
        onUnauthorized: r => provider.forceRefresh(r),
        canRefresh: () => provider.canRefresh(),
        userAgent: config.userAgent,
        maxConcurrency: config.maxConcurrency,
        requestTimeoutMs: config.requestTimeoutMs,
    })
    const userId = await getUserId(client)

    const step = async (name: string, fn: () => Promise<unknown>) => {
        try {
            const r = await fn()
            console.log(`\n=== ${name} OK ===`)
            console.log(JSON.stringify(r, null, 2).slice(0, 900))
        } catch (e) {
            console.log(`\n=== ${name} FAILED ===`)
            console.log(e instanceof Error ? e.message : e)
        }
    }

    await step('diagnostics', () => getDiagnostics(client, userId, HOST))
    await step('sitemaps', () =>
        listSitemaps(client, userId, HOST, { limit: 5 }),
    )
    await step('indexing/history', () =>
        getIndexingHistory(client, userId, HOST),
    )
    await step('indexing/samples', () =>
        getIndexingSamples(client, userId, HOST, { limit: 3 }),
    )
    await step('in-search/samples', () =>
        getInSearchSamples(client, userId, HOST, { limit: 3 }),
    )
    await step('external/samples', () =>
        getExternalLinks(client, userId, HOST, { limit: 3 }),
    )
    await step('external/history', () =>
        getExternalLinksHistory(client, userId, HOST),
    )
}

main().catch((err: unknown) => {
    console.error('failed:', err instanceof Error ? err.message : err)
    process.exit(1)
})
