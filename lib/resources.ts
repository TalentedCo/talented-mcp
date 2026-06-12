import {
  McpServer,
  ResourceTemplate
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { TalentedClient, TalentedApiError } from "@/lib/talented-client";

type ReadResult = {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
};

async function readJson(
  uri: string,
  auth: AuthInfo | undefined,
  client: TalentedClient,
  path: string
): Promise<ReadResult> {
  if (!auth?.token) return errorResult(uri, "missing_auth");
  try {
    const result = await client.request(auth.token, "GET", path);
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(result) }]
    };
  } catch (error) {
    return errorResult(
      uri,
      error instanceof TalentedApiError
        ? `talented_${error.status}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error)
    );
  }
}

function errorResult(uri: string, message: string): ReadResult {
  return {
    contents: [{ uri, mimeType: "application/json", text: JSON.stringify({ error: message }) }]
  };
}

export function registerResources(server: McpServer, client: TalentedClient): void {
  server.registerResource(
    "companies",
    "talented://companies",
    {
      title: "Accessible Companies",
      description: "Companies visible to the token user.",
      mimeType: "application/json"
    },
    async (_uri, extra) =>
      readJson("talented://companies", extra.authInfo, client, "/api/agent/v1/companies")
  );

  server.registerResource(
    "company-jobs",
    new ResourceTemplate("talented://companies/{companyId}/jobs", { list: undefined }),
    {
      title: "Company Jobs",
      description: "Compact jobs for one accessible company. Includes bounded descriptionPreview and counts only; call get_job for full job detail, scoring context, progression, stage meanings, automation flags, and hiring-plan competencies.",
      mimeType: "application/json"
    },
    async (_uri, variables, extra) => {
      const companyId = firstVariable(variables.companyId);
      return readJson(
        `talented://companies/${companyId}/jobs`,
        extra.authInfo,
        client,
        `/api/agent/v1/companies/${companyId}/jobs`
      );
    }
  );

  server.registerResource(
    "job-applications",
    new ResourceTemplate("talented://jobs/{jobId}/applications", { list: undefined }),
    {
      title: "Job Applications",
      description: "Applications for one accessible job, including separate resume match and interview score fields when present.",
      mimeType: "application/json"
    },
    async (_uri, variables, extra) => {
      const jobId = firstVariable(variables.jobId);
      return readJson(
        `talented://jobs/${jobId}/applications`,
        extra.authInfo,
        client,
        `/api/agent/v1/jobs/${jobId}/applications`
      );
    }
  );

  server.registerResource(
    "application",
    new ResourceTemplate("talented://applications/{applicationId}", { list: undefined }),
    {
      title: "Application",
      description: "One accessible application with candidate, stage, resume match, interview score, and bounded screening context when present.",
      mimeType: "application/json"
    },
    async (_uri, variables, extra) => {
      const applicationId = firstVariable(variables.applicationId);
      return readJson(
        `talented://applications/${applicationId}`,
        extra.authInfo,
        client,
        `/api/agent/v1/applications/${applicationId}`
      );
    }
  );
}

function firstVariable(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : value ?? "";
}
