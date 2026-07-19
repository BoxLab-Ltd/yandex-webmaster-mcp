# Contributing

Thanks for your interest in improving `@boxlab/yandex-webmaster-mcp`.

## Development

This project is [Bun](https://bun.sh)-first; the published artifact is
Node-compatible.

```bash
bun install
bun run dev        # run from source with hot reload
bun run typecheck
bun run lint
bun test
bun run build      # emit dist/ with tsc
```

Run `bun run try` (with `YANDEX_WEBMASTER_TOKEN` set, or a cached login) for a
quick live check against the real API.

## Pull requests

- Keep changes focused; one logical change per PR.
- Make sure `bun run typecheck`, `bun run lint`, `bun test`, and `bun run build`
  all pass.
- Tools are **read-only by default**. The only write tool is `recrawl_submit`;
  any new write feature must set `readOnlyHint: false` (and `destructiveHint`
  where relevant) and stay clearly opt-in.
- Response schemas in `src/api/schemas.ts` are intentionally lenient: prefer
  `.nullish()` over `.optional()` (Yandex returns `null` for absent fields).
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `chore:`, …).
