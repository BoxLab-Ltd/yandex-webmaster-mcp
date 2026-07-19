import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getHostSummary, listHosts } from '../../api/webmaster.js'
import { resolveHostId, type ToolContext } from '../context.js'
import { errorResult, toToolResult } from '../format.js'

export function registerGetHosts(server: McpServer, ctx: ToolContext): void {
    server.registerTool(
        'get_hosts',
        {
            title: 'List Webmaster hosts',
            description:
                'Discovery tool: list the sites (hosts) available to your Yandex Webmaster token, ' +
                'each with its host_id, URL and verification state. host_id is what every other tool ' +
                'needs to identify a site. Optionally pass `hostId` to also fetch that host summary ' +
                '(SQI, indexed/excluded page counts, site problems). Read-only. Call this first.',
            inputSchema: {
                hostId: z
                    .string()
                    .optional()
                    .describe(
                        'Optional host id (e.g. "https:example.com:443"). When set, the response also ' +
                            'includes that host summary. Defaults to YANDEX_WEBMASTER_HOST_ID if configured.',
                    ),
            },
            annotations: {
                title: 'List Webmaster hosts',
                readOnlyHint: true,
                openWorldHint: true,
            },
        },
        async args => {
            try {
                const userId = await ctx.getUserId()
                const hosts = await listHosts(ctx.client, userId)
                const list = hosts.map(h => ({
                    host_id: h.host_id,
                    url: h.unicode_host_url ?? h.ascii_host_url ?? null,
                    verified: h.verified ?? null,
                    main_mirror:
                        h.main_mirror?.unicode_host_url ??
                        h.main_mirror?.ascii_host_url ??
                        null,
                }))

                const wantsSummary =
                    args.hostId !== undefined ||
                    ctx.config.defaultHostId !== undefined
                let summary: Record<string, unknown> | undefined
                if (wantsSummary) {
                    const hostId = resolveHostId(args.hostId, ctx.config)
                    summary = {
                        host_id: hostId,
                        ...(await getHostSummary(ctx.client, userId, hostId)),
                    }
                }

                return toToolResult({
                    user_id: userId,
                    hosts: list,
                    ...(summary ? { summary } : {}),
                })
            } catch (err) {
                return errorResult(err)
            }
        },
    )
}
