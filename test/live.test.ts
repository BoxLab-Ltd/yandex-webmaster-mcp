import { resolveTokenProvider } from '@boxlab/yandex-mcp-core'
import { beforeAll, describe, expect, it } from 'bun:test'
import { WebmasterClient } from '../src/api/client.js'
import {
    getDiagnostics,
    getExternalLinks,
    getHostSummary,
    getIndexingHistory,
    getIndexingSamples,
    getInSearchSamples,
    getPopularQueries,
    getQueryHistory,
    getRecrawlQuota,
    getUserId,
    listHosts,
    listSitemaps,
} from '../src/api/webmaster.js'
import { loadAuthConfig, loadConfig } from '../src/config.js'

/**
 * Live end-to-end against the real Yandex Webmaster API — opt-in with `YW_LIVE=1`
 * (and a cached login or YANDEX_WEBMASTER_TOKEN). Skipped by default and in CI, so
 * `bun test` stays fast and offline. Run it with `YW_LIVE=1 bun test`.
 *
 * Read-only: it never calls recrawl_submit, so it does not consume the recrawl
 * quota. Auth is resolved in `beforeAll` (not at suite-body level) so a skipped
 * run never touches credentials — `bun` executes a `describe.skip` body but not
 * its hooks.
 */
const LIVE = process.env.YW_LIVE === '1'
const suite = LIVE ? describe : describe.skip

suite('live: Webmaster (read-only)', () => {
    let client: WebmasterClient
    let userId: number
    let hostId: string

    beforeAll(async () => {
        const config = loadConfig()
        const { provider } = resolveTokenProvider(loadAuthConfig())
        client = new WebmasterClient({
            baseUrl: config.baseUrl,
            getToken: () => provider.getAccessToken(),
            onUnauthorized: rejected => provider.forceRefresh(rejected),
            canRefresh: () => provider.canRefresh(),
            userAgent: config.userAgent,
            maxConcurrency: config.maxConcurrency,
            requestTimeoutMs: config.requestTimeoutMs,
        })
        userId = await getUserId(client)
        const hosts = await listHosts(client, userId)
        hostId = config.defaultHostId ?? hosts[0]?.host_id ?? ''
    })

    it('resolves the user id and lists verified hosts', async () => {
        expect(typeof userId).toBe('number')
        const hosts = await listHosts(client, userId)
        expect(Array.isArray(hosts)).toBe(true)
        for (const h of hosts) expect(typeof h.host_id).toBe('string')
    })

    it('fetches a host summary', async () => {
        if (!hostId) return // token sees no hosts
        const summary = await getHostSummary(client, userId, hostId)
        expect(typeof summary).toBe('object')
    })

    it('returns popular search queries and a single query history', async () => {
        if (!hostId) return
        const top = await getPopularQueries(client, userId, hostId, {
            orderBy: 'TOTAL_CLICKS',
            indicators: ['TOTAL_SHOWS', 'TOTAL_CLICKS'],
            limit: 5,
        })
        expect(Array.isArray(top.queries)).toBe(true)

        const queryId = top.queries[0]?.query_id
        if (queryId) {
            const history = await getQueryHistory(
                client,
                userId,
                hostId,
                queryId,
                { indicators: ['TOTAL_SHOWS'] },
            )
            expect(typeof history.indicators).toBe('object')
        }
    })

    it('returns indexing history and crawled samples', async () => {
        if (!hostId) return
        const history = await getIndexingHistory(client, userId, hostId, {})
        expect(typeof history.indicators).toBe('object')

        const samples = await getIndexingSamples(client, userId, hostId, {
            limit: 3,
        })
        expect(Array.isArray(samples.samples)).toBe(true)

        const inSearch = await getInSearchSamples(client, userId, hostId, {
            limit: 3,
        })
        expect(Array.isArray(inSearch.samples)).toBe(true)
    })

    it('returns diagnostics, sitemaps and external links', async () => {
        if (!hostId) return
        const diagnostics = await getDiagnostics(client, userId, hostId)
        expect(typeof diagnostics.problems).toBe('object')

        const sitemaps = await listSitemaps(client, userId, hostId, {
            limit: 5,
        })
        expect(Array.isArray(sitemaps.sitemaps)).toBe(true)

        const links = await getExternalLinks(client, userId, hostId, {
            limit: 3,
        })
        expect(Array.isArray(links.links)).toBe(true)
    })

    it('reads the recrawl quota (read-only)', async () => {
        if (!hostId) return
        const quota = await getRecrawlQuota(client, userId, hostId)
        expect(typeof quota).toBe('object')
    })
})
