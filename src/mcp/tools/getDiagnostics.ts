import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getDiagnostics } from '../../api/webmaster.js'
import { resolveHostId, type ToolContext } from '../context.js'
import { errorResult, toToolResult } from '../format.js'

/** Severity order, worst first, for ranking active problems. */
const SEVERITY_RANK: Record<string, number> = {
    FATAL: 0,
    CRITICAL: 1,
    POSSIBLE_PROBLEM: 2,
    RECOMMENDATION: 3,
}

export function registerGetDiagnostics(
    server: McpServer,
    ctx: ToolContext,
): void {
    server.registerTool(
        'get_diagnostics',
        {
            title: 'Site diagnostics',
            description:
                'Yandex Webmaster site diagnostics: problems detected on the host (e.g. DNS errors, ' +
                'slow response, robots.txt issues, 4xx alerts), each with a severity (FATAL, CRITICAL, ' +
                'POSSIBLE_PROBLEM, RECOMMENDATION). By default returns only ACTIVE problems (state=PRESENT), ' +
                'worst first. Set includeAbsent=true to also list resolved/absent problem types. Read-only.',
            inputSchema: {
                hostId: z
                    .string()
                    .optional()
                    .describe(
                        'Host id (e.g. "https:example.com:443"). Defaults to YANDEX_WEBMASTER_HOST_ID. ' +
                            'List valid ids with get_hosts.',
                    ),
                includeAbsent: z
                    .boolean()
                    .optional()
                    .describe(
                        'Also list problem types that are currently absent/resolved. Default false.',
                    ),
            },
            annotations: {
                title: 'Site diagnostics',
                readOnlyHint: true,
                openWorldHint: true,
            },
        },
        async args => {
            try {
                const hostId = resolveHostId(args.hostId, ctx.config)
                const userId = await ctx.getUserId()
                const { problems } = await getDiagnostics(
                    ctx.client,
                    userId,
                    hostId,
                )

                const active = Object.entries(problems)
                    .filter(([, p]) => p.state === 'PRESENT')
                    .map(([problem_type, p]) => ({
                        problem_type,
                        severity: p.severity ?? null,
                        since: p.last_state_update ?? null,
                    }))
                    .sort(
                        (a, b) =>
                            (SEVERITY_RANK[a.severity ?? ''] ?? 99) -
                            (SEVERITY_RANK[b.severity ?? ''] ?? 99),
                    )

                const bySeverity: Record<string, number> = {}
                for (const p of active) {
                    const key = p.severity ?? 'UNKNOWN'
                    bySeverity[key] = (bySeverity[key] ?? 0) + 1
                }

                const absent = args.includeAbsent
                    ? Object.entries(problems)
                          .filter(([, p]) => p.state !== 'PRESENT')
                          .map(([problem_type]) => problem_type)
                    : undefined

                return toToolResult({
                    host_id: hostId,
                    active_problems: active,
                    counts: { active: active.length, by_severity: bySeverity },
                    ...(absent ? { absent_problem_types: absent } : {}),
                })
            } catch (err) {
                return errorResult(err)
            }
        },
    )
}
