import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/.well-known/oauth-protected-resource", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns RFC 9728 protected-resource metadata pointing at Talented auth", async () => {
    vi.stubEnv("TALENTED_MCP_RESOURCE", "https://mcp.talented.test/mcp/");
    vi.stubEnv("TALENTED_OAUTH_AS_URL", "https://auth.talented.test/");
    const { GET } = await import("../app/.well-known/oauth-protected-resource/route");

    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("max-age=3600");
    const body = await response.json();

    expect(body).toEqual({
      resource: "https://mcp.talented.test/mcp",
      authorization_servers: ["https://auth.talented.test"],
      bearer_methods_supported: ["header"],
      scopes_supported: ["agent:read", "agent:write"],
      resource_documentation: "https://github.com/TalentedCo/talented-mcp#readme"
    });
  });

  it("serves the path-specific metadata fallback for /mcp clients", async () => {
    vi.stubEnv("TALENTED_MCP_RESOURCE", "https://mcp.talented.test/mcp");
    const { GET } = await import("../app/.well-known/oauth-protected-resource/mcp/route");

    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.resource).toBe("https://mcp.talented.test/mcp");
  });
});
