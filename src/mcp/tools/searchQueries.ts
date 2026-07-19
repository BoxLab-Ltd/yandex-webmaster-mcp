import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
    getAllQueriesHistory,
    getPopularQueries,
    getQueryHistory,
} from '../../api/webmaster.js'
import { DEVICE_TYPES, QUERY_INDICATORS } from '../../api/schemas.js'
import { resolveHostId, type ToolContext } from '../context.js'
import { errorResult, toToolResult } from '../format.js'

export function registerSearchQueries(
    server: McpServer,
    ctx: ToolContext,
): void {
    server.registerTool(
        'search_queries',
        {
            title: 'Yandex search queries',
            description:
                'Search-query analytics for a host from Yandex Search: impressions (TOTAL_SHOWS), ' +
                'clicks (TOTAL_CLICKS), average show/click position. Read-only.\n' +
                '• report="top" (default): ranked list of the queries bringing the most traffic, ' +
                'ordered by orderBy. Use this to see which phrases people search.\n' +
                '• report="trend": a time series. Pass queryId (from a prior "top" call) for one ' +
                "query's history over time, or omit it for the site's aggregate trend.\n" +
                'Tip: cross-reference these queries/landing pages with Yandex Metrica (bounce rate, ' +
                'conversions) to find high-impression, low-conversion phrases worth optimizing.',
            inputSchema: {
                hostId: z
                    .string()
                    .optional()
                    .describe(
                        'Host id (e.g. "https:example.com:443"). Defaults to YANDEX_WEBMASTER_HOST_ID. ' +
                            'List valid ids with get_hosts.',
                    ),
                report: z
                    .enum(['top', 'trend'])
                    .optional()
                    .describe(
                        '"top" ranked list (default) or "trend" time series.',
                    ),
                indicators: z
                    .array(z.enum(QUERY_INDICATORS))
                    .optional()
                    .describe(
                        'Which indicators to return. Default: all four (TOTAL_SHOWS, TOTAL_CLICKS, ' +
                            'AVG_SHOW_POSITION, AVG_CLICK_POSITION).',
                    ),
                orderBy: z
                    .enum(['TOTAL_SHOWS', 'TOTAL_CLICKS'])
                    .optional()
                    .describe(
                        'report="top" only: rank by TOTAL_SHOWS or TOTAL_CLICKS. Default TOTAL_CLICKS.',
                    ),
                deviceType: z
                    .enum(DEVICE_TYPES)
                    .optional()
                    .describe('Device bucket. Default ALL.'),
                dateFrom: z
                    .string()
                    .optional()
                    .describe('Start date, YYYY-MM-DD. Default: last week.'),
                dateTo: z
                    .string()
                    .optional()
                    .describe('End date, YYYY-MM-DD. Default: today.'),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(500)
                    .optional()
                    .describe(
                        'report="top" only: rows to return (1-500). Default 50.',
                    ),
                offset: z
                    .number()
                    .int()
                    .min(0)
                    .optional()
                    .describe(
                        'report="top" only: rows to skip for paging. Default 0.',
                    ),
                queryId: z
                    .string()
                    .optional()
                    .describe(
                        'report="trend" only: return the time series for this specific query ' +
                            '(query_id from a prior "top" call). Omit for the aggregate trend.',
                    ),
            },
            annotations: {
                title: 'Yandex search queries',
                readOnlyHint: true,
                openWorldHint: true,
            },
        },
        async args => {
            try {
                const hostId = resolveHostId(args.hostId, ctx.config)
                const userId = await ctx.getUserId()
                const deviceType = args.deviceType
                const indicators = args.indicators ?? [...QUERY_INDICATORS]
                const shared = {
                    indicators,
                    deviceType,
                    dateFrom: args.dateFrom,
                    dateTo: args.dateTo,
                }

                if ((args.report ?? 'top') === 'trend') {
                    if (args.queryId) {
                        const q = await getQueryHistory(
                            ctx.client,
                            userId,
                            hostId,
                            args.queryId,
                            shared,
                        )
                        return toToolResult({
                            report: 'trend',
                            host_id: hostId,
                            device_type: deviceType ?? 'ALL',
                            query: {
                                query_id: q.query_id,
                                query_text: q.query_text,
                            },
                            indicators: q.indicators,
                        })
                    }
                    const res = await getAllQueriesHistory(
                        ctx.client,
                        userId,
                        hostId,
                        shared,
                    )
                    return toToolResult({
                        report: 'trend',
                        host_id: hostId,
                        scope: 'all_queries',
                        device_type: deviceType ?? 'ALL',
                        indicators: res.indicators,
                    })
                }

                const orderBy = args.orderBy ?? 'TOTAL_CLICKS'
                // Ensure the ranking indicator is fetched so its value is present.
                const topIndicators = Array.from(
                    new Set([...indicators, orderBy]),
                )
                const res = await getPopularQueries(
                    ctx.client,
                    userId,
                    hostId,
                    {
                        orderBy,
                        indicators: topIndicators,
                        deviceType,
                        dateFrom: args.dateFrom,
                        dateTo: args.dateTo,
                        limit: args.limit ?? 50,
                        offset: args.offset,
                    },
                )
                return toToolResult({
                    report: 'top',
                    host_id: hostId,
                    date_from: res.date_from ?? null,
                    date_to: res.date_to ?? null,
                    order_by: orderBy,
                    device_type: deviceType ?? 'ALL',
                    total_queries: res.count ?? null,
                    returned: res.queries.length,
                    queries: res.queries.map(q => ({
                        query_id: q.query_id,
                        query_text: q.query_text,
                        ...q.indicators,
                    })),
                })
            } catch (err) {
                return errorResult(err)
            }
        },
    )
}
