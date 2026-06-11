import { afterAll, beforeAll, describe, expect, it } from "vitest";

let POST: (req: Request) => Promise<Response>;
const realFetch = globalThis.fetch;

beforeAll(async () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input as RequestInfo, init);
    if (req.url === "https://talented.co/api/agent/v1/auth/validate") {
      const auth = req.headers.get("authorization");
      if (auth === "Bearer tal_valid") {
        return Response.json({
          user: {
            id: 12,
            email: "owner@example.com",
            firstName: "Owner",
            lastName: "User"
          },
          token: {
            id: 34,
            name: "Claude",
            tokenPrefix: "tal_valid",
            scopes: ["agent:read", "agent:write"],
            oauthResource: "https://mcp.talented.co/mcp",
            expiresAt: "2026-09-03T16:20:00.000Z"
          }
        });
      }
      if (auth === "Bearer tal_manual") {
        return Response.json({
          user: {
            id: 12,
            email: "owner@example.com",
            firstName: "Owner",
            lastName: "User"
          },
          token: {
            id: 35,
            name: "Manual API key",
            tokenPrefix: "tal_manual",
            scopes: ["agent:read", "agent:write"],
            oauthResource: null,
            expiresAt: null
          }
        });
      }
      if (auth === "Bearer tal_wrong_resource") {
        return Response.json({
          user: {
            id: 12,
            email: "owner@example.com",
            firstName: "Owner",
            lastName: "User"
          },
          token: {
            id: 36,
            name: "Wrong MCP",
            tokenPrefix: "tal_wrong",
            scopes: ["agent:read", "agent:write"],
            oauthResource: "https://other.example/mcp",
            expiresAt: null
          }
        });
      }
      return Response.json({ error: "Invalid API token" }, { status: 401 });
    }
    return realFetch(input as never, init as never);
  }) as typeof fetch;

  ({ POST } = await import("../app/[transport]/route"));
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

function jsonRpc(
  body: { id: number; method: string; params?: unknown },
  token?: string
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream"
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request("http://localhost:3000/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", ...body })
  });
}

async function readBody(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) {
    const text = await res.text();
    const events = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice("data:".length).trim()));
    return events.length === 1 ? events[0] : events;
  }
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

describe("MCP route auth", () => {
  it("returns 401 with a resolvable resource metadata challenge when no token is sent", async () => {
    const response = await POST(jsonRpc({ id: 1, method: "initialize" }));

    expect(response.status).toBe(401);
    const challenge = response.headers.get("www-authenticate") ?? "";
    expect(challenge.toLowerCase()).toContain("bearer");
    expect(challenge).toContain("resource_metadata");
    expect(challenge).toContain("/.well-known/oauth-protected-resource");
  });

  it("returns 401 for tal_ tokens rejected by the Talented backend", async () => {
    const response = await POST(
      jsonRpc({ id: 1, method: "initialize" }, "tal_invalid")
    );

    expect(response.status).toBe(401);
  });

  it("allows tools/list with a backend-validated tal_ token", async () => {
    const response = await POST(jsonRpc({ id: 2, method: "tools/list" }, "tal_valid"));

    expect(response.status).toBe(200);
    const body = (await readBody(response)) as {
      result?: { tools?: Array<{ name: string }> };
    };
    const names = (body.result?.tools ?? []).map((tool) => tool.name);
    expect(names).toContain("list_companies");
    expect(names).toContain("get_job");
  });

  it("preserves manual tal_ API-key usage when no OAuth audience is attached", async () => {
    const response = await POST(jsonRpc({ id: 3, method: "tools/list" }, "tal_manual"));

    expect(response.status).toBe(200);
  });

  it("rejects OAuth-issued tokens for a different MCP resource", async () => {
    const response = await POST(
      jsonRpc({ id: 4, method: "tools/list" }, "tal_wrong_resource")
    );

    expect(response.status).toBe(401);
  });
});
