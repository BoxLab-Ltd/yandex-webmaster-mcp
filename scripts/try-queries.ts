/** Live smoke for the search-queries endpoints. Run after `bun run auth`. */
import { WebmasterClient } from '../src/api/client.js'
import {
    getAllQueriesHistory,
    getPopularQueries,
    getQueryHistory,
    getUserId,
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
        onUnauthorized: rejected => provider.forceRefresh(rejected),
        canRefresh: () => provider.canRefresh(),
        userAgent: config.userAgent,
        maxConcurrency: config.maxConcurrency,
        requestTimeoutMs: config.requestTimeoutMs,
    })
    const userId = await getUserId(client)
    const indicators = [
        'TOTAL_SHOWS',
        'TOTAL_CLICKS',
        'AVG_SHOW_POSITION',
        'AVG_CLICK_POSITION',
    ]

    console.log(`\n=== TOP (order_by=TOTAL_CLICKS) ${HOST} ===`)
    const top = await getPopularQueries(client, userId, HOST, {
        orderBy: 'TOTAL_CLICKS',
        indicators,
        limit: 5,
    })
    console.log(`count=${top.count} range=${top.date_from}..${top.date_to}`)
    for (const q of top.queries) {
        console.log(
            `  [${q.query_id}] "${q.query_text}"`,
            JSON.stringify(q.indicators),
        )
    }

    const firstId = top.queries[0]?.query_id
    if (firstId) {
        console.log(`\n=== TREND single query ${firstId} ===`)
        const q = await getQueryHistory(client, userId, HOST, firstId, {
            indicators: ['TOTAL_SHOWS', 'TOTAL_CLICKS'],
        })
        console.log(
            `"${q.query_text}" TOTAL_SHOWS points:`,
            q.indicators.TOTAL_SHOWS?.length ?? 0,
        )
        console.log(
            '  sample:',
            JSON.stringify(q.indicators.TOTAL_SHOWS?.slice(0, 3)),
        )
    }

    console.log(`\n=== TREND all queries ===`)
    const all = await getAllQueriesHistory(client, userId, HOST, {
        indicators: ['TOTAL_SHOWS', 'TOTAL_CLICKS'],
    })
    console.log('indicators:', Object.keys(all.indicators))
    console.log(
        '  TOTAL_SHOWS points:',
        all.indicators.TOTAL_SHOWS?.length ?? 0,
    )
    console.log(
        '  sample:',
        JSON.stringify(all.indicators.TOTAL_SHOWS?.slice(0, 3)),
    )
}

main().catch((err: unknown) => {
    console.error('failed:', err instanceof Error ? err.message : err)
    process.exit(1)
})
