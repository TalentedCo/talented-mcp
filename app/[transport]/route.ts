import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { TalentedClient } from "@/lib/talented-client";
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
    return {
      token: bearerToken,
      clientId: "talented-agent-api",
      scopes: ["agent:read", "agent:write"],
      extra: { opaque: true }
    };
  },
  { required: true }
);

export { handler as GET, handler as POST };
