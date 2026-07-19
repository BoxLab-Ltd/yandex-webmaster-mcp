# Security Policy

## Reporting a vulnerability

Please report security issues privately via GitHub's
[**Private Vulnerability Reporting**](https://github.com/BoxLab-Ltd/yandex-webmaster-mcp/security/advisories/new)
(Security → Report a vulnerability). Do not open a public issue for security
problems. We aim to respond within a few business days.

## Security model

This server is designed to be safe to run against a live Yandex Webmaster
account:

- **Read-only by default.** Every tool is read-only except `recrawl_submit`,
  which only queues a URL of your own verified site for recrawl (it cannot read,
  change or delete site data). There are no delete operations.
- **No secrets in the package.** Interactive login uses authorization-code +
  PKCE with a built-in **public** OAuth client (client_id only, no secret).
  Tokens are cached locally at `~/.config/yandex-webmaster-mcp/token.json` with
  `0600` permissions and are never logged or written to stdout.
- **No third-party endpoints.** The server talks only to Yandex
  (`api.webmaster.yandex.net` and `oauth.yandex.ru`).
