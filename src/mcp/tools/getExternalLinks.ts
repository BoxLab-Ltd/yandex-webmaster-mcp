import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
    getExternalLinks,
    getExternalLinksHistory,
} from '../../api/webmaster.js'
import { resolveHostId, type ToolContext } from '../context.js'
import { errorResult, toToolResult } from '../format.js'

export function registerGetExternalLinks(
    server: McpServer,
    ctx: ToolContext,
): void {
    server.registerTool(
        'get_external_links',
        {
            title: 'External links',
            description:
                'Inbound (external) links pointing to the host — the backlinks Yandex knows. Read-only.\n' +
                '• report="samples" (default): example links with source page, target URL and discovery ' +
                'date, plus the total count available.\n' +
                '• report="history": time series of the total external-link count over time.',
            inputSchema: {
                hostId: z
                    .string()
                    .optional()
                    .describe(
                        'Host id (e.g. "https:example.com:443"). Defaults to YANDEX_WEBMASTER_HOST_ID.',
                    ),
                report: z
                    .enum(['samples', 'history'])
                    .optional()
                    .describe('Which report to return. Default "samples".'),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(100)
                    .optional()
                    .describe(
                        'report="samples": rows to return (1-100). Default 20.',
                    ),
                offset: z
                    .number()
                    .int()
                    .min(0)
                    .optional()
                    .describe(
                        'report="samples": rows to skip for paging. Default 0.',
                    ),
            },
            annotations: {
                title: 'External links',
                readOnlyHint: true,
                openWorldHint: true,
            },
        },
        async args => {
            try {
                const hostId = resolveHostId(args.hostId, ctx.config)
                const userId = await ctx.getUserId()

                if ((args.report ?? 'samples') === 'history') {
                    const res = await getExternalLinksHistory(
                        ctx.client,
                        userId,
                        hostId,
                    )
                    return toToolResult({
                        report: 'history',
                        host_id: hostId,
                        indicators: res.indicators,
                    })
                }

                const res = await getExternalLinks(ctx.client, userId, hostId, {
                    offset: args.offset,
                    limit: args.limit ?? 20,
                })
                return toToolResult({
                    report: 'samples',
                    host_id: hostId,
                    total_available: res.count ?? null,
                    returned: res.links.length,
                    links: res.links,
                })
            } catch (err) {
                return errorResult(err)
            }
        },
    )
}
