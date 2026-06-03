# Testing

Run local checks:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Use `TALENTED_API_BASE_URL` to point the MCP server at a Talented preview:

```bash
TALENTED_API_BASE_URL=https://talented-preview.example.com pnpm dev
```

The MCP route requires a `tal_...` bearer token. The app PR that introduces `/api/agent/v1` must be running behind the configured base URL.
