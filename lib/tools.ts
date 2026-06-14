import { z } from "zod";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TalentedClient } from "@/lib/talented-client";
import { jsonResult, mapError, requireAuth, toolError, type ToolResult } from "@/lib/tool-result";

type ToolHandler<T> = (
  input: T,
  auth: AuthInfo | undefined,
  client: TalentedClient
) => Promise<ToolResult>;

const id = z.number().int().positive();
const isoDateOrDateTime = z
  .string()
  .min(1)
  .describe("ISO date or datetime. Date-only values are interpreted by the Talented Agent API as UTC boundaries.");

function reportQuery(
  input: {
    from?: string;
    to?: string;
    stageId?: number;
    interviewTypeId?: number;
    includeRejected?: boolean;
  },
  keys: Array<"from" | "to" | "stageId" | "interviewTypeId" | "includeRejected">
) {
  const params = new URLSearchParams();
  for (const key of keys) {
    const value = input[key];
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function call<T>(
  auth: AuthInfo | undefined,
  client: TalentedClient,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown
): Promise<ToolResult> {
  const token = requireAuth(auth);
  if (typeof token !== "string") return token;
  try {
    return jsonResult(await client.request<T>(token, method, path, body));
  } catch (error) {
    return mapError(error);
  }
}

export const listCompaniesSchema = {};
export async function listCompaniesHandler(_: Record<string, never>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "GET", "/api/agent/v1/companies");
}

export const getCompanySchema = { companyId: id.describe("Company ID visible to the token user.") };
export async function getCompanyHandler(input: { companyId: number }, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "GET", `/api/agent/v1/companies/${input.companyId}`);
}

export const listJobsSchema = {
  companyId: id.describe("Company ID."),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
  search: z.string().optional(),
  includeArchived: z.boolean().optional()
};
export async function listJobsHandler(input: z.infer<z.ZodObject<typeof listJobsSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const params = new URLSearchParams();
  if (input.status) params.set("status", input.status);
  if (input.search) params.set("search", input.search);
  if (input.includeArchived) params.set("includeArchived", "true");
  const qs = params.toString();
  return call(auth, client, "GET", `/api/agent/v1/companies/${input.companyId}/jobs${qs ? `?${qs}` : ""}`);
}

export const getJobSchema = { jobId: id.describe("Job ID.") };
export async function getJobHandler(input: { jobId: number }, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "GET", `/api/agent/v1/jobs/${input.jobId}`);
}

export const createOrUpdateJobSchema = {
  companyId: id.optional().describe("Required when creating a job."),
  jobId: id.optional().describe("Required when updating an existing job."),
  title: z.string().optional(),
  description: z.string().optional(),
  department: z.string().optional(),
  level: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  remoteOption: z.string().optional(),
  salaryRange: z.string().optional()
};
export async function createOrUpdateJobHandler(input: z.infer<z.ZodObject<typeof createOrUpdateJobSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const { companyId, jobId, ...body } = input;
  if (jobId) return call(auth, client, "PATCH", `/api/agent/v1/jobs/${jobId}`, body);
  if (!companyId) return toolError("companyId is required when creating a job");
  return call(auth, client, "POST", `/api/agent/v1/companies/${companyId}/jobs`, body);
}

export const setJobStatusSchema = {
  jobId: id,
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"])
};
export async function setJobStatusHandler(input: z.infer<z.ZodObject<typeof setJobStatusSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", `/api/agent/v1/jobs/${input.jobId}/status`, { status: input.status });
}

export const listApplicationsSchema = {
  jobId: id.describe("Job ID. Access is limited to jobs visible to the token user."),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  status: z.enum(["PENDING", "REVIEWING", "ACCEPTED", "REJECTED"]).optional(),
  stageId: id.optional().describe("Optional Talented stage/column ID, such as the application column."),
  minMatchScore: z.number().min(0).max(100).optional().describe("Minimum resume/application match percentage from Application.aiScreeningResult.matchScore."),
  maxMatchScore: z.number().min(0).max(100).optional().describe("Maximum resume/application match percentage from Application.aiScreeningResult.matchScore."),
  search: z.string().optional()
};
export async function listApplicationsHandler(input: z.infer<z.ZodObject<typeof listApplicationsSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const params = new URLSearchParams();
  for (const key of ["limit", "offset", "stageId", "minMatchScore", "maxMatchScore"] as const) {
    if (input[key] !== undefined) params.set(key, String(input[key]));
  }
  if (input.status) params.set("status", input.status);
  if (input.search) params.set("search", input.search);
  const qs = params.toString();
  return call(auth, client, "GET", `/api/agent/v1/jobs/${input.jobId}/applications${qs ? `?${qs}` : ""}`);
}

export const getInterviewReportSchema = {
  jobId: id.describe("Job ID to report on. Access is limited to jobs visible to the token user."),
  from: isoDateOrDateTime.optional().describe("Inclusive lower bound for the interview end date."),
  to: isoDateOrDateTime.optional().describe("Exclusive upper bound for the interview end date."),
  stageId: id.optional().describe("Optional Talented stage/column ID to filter by."),
  interviewTypeId: id.optional().describe("Optional interview type ID to filter by.")
};
export async function getInterviewReportHandler(input: z.infer<z.ZodObject<typeof getInterviewReportSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const qs = reportQuery(input, ["from", "to", "stageId", "interviewTypeId"]);
  return call(auth, client, "GET", `/api/agent/v1/jobs/${input.jobId}/reports/interviews${qs}`);
}

export const getPipelineReportSchema = {
  jobId: id.describe("Job ID to report on. Access is limited to jobs visible to the token user."),
  from: isoDateOrDateTime.optional().describe("Inclusive lower bound for stage-entry conversion metrics."),
  to: isoDateOrDateTime.optional().describe("Exclusive upper bound for stage-entry conversion metrics."),
  stageId: id.optional().describe("Optional Talented stage/column ID to filter by."),
  includeRejected: z.boolean().optional().describe("Include rejected applications in pipeline counts.")
};
export async function getPipelineReportHandler(input: z.infer<z.ZodObject<typeof getPipelineReportSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const qs = reportQuery(input, ["from", "to", "stageId", "includeRejected"]);
  return call(auth, client, "GET", `/api/agent/v1/jobs/${input.jobId}/reports/pipeline${qs}`);
}

export const getCandidateActivityReportSchema = {
  jobId: id.describe("Job ID to report on. Access is limited to jobs visible to the token user."),
  from: isoDateOrDateTime.optional().describe("Inclusive lower bound for activity timestamps."),
  to: isoDateOrDateTime.optional().describe("Exclusive upper bound for activity timestamps."),
  stageId: id.optional().describe("Optional Talented stage/column ID to filter by.")
};
export async function getCandidateActivityReportHandler(input: z.infer<z.ZodObject<typeof getCandidateActivityReportSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const qs = reportQuery(input, ["from", "to", "stageId"]);
  return call(auth, client, "GET", `/api/agent/v1/jobs/${input.jobId}/reports/activity${qs}`);
}

export const getApplicationSchema = {
  applicationId: id.describe("Application ID visible to the token user.")
};
export async function getApplicationHandler(input: { applicationId: number }, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "GET", `/api/agent/v1/applications/${input.applicationId}`);
}

export const getTranscriptSchema = {
  applicationId: id.describe("Application ID visible to the token user. Returns the transcript for every interview on this application.")
};
export async function getTranscriptHandler(input: { applicationId: number }, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "GET", `/api/agent/v1/applications/${input.applicationId}/transcript`);
}

export const createApplicationSchema = {
  jobId: id,
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  linkedInUrl: z.string().optional(),
  notes: z.string().optional(),
  coverLetter: z.string().optional(),
  resumeMarkdown: z.string().optional(),
  stageId: id.optional()
};
export async function createApplicationHandler(input: z.infer<z.ZodObject<typeof createApplicationSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const { jobId, email, firstName, lastName, phone, linkedInUrl, notes, coverLetter, resumeMarkdown, stageId } = input;
  return call(auth, client, "POST", `/api/agent/v1/jobs/${jobId}/applications`, {
    candidate: { email, firstName, lastName, phone, linkedInUrl, notes },
    coverLetter,
    resumeMarkdown,
    stageId
  });
}

export const moveApplicationStageSchema = { applicationId: id, stageId: id };
export async function moveApplicationStageHandler(input: z.infer<z.ZodObject<typeof moveApplicationStageSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", `/api/agent/v1/applications/${input.applicationId}/stage`, { stageId: input.stageId });
}

export const moveCandidateToStageSchema = {
  applicationId: id.describe("Application ID for the candidate/job pair to move. Required because one candidate can have multiple applications."),
  stageId: id.describe("Destination Talented stage/column ID in the same job.")
};
export async function moveCandidateToStageHandler(input: z.infer<z.ZodObject<typeof moveCandidateToStageSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return moveApplicationStageHandler(input, auth, client);
}

export const rejectApplicationSchema = { applicationId: id, reason: z.string().optional() };
export async function rejectApplicationHandler(input: z.infer<z.ZodObject<typeof rejectApplicationSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", `/api/agent/v1/applications/${input.applicationId}/reject`, { reason: input.reason });
}

export const unrejectApplicationSchema = { applicationId: id };
export async function unrejectApplicationHandler(input: { applicationId: number }, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", `/api/agent/v1/applications/${input.applicationId}/unreject`, {});
}

export const getCandidateSchema = { candidateId: id };
export async function getCandidateHandler(input: { candidateId: number }, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "GET", `/api/agent/v1/candidates/${input.candidateId}`);
}

export const addCandidateNoteSchema = { candidateId: id, content: z.string().min(1) };
export async function addCandidateNoteHandler(input: z.infer<z.ZodObject<typeof addCandidateNoteSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", `/api/agent/v1/candidates/${input.candidateId}/notes`, { content: input.content });
}

export const sendCandidateSmsSchema = {
  candidateId: id.describe("Candidate ID to text. The phone number always comes from the candidate record; arbitrary numbers cannot be messaged."),
  body: z.string().min(1).max(640).describe("SMS message body, 640 characters max.")
};
export async function sendCandidateSmsHandler(input: z.infer<z.ZodObject<typeof sendCandidateSmsSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", `/api/agent/v1/candidates/${input.candidateId}/sms`, { body: input.body });
}

export const updateCandidateStatusSchema = {
  candidateId: id,
  status: z.enum(["NEW", "CONTACTED", "INTERVIEWING", "HIRED", "REJECTED"]).optional(),
  isFavorite: z.boolean().optional()
};
export async function updateCandidateStatusHandler(input: z.infer<z.ZodObject<typeof updateCandidateStatusSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const { candidateId, ...body } = input;
  return call(auth, client, "PATCH", `/api/agent/v1/candidates/${candidateId}`, body);
}

type Registration = {
  name: string;
  title: string;
  description: string;
  schema: Record<string, z.ZodTypeAny>;
  handler: ToolHandler<any>;
};

const registrations: Registration[] = [
  { name: "list_companies", title: "List Companies", description: "List companies the token user can access. Does not expose super-admin company data.", schema: listCompaniesSchema, handler: listCompaniesHandler },
  { name: "get_company", title: "Get Company", description: "Get one accessible company by ID.", schema: getCompanySchema, handler: getCompanyHandler },
  { name: "list_jobs", title: "List Jobs", description: "List compact jobs in one accessible company, with safe filters. Responses are token-optimized: bounded descriptionPreview, counts, progression/hiring-plan summary, and no full HTML job description, question text, or competency bodies. Call get_job before ranking candidates or explaining fit.", schema: listJobsSchema, handler: listJobsHandler },
  { name: "get_job", title: "Get Job", description: "Get one accessible job with bounded descriptionText, scoringNote, progression mode/autoProgressThreshold, stage meanings, automation flags, and active hiring-plan competencies. This is the canonical job context call before candidate ranking, fit explanation, or score interpretation.", schema: getJobSchema, handler: getJobHandler },
  { name: "create_or_update_job", title: "Create Or Update Job", description: "Create a draft job or update safe job fields. Requires company owner/admin; no billing or admin routes.", schema: createOrUpdateJobSchema, handler: createOrUpdateJobHandler },
  { name: "set_job_status", title: "Set Job Status", description: "Set one job status through the restricted non-admin status contract. Requires company owner/admin.", schema: setJobStatusSchema, handler: setJobStatusHandler },
  { name: "list_applications", title: "List Applications", description: "List candidate applications for one accessible job. Responses include resumeMatchScorePercent/applicationMatchScorePercent from AI resume screening when present, interviewScore/interviewScorePercent from scored interview competency assessments when present, and bounded aiScreeningContext highlights; filter by stageId plus minMatchScore/maxMatchScore for prompts like candidates in the application column with match over 40%.", schema: listApplicationsSchema, handler: listApplicationsHandler },
  { name: "get_interview_report", title: "Get Interview Report", description: "Report interview completion for one accessible job. Completed interviews are duration-based: effective call duration >= 120 seconds, using Interview.totalDurationSeconds before summed session durations.", schema: getInterviewReportSchema, handler: getInterviewReportHandler },
  { name: "get_pipeline_report", title: "Get Pipeline Report", description: "Report current pipeline counts and stage conversion metrics for one accessible job. Talented columns are stages; responses include stageId, columnId, names, order, and stageType.", schema: getPipelineReportSchema, handler: getPipelineReportHandler },
  { name: "get_candidate_activity_report", title: "Get Candidate Activity Report", description: "Report date-range candidate activity for one accessible job: applications created, stage entries/exits, interviews created, completed interviews, and note counts without note content.", schema: getCandidateActivityReportSchema, handler: getCandidateActivityReportHandler },
  { name: "get_application", title: "Get Application", description: "Get one accessible application with candidate, current stage, resumeMatchScorePercent/applicationMatchScorePercent, separate interviewScore/interviewScorePercent, and bounded aiScreeningContext. Does not return full resume text by default.", schema: getApplicationSchema, handler: getApplicationHandler },
  { name: "get_transcript", title: "Get Transcript", description: "Fetch the full interview transcript(s) for one application. This is a separate call from get_application, which never includes transcript text. Returns each interview's combined transcript (VAPI voice screens, or reconstructed from the message log for text interviews), the transcriptSource, per-session metadata (duration, ended reason, recording URL), effective duration, and completion status. Transcripts can be long, so call this only when you need the actual conversation content.", schema: getTranscriptSchema, handler: getTranscriptHandler },
  { name: "create_application", title: "Create Application", description: "Create one candidate/application in a job. No bulk creation.", schema: createApplicationSchema, handler: createApplicationHandler },
  { name: "move_application_stage", title: "Move Application Stage", description: "Move one application to a valid stage in the same job. No bulk movement.", schema: moveApplicationStageSchema, handler: moveApplicationStageHandler },
  { name: "move_candidate_to_stage", title: "Move Candidate To Stage", description: "Friendly alias for moving one candidate application to one valid Talented stage/column. Requires applicationId and does not support bulk movement.", schema: moveCandidateToStageSchema, handler: moveCandidateToStageHandler },
  { name: "reject_application", title: "Reject Application", description: "Reject one application through the ATS service.", schema: rejectApplicationSchema, handler: rejectApplicationHandler },
  { name: "unreject_application", title: "Unreject Application", description: "Unreject one application.", schema: unrejectApplicationSchema, handler: unrejectApplicationHandler },
  { name: "get_candidate", title: "Get Candidate", description: "Get one accessible candidate.", schema: getCandidateSchema, handler: getCandidateHandler },
  { name: "add_candidate_note", title: "Add Candidate Note", description: "Append one dashboard-visible candidate note.", schema: addCandidateNoteSchema, handler: addCandidateNoteHandler },
  { name: "send_candidate_sms", title: "Send Candidate SMS", description: "Send one one-off SMS to one candidate's phone number on file. No bulk sends and no arbitrary phone numbers.", schema: sendCandidateSmsSchema, handler: sendCandidateSmsHandler },
  { name: "update_candidate_status", title: "Update Candidate Status", description: "Update candidate status and/or favorite flag.", schema: updateCandidateStatusSchema, handler: updateCandidateStatusHandler }
];

export function registerTools(server: McpServer, client: TalentedClient): void {
  for (const tool of registrations) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.schema
      },
      async (input, extra) => tool.handler(input, extra.authInfo, client)
    );
  }
}

export const toolNames = registrations.map((tool) => tool.name);
