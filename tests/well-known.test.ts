import { describe, expect, it, vi } from "vitest";

describe("/.well-known/oauth-protected-resource", () => {
  it("returns RFC 9728 protected-resource metadata pointing at Talented auth", async () => {
    vi.stubEnv("TALENTED_MCP_RESOURCE", "https://mcp.talented.test/");
    vi.stubEnv("TALENTED_OAUTH_AS_URL", "https://auth.talented.test/");
    const { GET } = await import("../app/.well-known/oauth-protected-resource/route");

    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("max-age=3600");
    const body = await response.json();

    expect(body).toEqual({
      resource: "https://mcp.talented.test",
      authorization_servers: ["https://auth.talented.test"],
      bearer_methods_supported: ["header"],
      scopes_supported: ["agent:read", "agent:write"],
      resource_documentation: "https://github.com/TalentedCo/talented-mcp#readme"
    });
  });
});
