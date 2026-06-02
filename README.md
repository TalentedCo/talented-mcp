# talented-mcp

Model Context Protocol server for the Talented Agent API.

This server gives MCP-aware clients a safe, employer-side Talented tool surface over the same non-admin API contract used by [`talented-cli`](https://github.com/TalentedCo/talented-cli).

## Status

This repo targets the Agent API added in the linked `TalentedCo/talented-co` PR for FIZZY-249. Production API calls require that app PR to land.

## Auth

V1 uses Talented bearer tokens:

```http
Authorization: Bearer tal_...
```

OAuth marketplace flow is intentionally out of scope for v1.

## Tools

- `list_companies`
- `get_company`
- `list_jobs`
- `get_job`
- `create_or_update_job`
- `set_job_status`
- `list_applications`
- `get_application`
- `create_application`
- `move_application_stage`
- `reject_application`
- `unreject_application`
- `get_candidate`
- `add_candidate_note`
- `update_candidate_status`

Tool descriptions preserve the role boundary: material job writes require company `OWNER` or `ADMIN`, pipeline actions apply to one application at a time, and no super-admin, billing, impersonation, raw database, migration, debug/eval, or bulk-destructive operations are exposed.

## Resources

- `talented://companies`
- `talented://companies/{companyId}/jobs`
- `talented://jobs/{jobId}/applications`
- `talented://applications/{applicationId}`

## Local Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Point at a local Talented app:

```bash
TALENTED_API_BASE_URL=http://localhost:3000 pnpm dev
```

## Client Config Example

```json
{
  "mcpServers": {
    "talented": {
      "url": "https://your-mcp-host.example.com/mcp",
      "headers": {
        "Authorization": "Bearer tal_..."
      }
    }
  }
}
```
