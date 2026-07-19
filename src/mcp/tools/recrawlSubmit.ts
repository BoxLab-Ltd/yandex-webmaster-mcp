import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { submitRecrawl } from '../../api/webmaster.js'
import { resolveHostId, type ToolContext } from '../context.js'
import { errorResult, toToolResult } from '../format.js'

export function registerRecrawlSubmit(
    server: McpServer,
    ctx: ToolContext,
): void {
    server.registerTool(
        'recrawl_submit',
        {
            title: 'Submit URL for recrawl',
            description:
                'Ask Yandex to recrawl a specific page of the host sooner. NOT read-only: each call ' +
                'consumes one unit of the limited daily recrawl quota (check it with recrawl_status). ' +
                'The URL must belong to the host and be a full absolute URL. Returns the task_id and the ' +
                'remaining quota. Track progress with recrawl_status using the returned task_id.',
            inputSchema: {
                hostId: z
                    .string()
                    .optional()
                    .describe(
                        'Host id (e.g. "https:example.com:443"). Defaults to YANDEX_WEBMASTER_HOST_ID.',
                    ),
                url: z
                    .string()
                    .describe(
                        'Absolute URL of the page to recrawl, e.g. "https://example.com/page/". ' +
                            'Must belong to the host.',
                    ),
            },
            annotations: {
                title: 'Submit URL for recrawl',
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: true,
            },
        },
        async args => {
            try {
                const hostId = resolveHostId(args.hostId, ctx.config)
                const userId = await ctx.getUserId()
                const res = await submitRecrawl(
                    ctx.client,
                    userId,
                    hostId,
                    args.url,
                )
                return toToolResult({
                    host_id: hostId,
                    url: args.url,
                    task_id: res.task_id ?? null,
                    quota_remainder: res.quota_remainder ?? null,
                })
            } catch (err) {
                return errorResult(err)
            }
        },
    )
}
