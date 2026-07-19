import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
    getRecrawlQuota,
    getRecrawlTask,
    listRecrawlTasks,
} from '../../api/webmaster.js'
import { resolveHostId, type ToolContext } from '../context.js'
import { errorResult, toToolResult } from '../format.js'

export function registerRecrawlStatus(
    server: McpServer,
    ctx: ToolContext,
): void {
    server.registerTool(
        'recrawl_status',
        {
            title: 'Recrawl quota & tasks',
            description:
                'Read-only view of the host recrawl activity. With no taskId: the remaining daily quota ' +
                'plus the most recent recrawl tasks and their state (IN_PROGRESS, DONE, FAILED). Pass ' +
                'taskId (from recrawl_submit) to check one task. Use before recrawl_submit to confirm ' +
                'quota is available.',
            inputSchema: {
                hostId: z
                    .string()
                    .optional()
                    .describe(
                        'Host id (e.g. "https:example.com:443"). Defaults to YANDEX_WEBMASTER_HOST_ID.',
                    ),
                taskId: z
                    .string()
                    .optional()
                    .describe(
                        'Check a single recrawl task by its id (from recrawl_submit). ' +
                            'Omit to get quota + recent tasks.',
                    ),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(100)
                    .optional()
                    .describe(
                        'Recent tasks to list when no taskId (1-100). Default 10.',
                    ),
            },
            annotations: {
                title: 'Recrawl quota & tasks',
                readOnlyHint: true,
                openWorldHint: true,
            },
        },
        async args => {
            try {
                const hostId = resolveHostId(args.hostId, ctx.config)
                const userId = await ctx.getUserId()

                if (args.taskId) {
                    const task = await getRecrawlTask(
                        ctx.client,
                        userId,
                        hostId,
                        args.taskId,
                    )
                    return toToolResult({ host_id: hostId, task })
                }

                const [quota, list] = await Promise.all([
                    getRecrawlQuota(ctx.client, userId, hostId),
                    listRecrawlTasks(ctx.client, userId, hostId, {
                        limit: args.limit ?? 10,
                    }),
                ])
                return toToolResult({
                    host_id: hostId,
                    quota: {
                        daily_quota: quota.daily_quota ?? null,
                        quota_remainder: quota.quota_remainder ?? null,
                    },
                    recent_tasks: list.tasks,
                })
            } catch (err) {
                return errorResult(err)
            }
        },
    )
}
