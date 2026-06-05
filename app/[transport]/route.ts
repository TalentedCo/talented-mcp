import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { TalentedApiError, TalentedClient } from "@/lib/talented-client";
import { registerResources } from "@/lib/resources";
import { registerTools } from "@/lib/tools";

const talentedClient = new TalentedClient();

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
          tokenPrefix: validation.token.tokenPrefix
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
