import { z } from 'zod'

/**
 * Zod schemas for Yandex Webmaster API v4 responses. Fields are lenient
 * (optional, unknown keys stripped) so the server keeps working if the API adds
 * or reshapes fields.
 */

/** GET /v4/user — resolves the numeric user id the host paths are scoped to. */
export const UserSchema = z.object({
    user_id: z.number(),
})
export type User = z.infer<typeof UserSchema>

const MirrorSchema = z.object({
    host_id: z.string().nullish(),
    ascii_host_url: z.string().nullish(),
    unicode_host_url: z.string().nullish(),
})

/** One host entry from GET /v4/user/{user}/hosts. */
export const HostSchema = z.object({
    host_id: z.string(),
    ascii_host_url: z.string().nullish(),
    unicode_host_url: z.string().nullish(),
    verified: z.boolean().nullish(),
    // Yandex returns null (not an absent key) for hosts without a main mirror.
    main_mirror: MirrorSchema.nullish(),
})
export type Host = z.infer<typeof HostSchema>

export const HostListSchema = z.object({
    hosts: z.array(HostSchema).default([]),
})
export type HostList = z.infer<typeof HostListSchema>

/** GET /v4/user/{user}/hosts/{host}/summary — SQI, page counts, problems. */
export const HostSummarySchema = z.object({
    sqi: z.number().optional(),
    searchable_pages_count: z.number().optional(),
    excluded_pages_count: z.number().optional(),
    site_problems: z.record(z.string(), z.unknown()).optional(),
})
export type HostSummary = z.infer<typeof HostSummarySchema>

/** The four indicators the search-queries endpoints report. */
export const QUERY_INDICATORS = [
    'TOTAL_SHOWS',
    'TOTAL_CLICKS',
    'AVG_SHOW_POSITION',
    'AVG_CLICK_POSITION',
] as const

/** Device buckets accepted by the search-queries endpoints. */
export const DEVICE_TYPES = [
    'ALL',
    'DESKTOP',
    'MOBILE',
    'TABLET',
    'MOBILE_AND_TABLET',
] as const

/** GET .../search-queries/popular — a ranked list; indicators are scalars. */
export const PopularQueriesSchema = z.object({
    queries: z
        .array(
            z.object({
                query_id: z.string().nullish(),
                query_text: z.string().nullish(),
                indicators: z
                    .record(z.string(), z.number().nullable())
                    .default({}),
            }),
        )
        .default([]),
    date_from: z.string().nullish(),
    date_to: z.string().nullish(),
    count: z.number().nullish(),
})
export type PopularQueries = z.infer<typeof PopularQueriesSchema>

const TimeSeriesSchema = z.array(
    z.object({ date: z.string(), value: z.number().nullable() }),
)

/** GET .../search-queries/all/history — indicators as time series. */
export const AllQueriesHistorySchema = z.object({
    indicators: z.record(z.string(), TimeSeriesSchema).default({}),
})
export type AllQueriesHistory = z.infer<typeof AllQueriesHistorySchema>

/**
 * GET .../search-queries/{query-id}/history — one query, indicators as series.
 * The API returns the query object at the top level (no `queries` wrapper).
 */
export const QueryHistorySchema = z.object({
    query_id: z.string().nullish(),
    query_text: z.string().nullish(),
    indicators: z.record(z.string(), TimeSeriesSchema).default({}),
})
export type QueryHistory = z.infer<typeof QueryHistorySchema>

/** GET .../diagnostics — problems keyed by type; severity/state per problem. */
export const DiagnosticsSchema = z.object({
    problems: z
        .record(
            z.string(),
            z.object({
                severity: z.string().nullish(),
                state: z.string().nullish(),
                last_state_update: z.string().nullish(),
            }),
        )
        .default({}),
})
export type Diagnostics = z.infer<typeof DiagnosticsSchema>

/** One Sitemap file from GET .../sitemaps. */
export const SitemapSchema = z.object({
    sitemap_id: z.string().nullish(),
    sitemap_url: z.string().nullish(),
    last_access_date: z.string().nullish(),
    errors_count: z.number().nullish(),
    urls_count: z.number().nullish(),
    children_count: z.number().nullish(),
    sitemap_type: z.string().nullish(),
    sources: z.array(z.unknown()).nullish(),
})
export const SitemapsSchema = z.object({
    sitemaps: z.array(SitemapSchema).default([]),
})
export type Sitemaps = z.infer<typeof SitemapsSchema>

/** GET .../indexing/history — crawled pages per HTTP status, as time series. */
export const IndexingHistorySchema = z.object({
    indicators: z.record(z.string(), TimeSeriesSchema).default({}),
})
export type IndexingHistory = z.infer<typeof IndexingHistorySchema>

/** GET .../indexing/samples — example crawled pages with HTTP codes. */
export const IndexingSamplesSchema = z.object({
    count: z.number().nullish(),
    samples: z
        .array(
            z.object({
                status: z.string().nullish(),
                http_code: z.number().nullish(),
                url: z.string().nullish(),
                access_date: z.string().nullish(),
            }),
        )
        .default([]),
})
export type IndexingSamples = z.infer<typeof IndexingSamplesSchema>

/** GET .../search-urls/in-search/samples — example pages currently in search. */
export const InSearchSamplesSchema = z.object({
    count: z.number().nullish(),
    samples: z
        .array(
            z.object({
                url: z.string().nullish(),
                title: z.string().nullish(),
                last_access: z.string().nullish(),
            }),
        )
        .default([]),
})
export type InSearchSamples = z.infer<typeof InSearchSamplesSchema>

/** GET .../links/external/samples — example inbound links to the site. */
export const ExternalLinksSchema = z.object({
    count: z.number().nullish(),
    links: z
        .array(
            z.object({
                source_url: z.string().nullish(),
                destination_url: z.string().nullish(),
                discovery_date: z.string().nullish(),
                source_last_access_date: z.string().nullish(),
            }),
        )
        .default([]),
})
export type ExternalLinks = z.infer<typeof ExternalLinksSchema>

/** GET .../links/external/history — external-link counts over time. */
export const ExternalLinksHistorySchema = z.object({
    indicators: z.record(z.string(), TimeSeriesSchema).default({}),
})
export type ExternalLinksHistory = z.infer<typeof ExternalLinksHistorySchema>

/** GET .../recrawl/quota — daily recrawl allowance and how much remains. */
export const RecrawlQuotaSchema = z.object({
    daily_quota: z.number().nullish(),
    quota_remainder: z.number().nullish(),
})
export type RecrawlQuota = z.infer<typeof RecrawlQuotaSchema>

/** POST .../recrawl/queue — response after queuing a URL for recrawl. */
export const RecrawlSubmitSchema = z.object({
    task_id: z.string().nullish(),
    quota_remainder: z.number().nullish(),
})
export type RecrawlSubmit = z.infer<typeof RecrawlSubmitSchema>

/** One recrawl task; state is IN_PROGRESS | DONE | FAILED. */
export const RecrawlTaskSchema = z.object({
    task_id: z.string().nullish(),
    url: z.string().nullish(),
    added_time: z.string().nullish(),
    state: z.string().nullish(),
})
export type RecrawlTask = z.infer<typeof RecrawlTaskSchema>

/** GET .../recrawl/queue — list of recrawl tasks (no count field). */
export const RecrawlTaskListSchema = z.object({
    tasks: z.array(RecrawlTaskSchema).default([]),
})
export type RecrawlTaskList = z.infer<typeof RecrawlTaskListSchema>
