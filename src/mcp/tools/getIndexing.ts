import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
    getIndexingHistory,
    getIndexingSamples,
    getInSearchSamples,
} from '../../api/webmaster.js'
import { resolveHostId, type ToolContext } from '../context.js'
import { errorResult, toToolResult } from '../format.js'

export function registerGetIndexing(server: McpServer, ctx: ToolContext): void {
    server.registerTool(
        'get_indexing',
        {
            title: 'Site indexing',
            description:
                'How Yandex crawls and indexes the host. Read-only. Pick a report:\n' +
                '• report="history" (default): time series of crawled pages grouped by HTTP status class ' +
                '(HTTP_2XX/3XX/4XX/5XX/OTHER) — spot spikes of errors the crawler hits.\n' +
                '• report="crawled": example crawled URLs with their HTTP code and crawl date.\n' +
                '• report="in_search": example URLs currently present in Yandex search, with title.',
            inputSchema: {
                hostId: z
                    .string()
                    .optional()
                    .describe(
                        'Host id (e.g. "https:example.com:443"). Defaults to YANDEX_WEBMASTER_HOST_ID.',
                    ),
                report: z
                    .enum(['history', 'crawled', 'in_search'])
                    .optional()
                    .describe('Which report to return. Default "history".'),
                dateFrom: z
                    .string()
                    .optional()
                    .describe('report="history": start date YYYY-MM-DD.'),
                dateTo: z
                    .string()
                    .optional()
                    .describe('report="history": end date YYYY-MM-DD.'),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(100)
                    .optional()
                    .describe(
                        'samples reports: rows to return (1-100). Default 20.',
                    ),
                offset: z
                    .number()
                    .int()
                    .min(0)
                    .optional()
                    .describe(
                        'samples reports: rows to skip for paging. Default 0.',
                    ),
            },
            annotations: {
                title: 'Site indexing',
                readOnlyHint: true,
                openWorldHint: true,
            },
        },
        async args => {
            try {
                const hostId = resolveHostId(args.hostId, ctx.config)
                const userId = await ctx.getUserId()
                const report = args.report ?? 'history'

                if (report === 'crawled') {
                    const res = await getIndexingSamples(
                        ctx.client,
                        userId,
                        hostId,
                        { offset: args.offset, limit: args.limit ?? 20 },
                    )
                    return toToolResult({
                        report,
                        host_id: hostId,
                        total_available: res.count ?? null,
                        returned: res.samples.length,
                        samples: res.samples,
                    })
                }

                if (report === 'in_search') {
                    const res = await getInSearchSamples(
                        ctx.client,
                        userId,
                        hostId,
                        { offset: args.offset, limit: args.limit ?? 20 },
                    )
                    return toToolResult({
                        report,
                        host_id: hostId,
                        total_available: res.count ?? null,
                        returned: res.samples.length,
                        samples: res.samples,
                    })
                }

                const res = await getIndexingHistory(
                    ctx.client,
                    userId,
                    hostId,
                    {
                        dateFrom: args.dateFrom,
                        dateTo: args.dateTo,
                    },
                )
                return toToolResult({
                    report,
                    host_id: hostId,
                    indicators: res.indicators,
                })
            } catch (err) {
                return errorResult(err)
            }
        },
    )
}
