import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { TalentedApiError } from "@/lib/talented-client";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function jsonResult(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

export function toolError(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function requireAuth(auth: AuthInfo | undefined): string | ToolResult {
  if (!auth?.token) return toolError("missing_auth");
  return auth.token;
}

export function mapError(error: unknown): ToolResult {
  if (error instanceof TalentedApiError) {
    return toolError(`talented_${error.status}: ${error.message}`);
  }
  return toolError(error instanceof Error ? error.message : String(error));
}
