import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { listSitemaps } from '../../api/webmaster.js'
import { resolveHostId, type ToolContext } from '../context.js'
import { errorResult, toToolResult } from '../format.js'

export function registerListSitemaps(
    server: McpServer,
    ctx: ToolContext,
): void {
    server.registerTool(
        'list_sitemaps',
        {
            title: 'List sitemaps',
            description:
                'List the Sitemap files Yandex knows for the host, each with its URL, type, last access ' +
                'date, number of URLs and error count, and where it was discovered (robots.txt, webmaster, ' +
                'etc.). Use it to check a sitemap is being read and is error-free. Read-only.',
            inputSchema: {
                hostId: z
                    .string()
                    .optional()
                    .describe(
                        'Host id (e.g. "https:example.com:443"). Defaults to YANDEX_WEBMASTER_HOST_ID.',
                    ),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(100)
                    .optional()
                    .describe('Max sitemaps to return (1-100). Default 100.'),
            },
            annotations: {
                title: 'List sitemaps',
                readOnlyHint: true,
                openWorldHint: true,
            },
        },
        async args => {
            try {
                const hostId = resolveHostId(args.hostId, ctx.config)
                const userId = await ctx.getUserId()
                const { sitemaps } = await listSitemaps(
                    ctx.client,
                    userId,
                    hostId,
                    { limit: args.limit ?? 100 },
                )
                return toToolResult({
                    host_id: hostId,
                    count: sitemaps.length,
                    sitemaps: sitemaps.map(s => ({
                        sitemap_id: s.sitemap_id,
                        url: s.sitemap_url,
                        type: s.sitemap_type,
                        urls_count: s.urls_count ?? null,
                        errors_count: s.errors_count ?? null,
                        children_count: s.children_count ?? null,
                        last_access_date: s.last_access_date ?? null,
                        sources: s.sources ?? null,
                    })),
                })
            } catch (err) {
                return errorResult(err)
            }
        },
    )
}
