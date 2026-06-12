# Talented MCP

Connect [Talented](https://talented.co) to Claude and any other MCP-aware AI tool. The Talented MCP server exposes your employer-side hiring workflow — companies, jobs, applications, candidates, and notes — as safe, scoped tools an assistant can call on your behalf.

It speaks the [Model Context Protocol](https://modelcontextprotocol.io) over HTTP. OAuth-aware clients connect with just the hosted URL and complete a Talented sign-in/consent flow. Headless clients can still send a `tal_…` API key as a bearer token.

- **Hosted server:** `https://mcp.talented.co/mcp`
- **OAuth discovery:** `https://mcp.talented.co/.well-known/oauth-protected-resource`
- **Auth server:** `https://talented.co/.well-known/oauth-authorization-server`
- **Headless auth:** a personal `tal_…` API key, sent as a bearer token
- **Same contract as the** [`talented-cli`](https://github.com/TalentedCo/talented-cli) — no super‑admin, billing, impersonation, raw‑database, or bulk‑destructive surfaces.

---

## Quick start

1. **Add the server to your OAuth-aware client** (pick yours below). URL-only setup reduces to:
   - URL: `https://mcp.talented.co/mcp`
2. **For headless clients, get an API key** at **[talented.co → Account Settings → API Keys](https://talented.co/pro/account)**. Copy it when it's shown (it's only shown once). Bearer setup reduces to:
   - URL: `https://mcp.talented.co/mcp`
   - Header: `Authorization: Bearer tal_your_key_here`
3. **Ask your assistant** something like *"List my Talented companies"* or *"Show open applications for job 1042."*

> **Always include the `/mcp` path.** The URL is `https://mcp.talented.co/mcp`, not `https://mcp.talented.co`. The OAuth resource identifier is the full path, so clients that point at the bare origin will fail discovery (in Claude Desktop the connect attempt errors out). When in doubt, paste the URL exactly as shown above.

---

## 1. Get an API key

OAuth-aware clients do not need a manually-created key. They discover `https://talented.co` as the authorization server, open Talented sign-in/consent, and receive a 90-day scoped bearer token that can be revoked from Talented account settings.

API keys remain available for headless or non-OAuth clients:

1. Sign in at [talented.co](https://talented.co).
2. Open the user menu → **Account Settings** → **API Keys** (or go straight to **[/pro/account](https://talented.co/pro/account)**).
3. Click **Create key**, name it (e.g. "Claude"), and **copy the `tal_…` value** — it's shown only once.

Each key acts as **you**: every request is restricted to the companies you're a member of, and your role is enforced on every action. Revoke a key anytime from the same page.

---

## 2. Add the server to your client

> Replace `tal_your_key_here` with the key you created.

### Connection details

| | |
|---|---|
| **Transport** | Streamable HTTP |
| **URL** | `https://mcp.talented.co/mcp` |
| **OAuth setup** | No header; client discovers Talented auth |
| **Bearer setup** | `Authorization: Bearer tal_your_key_here` |

Most modern clients support remote HTTP servers directly. Use the URL-only form when your client supports remote MCP OAuth. Use the URL + header form for headless clients, non-OAuth clients, or automated environments. Clients that only support local (stdio) servers can bridge to the hosted server with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) — see [Claude Desktop](#claude-desktop) and [Any other client](#any-other-client).

### Claude Code

```bash
claude mcp add --transport http talented https://mcp.talented.co/mcp
```

For headless bearer setup:

```bash
claude mcp add --transport http talented https://mcp.talented.co/mcp \
  --header "Authorization: Bearer tal_your_key_here"
```

Then run `/mcp` inside Claude Code to confirm it's connected. Add `-s user` to make it available in every project.

### Claude Desktop

**Native connector (recommended):** In Claude Desktop go to **Settings → Connectors → Add custom connector** and paste the full URL `https://mcp.talented.co/mcp`. Claude discovers Talented OAuth and opens a Talented sign-in/consent flow — no `mcp-remote` and no manual key needed. Be sure to include the `/mcp` path; pasting just `https://mcp.talented.co` makes OAuth discovery fail and the connect attempt errors out.

**`mcp-remote` bridge (alternative):** For older Claude Desktop builds without native remote connectors, bridge to the hosted server with `mcp-remote`. Edit your config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "talented": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://mcp.talented.co/mcp"
      ]
    }
  }
}
```

For headless bearer setup:

```json
{
  "mcpServers": {
    "talented": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://mcp.talented.co/mcp",
        "--header", "Authorization: Bearer tal_your_key_here"
      ]
    }
  }
}
```

Restart Claude Desktop. (Requires Node.js 18+ on your PATH.)

### Cursor

Create `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per‑project):

```json
{
  "mcpServers": {
    "talented": {
      "url": "https://mcp.talented.co/mcp"
    }
  }
}
```

Add `"headers": { "Authorization": "Bearer tal_your_key_here" }` only for manual bearer setup.

Enable the server in **Cursor → Settings → MCP**.

### VS Code (GitHub Copilot — agent mode)

Create `.vscode/mcp.json` in your workspace (or add to user `settings.json` under `mcp.servers`):

```json
{
  "servers": {
    "talented": {
      "type": "http",
      "url": "https://mcp.talented.co/mcp"
    }
  }
}
```

Add `"headers": { "Authorization": "Bearer tal_your_key_here" }` only for manual bearer setup.

Open the Copilot Chat **agent** picker and enable **talented**.

### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "talented": {
      "serverUrl": "https://mcp.talented.co/mcp"
    }
  }
}
```

Add `"headers": { "Authorization": "Bearer tal_your_key_here" }` only for manual bearer setup.

Then **Refresh** the MCP servers in Windsurf's Cascade settings.

### Cline (VS Code extension)

In Cline, open **MCP Servers → Remote Servers** (or edit `cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "talented": {
      "url": "https://mcp.talented.co/mcp"
    }
  }
}
```

Add `"headers": { "Authorization": "Bearer tal_your_key_here" }` only for manual bearer setup.

### Zed

Zed runs MCP ("context") servers as commands, so bridge with `mcp-remote` in `settings.json`:

```json
{
  "context_servers": {
    "talented": {
      "command": {
        "path": "npx",
        "args": [
          "-y", "mcp-remote",
          "https://mcp.talented.co/mcp"
        ]
      }
    }
  }
}
```

For headless bearer setup:

```json
{
  "context_servers": {
    "talented": {
      "command": {
        "path": "npx",
        "args": [
          "-y", "mcp-remote",
          "https://mcp.talented.co/mcp",
          "--header", "Authorization: Bearer tal_your_key_here"
        ]
      }
    }
  }
}
```

### Any other client

- **If it supports remote / Streamable HTTP OAuth:** point it at `https://mcp.talented.co/mcp` with no header. The client should discover Talented OAuth and open a Talented sign-in/consent flow.
- **If it supports remote / Streamable HTTP with manual headers:** point it at `https://mcp.talented.co/mcp` and add the header `Authorization: Bearer tal_your_key_here`. The exact config key varies (`url`, `serverUrl`, `endpoint`…) — check your client's MCP docs.
- **If it only supports local (stdio) servers:** bridge with `mcp-remote`:

  ```json
  {
    "command": "npx",
    "args": [
      "-y", "mcp-remote",
      "https://mcp.talented.co/mcp",
      "--header", "Authorization: Bearer tal_your_key_here"
    ]
  }
  ```

- **Building your own integration?** Use any MCP SDK's **Streamable HTTP** client transport against `https://mcp.talented.co/mcp`. OAuth-aware clients should follow discovery; headless clients should set the `Authorization` header.

---

## 3. Try it

Once connected, ask your assistant things like:

- "List my Talented companies."
- "What jobs are active at company 12?"
- "Show the latest 10 applications for job 1042."
- "List candidates in the application column for job 1042 with a resume match over 40%, then check the screening context for prior pet experience."
- "How many interviews were completed for job 1042 from 2026-06-01 to 2026-07-01?"
- "Show the pipeline by column for job 1042."
- "What candidate activity happened in the phone-screen column this week?"
- "Add a candidate named Ada Lovelace (ada@example.com) to job 1042."
- "Move application 88 to the phone‑screen stage."
- "Move candidate application 88 to the phone-screen column."
- "Add a note to candidate 240: strong portfolio, follow up next week."

---

## Tools

All tools operate within your company memberships. Read tools need the `agent:read` scope; write tools need `agent:write` (new keys get both by default).

| Tool | What it does | Requires |
|---|---|---|
| `list_companies` | List companies you can access | read |
| `get_company` | Get one company | read |
| `list_jobs` | List compact company jobs with status/search filters, bounded `descriptionPreview`, counts, progression summary, and no full HTML JD/question/competency bodies | read |
| `get_job` | Get the canonical job context: bounded `descriptionText`, `scoringNote`, progression threshold, stage meanings, automation flags, and active hiring-plan competencies | read |
| `create_or_update_job` | Create a draft job or update safe fields | write · **OWNER/ADMIN** |
| `set_job_status` | Change a job's status (draft → active, etc.) | write · **OWNER/ADMIN** |
| `list_applications` | List applications for a job, including separate résumé match and interview score fields plus optional `stageId` / `minMatchScore` / `maxMatchScore` filters | read |
| `get_interview_report` | Interview completion counts for a job/date range. Completed means effective call duration is at least 120 seconds. | read |
| `get_pipeline_report` | Current stage/column counts plus stage conversion metrics for a job | read |
| `get_candidate_activity_report` | Date-range activity counts for applications, stage entries/exits, interviews, completed interviews, and notes | read |
| `get_application` | Get an application with candidate, current stage, separate résumé match score, interview score, and bounded AI screening context | read |
| `create_application` | Add one candidate/application to a job | write |
| `move_application_stage` | Move one application to a valid stage in the same job | write |
| `move_candidate_to_stage` | Alias for moving one candidate application to one valid stage/column; still requires one `applicationId` | write |
| `reject_application` | Reject one application | write |
| `unreject_application` | Un‑reject one application | write |
| `get_candidate` | Get one candidate | read |
| `add_candidate_note` | Add a dashboard‑visible candidate note | write |
| `update_candidate_status` | Update a candidate's status and/or favorite flag | write |

### Reporting notes

- `list_jobs` responses are intentionally compact. They include enough metadata to choose a job but omit full descriptions, question text, and competency bodies. Call `get_job` before ranking candidates, explaining fit, or interpreting score ceilings.
- `get_job` is the detailed job-context call. It includes bounded job description text, scoring note, progression mode and `autoProgressThreshold`, stage meanings, automation flags, and active hiring-plan competencies. Interview questions remain out of scope.
- Application list/detail/create responses may include a small top-level `jobContextHint` with progression and a `recommendedNextCall` pointing to `get_job`; detailed hiring-plan context remains in `get_job`.
- Application list/detail responses expose résumé/application fit as `resumeMatchScorePercent` and `applicationMatchScorePercent` from `Application.aiScreeningResult.matchScore` when present.
- Interview-derived scoring is exposed separately as `interviewScore` and `interviewScorePercent` from scored interview competency assessments. This is not the same number as the résumé match score.
- Application responses include bounded `aiScreeningContext` highlights such as reasoning, strengths, concerns, career highlights, skill highlights, requirements matrix, and red flags. Full résumé text is not returned in list/detail responses by default.
- Use `stageId` for Talented columns and `minMatchScore` / `maxMatchScore` to filter application/resume match percentages before inspecting candidate context.

- Completed interviews are duration-based: Talented counts an interview as completed when the effective call duration is `>= 120` seconds. The Agent API uses `Interview.totalDurationSeconds` when present, then falls back to summed `InterviewSession.durationSeconds` values.
- Report date filters use `from` as inclusive and `to` as exclusive. Date-only values such as `2026-06-01` are interpreted as UTC boundaries by the Agent API.
- Talented "columns" are job stages. Report responses include stage and column aliases such as `stageId`, `columnId`, `stageName`, `columnName`, `order`, and `stageType`.
- Activity reports return aggregate counts only. Candidate note content, transcripts, recordings, raw database rows, billing data, and admin/debug fields are not exposed.

## Resources

Browseable, read‑only views for clients that support MCP resources:

- `talented://companies`
- `talented://companies/{companyId}/jobs` (compact job list; use `get_job` for detailed job context)
- `talented://jobs/{jobId}/applications`
- `talented://applications/{applicationId}`

---

## Permissions & security

- **Scoped to you.** Every request resolves your key to your user and enforces current company membership for the target company, job, application, or candidate.
- **Role‑aware.** Material job writes (`create_or_update_job`, `set_job_status`) require company **OWNER** or **ADMIN**; pipeline actions mirror the normal ATS dashboard and act one item at a time.
- **Intentionally limited.** No super‑admin, impersonation, billing/Stripe, feature flags, raw database/SQL, migrations, eval/debug, or bulk‑destructive operations are exposed.
- **Key hygiene.** Manual keys and OAuth-issued tokens are stored only as hashes. Manual keys are shown once at creation, can be given an expiry, and can be revoked anytime at [talented.co/pro/account](https://talented.co/pro/account). OAuth-issued tokens last about 90 days and remain revocable.

---

## Troubleshooting

- **`401 invalid_token`** — the key is missing, malformed, expired, or revoked. Make sure the header is exactly `Authorization: Bearer tal_…`.
- **Connected, but tool calls fail with 401** — your key must come from the same Talented environment the server talks to (production [talented.co](https://talented.co)). A key minted on a local/dev instance won't validate against the hosted server.
- **`mcp-remote` won't connect** — ensure Node.js 18+ is installed; clear its auth cache with `rm -rf ~/.mcp-auth` and retry.
- **Quick reachability check:**

  ```bash
  curl -i -X POST https://mcp.talented.co/mcp \
    -H "Authorization: Bearer tal_your_key_here" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
  ```

---

## Related

- **[talented-cli](https://github.com/TalentedCo/talented-cli)** — the same Agent API from your terminal.
- **Talented Agent API** — the underlying HTTP contract this server wraps.

---

## Local development & self‑hosting

This is a [Next.js](https://nextjs.org) app using the [`mcp-handler`](https://www.npmjs.com/package/mcp-handler) adapter; the MCP endpoint is the `app/[transport]/route.ts` handler.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Run it against a local Talented instance:

```bash
TALENTED_API_BASE_URL=http://localhost:3000 pnpm dev
```

`TALENTED_API_BASE_URL` controls which Talented backend the server calls (defaults to production). Clients still authenticate per‑request with their own `tal_…` bearer token; the server holds no shared secret.
