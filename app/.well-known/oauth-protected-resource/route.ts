import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 3600;

const RESOURCE = stripTrailingSlash(
  process.env.TALENTED_MCP_RESOURCE || "https://mcp.talented.co"
);
const AUTHORIZATION_SERVER = stripTrailingSlash(
  process.env.TALENTED_OAUTH_AS_URL || "https://talented.co"
);

export function GET() {
  return NextResponse.json(
    {
      resource: RESOURCE,
      authorization_servers: [AUTHORIZATION_SERVER],
      bearer_methods_supported: ["header"],
      scopes_supported: ["agent:read", "agent:write"],
      resource_documentation: "https://github.com/TalentedCo/talented-mcp#readme",
    },
    {
      status: 200,
      headers: {
        "cache-control": "public, max-age=3600",
        "content-type": "application/json",
      },
    }
  );
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
