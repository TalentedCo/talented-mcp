import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { TalentedApiError, TalentedClient } from "@/lib/talented-client";
import { registerResources } from "@/lib/resources";
import { registerTools } from "@/lib/tools";

const talentedClient = new TalentedClient();
const MCP_RESOURCE = canonicalizeResource(
  process.env.TALENTED_MCP_RESOURCE || "https://mcp.talented.co/mcp"
);
const LEGACY_MCP_RESOURCE_ORIGIN = new URL(MCP_RESOURCE).origin;

const baseHandler = createMcpHandler(
  (server) => {
    registerTools(server, talentedClient);
    registerResources(server, talentedClient);
  },
  {
    capabilities: {
      tools: { listChanged: false },
      resources: { listChanged: false }
    }
  },
  {
    basePath: "",
    maxDuration: 60,
    verboseLogs: false
  }
);

const handler = withMcpAuth(
  baseHandler,
  async (_req, bearerToken) => {
    if (!bearerToken?.startsWith("tal_")) return undefined;
    try {
      const validation = await talentedClient.validateToken(bearerToken);
      if (!isAcceptedOAuthResource(validation.token.oauthResource)) {
        return undefined;
      }

      const expiresAt = validation.token.expiresAt
        ? Math.floor(Date.parse(validation.token.expiresAt) / 1000)
        : undefined;

      return {
        token: bearerToken,
        clientId: `talented-user-${validation.user.id}`,
        scopes: validation.token.scopes,
        expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
        extra: {
          opaque: true,
          user: validation.user,
          tokenId: validation.token.id,
          tokenPrefix: validation.token.tokenPrefix,
          oauthResource: validation.token.oauthResource ?? null
        }
      };
    } catch (error) {
      if (
        error instanceof TalentedApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        return undefined;
      }
      throw error;
    }
  },
  {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource"
  }
);

export { handler as GET, handler as POST };

function isAcceptedOAuthResource(resource: string | null | undefined): boolean {
  if (!resource) return true;

  let canonical: string;
  try {
    canonical = canonicalizeResource(resource);
  } catch {
    return false;
  }

  return canonical === MCP_RESOURCE || canonical === LEGACY_MCP_RESOURCE_ORIGIN;
}

function canonicalizeResource(resource: string): string {
  const parsed = new URL(resource);
  if (parsed.protocol !== "https:") {
    throw new Error("MCP OAuth resource must use https");
  }
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = "";
  if (parsed.port === "443") parsed.port = "";
  return parsed.toString().replace(/\/+$/, "");
}
