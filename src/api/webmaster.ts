import type { WebmasterClient } from './client.js'
import {
    AllQueriesHistorySchema,
    DiagnosticsSchema,
    ExternalLinksHistorySchema,
    ExternalLinksSchema,
    HostListSchema,
    HostSummarySchema,
    IndexingHistorySchema,
    IndexingSamplesSchema,
    InSearchSamplesSchema,
    PopularQueriesSchema,
    QueryHistorySchema,
    RecrawlQuotaSchema,
    RecrawlSubmitSchema,
    RecrawlTaskListSchema,
    RecrawlTaskSchema,
    SitemapsSchema,
    UserSchema,
    type AllQueriesHistory,
    type Diagnostics,
    type ExternalLinks,
    type ExternalLinksHistory,
    type Host,
    type HostSummary,
    type IndexingHistory,
    type IndexingSamples,
    type InSearchSamples,
    type PopularQueries,
    type QueryHistory,
    type RecrawlQuota,
    type RecrawlSubmit,
    type RecrawlTask,
    type RecrawlTaskList,
    type Sitemaps,
} from './schemas.js'

/** Shared shape for the search-queries endpoints. */
export interface QueryStatsParams {
    indicators?: string[]
    deviceType?: string
    dateFrom?: string
    dateTo?: string
}

function hostPath(userId: number, hostId: string): string {
    return `/v4/user/${userId}/hosts/${encodeURIComponent(hostId)}`
}

/** Resolve the numeric user id every host-scoped path is built from. */
export async function getUserId(client: WebmasterClient): Promise<number> {
    const raw = await client.request('/v4/user')
    return UserSchema.parse(raw).user_id
}

/** List the hosts (sites) the token can see, with their verification state. */
export async function listHosts(
    client: WebmasterClient,
    userId: number,
): Promise<Host[]> {
    const raw = await client.request(`/v4/user/${userId}/hosts`)
    return HostListSchema.parse(raw).hosts
}

/** Fetch a host's summary: SQI, indexed/excluded page counts, site problems. */
export async function getHostSummary(
    client: WebmasterClient,
    userId: number,
    hostId: string,
): Promise<HostSummary> {
    const raw = await client.request(`${hostPath(userId, hostId)}/summary`)
    return HostSummarySchema.parse(raw)
}

/** Ranked list of the site's most popular search queries with scalar indicators. */
export async function getPopularQueries(
    client: WebmasterClient,
    userId: number,
    hostId: string,
    params: QueryStatsParams & {
        orderBy: string
        limit?: number
        offset?: number
    },
): Promise<PopularQueries> {
    const raw = await client.request(
        `${hostPath(userId, hostId)}/search-queries/popular`,
        {
            order_by: params.orderBy,
            query_indicator: params.indicators,
            device_type_indicator: params.deviceType,
            date_from: params.dateFrom,
            date_to: params.dateTo,
            limit: params.limit,
            offset: params.offset,
        },
    )
    return PopularQueriesSchema.parse(raw)
}

/** Aggregate time series across ALL of the site's search queries. */
export async function getAllQueriesHistory(
    client: WebmasterClient,
    userId: number,
    hostId: string,
    params: QueryStatsParams,
): Promise<AllQueriesHistory> {
    const raw = await client.request(
        `${hostPath(userId, hostId)}/search-queries/all/history`,
        {
            query_indicator: params.indicators,
            device_type_indicator: params.deviceType,
            date_from: params.dateFrom,
            date_to: params.dateTo,
        },
    )
    return AllQueriesHistorySchema.parse(raw)
}

/** Time series for a single search query, identified by its query_id. */
export async function getQueryHistory(
    client: WebmasterClient,
    userId: number,
    hostId: string,
    queryId: string,
    params: QueryStatsParams,
): Promise<QueryHistory> {
    const raw = await client.request(
        `${hostPath(userId, hostId)}/search-queries/${encodeURIComponent(queryId)}/history`,
        {
            query_indicator: params.indicators,
            device_type_indicator: params.deviceType,
            date_from: params.dateFrom,
            date_to: params.dateTo,
        },
    )
    return QueryHistorySchema.parse(raw)
}

/** Site diagnostics: detected problems keyed by type, with severity and state. */
export async function getDiagnostics(
    client: WebmasterClient,
    userId: number,
    hostId: string,
): Promise<Diagnostics> {
    const raw = await client.request(`${hostPath(userId, hostId)}/diagnostics`)
    return DiagnosticsSchema.parse(raw)
}

/** List the site's Sitemap files with their status and error/URL counts. */
export async function listSitemaps(
    client: WebmasterClient,
    userId: number,
    hostId: string,
    params: { limit?: number; from?: string; parentId?: string } = {},
): Promise<Sitemaps> {
    const raw = await client.request(`${hostPath(userId, hostId)}/sitemaps`, {
        limit: params.limit,
        from: params.from,
        parent_id: params.parentId,
    })
    return SitemapsSchema.parse(raw)
}

/** Indexing history: crawled pages per HTTP status class, as time series. */
export async function getIndexingHistory(
    client: WebmasterClient,
    userId: number,
    hostId: string,
    params: { dateFrom?: string; dateTo?: string } = {},
): Promise<IndexingHistory> {
    const raw = await client.request(
        `${hostPath(userId, hostId)}/indexing/history`,
        { date_from: params.dateFrom, date_to: params.dateTo },
    )
    return IndexingHistorySchema.parse(raw)
}

/** Example crawled pages with their HTTP codes. */
export async function getIndexingSamples(
    client: WebmasterClient,
    userId: number,
    hostId: string,
    params: { offset?: number; limit?: number } = {},
): Promise<IndexingSamples> {
    const raw = await client.request(
        `${hostPath(userId, hostId)}/indexing/samples`,
        { offset: params.offset, limit: params.limit },
    )
    return IndexingSamplesSchema.parse(raw)
}

/** Example pages currently present in Yandex search. */
export async function getInSearchSamples(
    client: WebmasterClient,
    userId: number,
    hostId: string,
    params: { offset?: number; limit?: number } = {},
): Promise<InSearchSamples> {
    const raw = await client.request(
        `${hostPath(userId, hostId)}/search-urls/in-search/samples`,
        { offset: params.offset, limit: params.limit },
    )
    return InSearchSamplesSchema.parse(raw)
}

/** Example inbound (external) links to the site. */
export async function getExternalLinks(
    client: WebmasterClient,
    userId: number,
    hostId: string,
    params: { offset?: number; limit?: number } = {},
): Promise<ExternalLinks> {
    const raw = await client.request(
        `${hostPath(userId, hostId)}/links/external/samples`,
        { offset: params.offset, limit: params.limit },
    )
    return ExternalLinksSchema.parse(raw)
}

/** History of the total external-link count over time. */
export async function getExternalLinksHistory(
    client: WebmasterClient,
    userId: number,
    hostId: string,
): Promise<ExternalLinksHistory> {
    const raw = await client.request(
        `${hostPath(userId, hostId)}/links/external/history`,
    )
    return ExternalLinksHistorySchema.parse(raw)
}

/** Remaining daily recrawl quota for the host. */
export async function getRecrawlQuota(
    client: WebmasterClient,
    userId: number,
    hostId: string,
): Promise<RecrawlQuota> {
    const raw = await client.request(
        `${hostPath(userId, hostId)}/recrawl/quota`,
    )
    return RecrawlQuotaSchema.parse(raw)
}

/** Queue a URL for recrawl. Consumes one unit of the daily quota. */
export async function submitRecrawl(
    client: WebmasterClient,
    userId: number,
    hostId: string,
    url: string,
): Promise<RecrawlSubmit> {
    const raw = await client.requestJson(
        `${hostPath(userId, hostId)}/recrawl/queue`,
        { method: 'POST', body: { url } },
    )
    return RecrawlSubmitSchema.parse(raw)
}

/** List recrawl tasks for the host. */
export async function listRecrawlTasks(
    client: WebmasterClient,
    userId: number,
    hostId: string,
    params: {
        offset?: number
        limit?: number
        dateFrom?: string
        dateTo?: string
    } = {},
): Promise<RecrawlTaskList> {
    const raw = await client.request(
        `${hostPath(userId, hostId)}/recrawl/queue`,
        {
            offset: params.offset,
            limit: params.limit,
            date_from: params.dateFrom,
            date_to: params.dateTo,
        },
    )
    return RecrawlTaskListSchema.parse(raw)
}

/** Status of a single recrawl task by its id. */
export async function getRecrawlTask(
    client: WebmasterClient,
    userId: number,
    hostId: string,
    taskId: string,
): Promise<RecrawlTask> {
    const raw = await client.request(
        `${hostPath(userId, hostId)}/recrawl/queue/${encodeURIComponent(taskId)}`,
    )
    return RecrawlTaskSchema.parse(raw)
}
