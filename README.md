# Yandex Webmaster MCP

[![CI](https://github.com/BoxLab-Ltd/yandex-webmaster-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/BoxLab-Ltd/yandex-webmaster-mcp/actions/workflows/ci.yml)
[![npm](https://badgen.net/npm/v/@boxlab/yandex-webmaster-mcp)](https://www.npmjs.com/package/@boxlab/yandex-webmaster-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Ask your Yandex Webmaster data in plain language — from Claude, Cursor, or any MCP client.

> **Read-only by design** (plus URL recrawl), **no secrets stored**. Sign in with a
> built-in public OAuth client over PKCE — no app registration, no client secret.
>
> **Early development (v0.1).** The tool surface is still growing.

A Model Context Protocol server that exposes Yandex Webmaster as a small set of
flexible, well-described tools instead of one-thin-wrapper-per-endpoint. Pairs
with [`yandex-metrica-mcp`](https://github.com/BoxLab-Ltd/yandex-metrica-mcp):
run both and an agent can cross-reference search queries from Webmaster with
on-site behavior and conversions from Metrica in a single conversation.

## Quickstart

**1. Add the server to your MCP client** (Claude Desktop, Cursor, …):

```json
{
    "mcpServers": {
        "yandex-webmaster": {
            "command": "npx",
            "args": ["-y", "@boxlab/yandex-webmaster-mcp"]
        }
    }
}
```

**2. Sign in** — interactive, no secret needed:

```bash
npx @boxlab/yandex-webmaster-mcp auth
```

Approve access in the browser, paste the code Yandex shows you. The token is
cached at `~/.config/yandex-webmaster-mcp/token.json` (mode `0600`).

**3. Ask your agent** — e.g. _"List my Webmaster hosts and show the SQI for
example.com."_

### Or install as a Claude Code plugin

```
/plugin marketplace add BoxLab-Ltd/yandex-webmaster-mcp
/plugin install yandex-webmaster-mcp@boxlab
```

## Why

Existing community servers tend to be thin wrappers — one tool per API endpoint,
dumping raw JSON into the model's context. This server aims to be well-engineered:
fewer, smarter tools; compact, structured output; read-only by default so an
agent can explore your Webmaster data safely.

## Tools (v0.1)

- **`get_hosts`** — list the sites available to your token with their `host_id`,
  URL and verification state; optionally a host summary (SQI, indexed/excluded
  pages, site problems). Read-only. Call this first.
- **`search_queries`** — search-query analytics from Yandex Search: impressions,
  clicks, average show/click position. `report="top"` ranks the queries bringing
  the most traffic; `report="trend"` returns a time series (per query or the
  site aggregate). Filter by device and date range. Read-only.
- **`get_indexing`** — how Yandex crawls and indexes the host. `report="history"`
  gives crawled pages by HTTP status class over time; `report="crawled"` lists
  example crawled URLs with their codes; `report="in_search"` lists example pages
  currently in search. Read-only.
- **`get_diagnostics`** — problems detected on the site (DNS, slow response,
  robots.txt, 4xx, …) with severity, active problems first. Read-only.
- **`list_sitemaps`** — the Sitemap files Yandex knows, with URL counts, error
  counts and where each was discovered. Read-only.
- **`get_external_links`** — inbound links (backlinks): `report="samples"` for
  example links with source/target, `report="history"` for the count over time.
  Read-only.
- **`recrawl_status`** — remaining daily recrawl quota plus recent recrawl tasks
  and their state; pass `taskId` to check one task. Read-only.
- **`recrawl_submit`** — ask Yandex to recrawl a specific URL sooner. The one
  write tool; consumes one unit of the daily quota. Returns the task id.

_Planned:_ write tools for sitemaps, original texts and feeds, deferred to a
later, opt-in release.

## Requirements

- Node.js >= 18
- A Yandex account with at least one site added in
  [Yandex Webmaster](https://webmaster.yandex.ru)

## Authentication

Three ways, in priority order:

1. **Interactive login (recommended)** — `npx @boxlab/yandex-webmaster-mcp auth`.
   Uses the built-in public OAuth client over PKCE; the token is valid ~6 months.
2. **Static token** — set `YANDEX_WEBMASTER_TOKEN` (e.g. for CI) to an OAuth
   token for an app with the `webmaster:hostinfo` scope.
3. **Your own OAuth app** — set `YANDEX_OAUTH_CLIENT_ID` (and
   `YANDEX_OAUTH_CLIENT_SECRET` to enable automatic token refresh). The app needs
   the `webmaster:hostinfo` and `webmaster:verify` scopes.

See [`.env.example`](.env.example) for all configuration.

## Development

Bun-first:

```bash
bun install
bun run dev          # watch mode
bun run typecheck
bun run lint
bun test
bun run build        # emits dist/ (Node-compatible)
bun run try          # smoke against the real API after `bun run auth`
```

The published package runs on Node; local development uses Bun.

## License

MIT
