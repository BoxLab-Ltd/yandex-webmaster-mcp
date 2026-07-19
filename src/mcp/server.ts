import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebmasterClient } from '../api/client.js'
import { getUserId } from '../api/webmaster.js'
import { resolveTokenProvider } from '../auth/resolve.js'
import {
    loadConfig,
    SERVER_NAME,
    SERVER_VERSION,
    type Config,
} from '../config.js'
import type { ToolContext } from './context.js'
import { registerGetDiagnostics } from './tools/getDiagnostics.js'
import { registerGetExternalLinks } from './tools/getExternalLinks.js'
import { registerGetHosts } from './tools/getHosts.js'
import { registerGetIndexing } from './tools/getIndexing.js'
import { registerListSitemaps } from './tools/listSitemaps.js'
import { registerRecrawlStatus } from './tools/recrawlStatus.js'
import { registerRecrawlSubmit } from './tools/recrawlSubmit.js'
import { registerSearchQueries } from './tools/searchQueries.js'

/**
 * Build a fully configured MCP server: the Webmaster API client, the tool
 * context, and all registered tools. Transport is wired up by the caller.
 */
export function createServer(config: Config = loadConfig()): McpServer {
    const { provider, mode } = resolveTokenProvider(config)
    // stderr only — stdout carries the MCP protocol on the stdio transport.
    console.error(`yandex-webmaster-mcp: auth source = ${mode}`)

    const client = new WebmasterClient({
        baseUrl: config.baseUrl,
        getToken: () => provider.getAccessToken(),
        onUnauthorized: rejected => provider.forceRefresh(rejected),
        canRefresh: () => provider.canRefresh(),
        userAgent: config.userAgent,
        maxConcurrency: config.maxConcurrency,
        requestTimeoutMs: config.requestTimeoutMs,
    })

    // The user id never changes for a token, so resolve it once and reuse it
    // across every host-scoped tool call.
    let userIdPromise: Promise<number> | undefined
    const ctx: ToolContext = {
        client,
        config,
        getUserId: () => {
            if (!userIdPromise) userIdPromise = getUserId(client)
            return userIdPromise
        },
    }

    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION })
    registerGetHosts(server, ctx)
    registerSearchQueries(server, ctx)
    registerGetIndexing(server, ctx)
    registerGetDiagnostics(server, ctx)
    registerListSitemaps(server, ctx)
    registerGetExternalLinks(server, ctx)
    registerRecrawlStatus(server, ctx)
    registerRecrawlSubmit(server, ctx)

    return server
}
