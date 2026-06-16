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
const confirmEmail = z
  .string()
  .email()
  .describe(
    "REQUIRED. The candidate's email on file, to confirm you're contacting the right person. The API rejects the call if it doesn't match the candidate record. ALWAYS fetch the candidate/application/interview first (get_candidate/get_application/get_interview) and pass the exact email you saw — never guess."
  );
const confirmCompanyId = id.optional().describe("Optional: the candidate's company id; cross-checked against the record when provided.");

// Builds the recipient-assertion fields forwarded into a guarded write request body.
function confirmBody(input: { confirmEmail: string; companyId?: number }) {
  return { confirmEmail: input.confirmEmail, ...(input.companyId !== undefined ? { companyId: input.companyId } : {}) };
}

const SAFETY_NOTE = " Safety: you must pass confirmEmail matching the candidate on file; the send/action is rejected on mismatch.";
const isoDateOrDateTime = z
  .string()
  .min(1)
  .describe("ISO date or datetime. Date-only values are interpreted by the Talented Agent API as UTC boundaries.");
const expand = z
  .string()
  .optional()
  .describe("Comma-separated detail sections to expand, or 'true'/'all' for full detail. Responses are compact by default to stay token-efficient.");

function reportQuery(
  input: {
    from?: string;
    to?: string;
    stageId?: number;
    interviewTypeId?: number;
    includeRejected?: boolean;
    expand?: string;
  },
  keys: Array<"from" | "to" | "stageId" | "interviewTypeId" | "includeRejected" | "expand">
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

export const createCompanySchema = {
  name: z.string().min(1).describe("Company name (required). A unique URL slug is generated from it."),
  description: z.string().optional().describe("Short company description / about blurb."),
  website: z.string().optional().describe("Company website. A bare domain like 'acme.com' is auto-prefixed with https://."),
  logoUrl: z.string().optional().describe("Absolute URL to the company logo image."),
  location: z.string().optional().describe("Primary location, e.g. 'San Francisco, CA'."),
  industry: z.string().optional().describe("Industry, e.g. 'Technology', 'Healthcare'."),
  size: z.string().optional().describe("Headcount band, e.g. '1-10', '11-50', '51-200', '1000+'."),
  timezone: z.string().optional().describe("IANA timezone, e.g. 'America/Los_Angeles'. Defaults to the company default if omitted."),
  invites: z
    .array(
      z.object({
        email: z.string().email().describe("Teammate email to invite."),
        role: z
          .enum(["ADMIN", "MEMBER"])
          .optional()
          .describe("Invite role. Defaults to MEMBER. OWNER is reserved for you, the creator.")
      })
    )
    .optional()
    .describe(
      "Teammates to invite. Each receives an email invitation they must accept — existing Talented users get an 'accept invite' link, new emails a registration link. Nobody is silently added."
    )
};
export async function createCompanyHandler(input: z.infer<z.ZodObject<typeof createCompanySchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", "/api/agent/v1/companies", input);
}

export const listJobsSchema = {
  companyId: id.describe("Company ID."),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
  search: z.string().optional(),
  includeArchived: z.boolean().optional(),
  expand
};
export async function listJobsHandler(input: z.infer<z.ZodObject<typeof listJobsSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const params = new URLSearchParams();
  if (input.status) params.set("status", input.status);
  if (input.search) params.set("search", input.search);
  if (input.includeArchived) params.set("includeArchived", "true");
  if (input.expand) params.set("expand", input.expand);
  const qs = params.toString();
  return call(auth, client, "GET", `/api/agent/v1/companies/${input.companyId}/jobs${qs ? `?${qs}` : ""}`);
}

export const getJobSchema = { jobId: id.describe("Job ID."), expand };
export async function getJobHandler(input: { jobId: number; expand?: string }, auth: AuthInfo | undefined, client: TalentedClient) {
  const params = new URLSearchParams();
  if (input.expand) params.set("expand", input.expand);
  const qs = params.toString();
  return call(auth, client, "GET", `/api/agent/v1/jobs/${input.jobId}${qs ? `?${qs}` : ""}`);
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

export const createJobSchema = {
  companyId: id.describe("Company to create the job in. You must be an owner/admin of it."),
  title: z.string().min(1).describe("Job title (required)."),
  description: z
    .string()
    .optional()
    .describe(
      "Full job description (plain text or HTML). Write a complete, compelling description like the dashboard wizard would — if the user only gives a brief, draft the full posting yourself."
    ),
  department: z.string().optional().describe("e.g. 'Engineering'."),
  level: z.string().optional().describe("Seniority/level, e.g. 'Senior', 'L4'."),
  location: z.string().optional().describe("e.g. 'San Francisco, CA' or 'Remote'."),
  salaryRange: z.string().optional().describe("e.g. '$120k - $160k USD'."),
  employmentType: z.string().optional().describe("e.g. 'full-time', 'part-time', 'contract', 'internship', 'temporary'."),
  remoteOption: z.string().optional().describe("e.g. 'remote', 'hybrid', 'on-site'."),
  scoringNote: z.string().optional().describe("Internal note guiding candidate scoring. Not shown publicly."),
  equityRange: z.string().optional().describe("Equity range, e.g. '0.1% - 0.5%'."),
  visaSponsorship: z.string().optional().describe("Visa sponsorship policy text."),
  showCompensation: z.boolean().optional().describe("Show salary on the public posting. Default true."),
  showEquity: z.boolean().optional().describe("Show equity on the public posting. Default false."),
  requiresResume: z.boolean().optional().describe("Require a resume to apply. Default true."),
  requiresCoverLetter: z.boolean().optional().describe("Require a cover letter to apply. Default true."),
  allowOnlineApplications: z.boolean().optional().describe("Accept public online applications. Default false; turned on automatically when the job is published."),
  allowVoiceInterviews: z.boolean().optional().describe("Allow AI voice interviews. Default true."),
  defaultInterviewFormat: z.string().optional().describe("'voice' or 'text'. Default 'voice'."),
  inviteMode: z
    .enum(["ALL", "AI_SCREEN", "MANUAL"])
    .optional()
    .describe("How applicants progress. Default MANUAL. AI_SCREEN auto-advances applicants who pass autoProgressThreshold."),
  autoProgressThreshold: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe("0-100 AI-screen pass threshold used when inviteMode is AI_SCREEN. Default 70."),
  autoSendApplicationReceived: z.boolean().optional().describe("Auto-email applicants an application-received confirmation. Default false."),
  autoSendRejection: z.boolean().optional().describe("Auto-email rejected applicants. Default false."),
  setupAutoScreen: z
    .boolean()
    .optional()
    .describe("Create the automated Pre-Screen stage + AI interview, like the dashboard wizard. Defaults to true."),
  generateCompetencies: z
    .boolean()
    .optional()
    .describe("Auto-generate interview competencies from the title + description and attach them to the pre-screen interview. Defaults to true. Implies setupAutoScreen."),
  publish: z
    .boolean()
    .optional()
    .describe(
      "Publish the job immediately (go ACTIVE). Defaults to false — jobs are created as DRAFT. Publishing requires an active paid subscription and may incur charges, so confirm with the user before setting true. If publishing fails the job stays a draft and the reason is returned in setup.publishError; you can publish later with set_job_status."
    )
};
export async function createJobHandler(input: z.infer<z.ZodObject<typeof createJobSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const { companyId, setupAutoScreen, generateCompetencies, ...rest } = input;
  // Mirror the dashboard wizard: scaffold the pre-screen stage and generate
  // competencies by default unless the caller explicitly opts out.
  const body = {
    ...rest,
    setupAutoScreen: setupAutoScreen ?? true,
    generateCompetencies: generateCompetencies ?? true
  };
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
  search: z.string().optional(),
  expand
};
export async function listApplicationsHandler(input: z.infer<z.ZodObject<typeof listApplicationsSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const params = new URLSearchParams();
  for (const key of ["limit", "offset", "stageId", "minMatchScore", "maxMatchScore"] as const) {
    if (input[key] !== undefined) params.set(key, String(input[key]));
  }
  if (input.status) params.set("status", input.status);
  if (input.search) params.set("search", input.search);
  if (input.expand) params.set("expand", input.expand);
  const qs = params.toString();
  return call(auth, client, "GET", `/api/agent/v1/jobs/${input.jobId}/applications${qs ? `?${qs}` : ""}`);
}

export const getInterviewReportSchema = {
  jobId: id.describe("Job ID to report on. Access is limited to jobs visible to the token user."),
  from: isoDateOrDateTime.optional().describe("Inclusive lower bound for the interview end date."),
  to: isoDateOrDateTime.optional().describe("Exclusive upper bound for the interview end date."),
  stageId: id.optional().describe("Optional Talented stage/column ID to filter by."),
  interviewTypeId: id.optional().describe("Optional interview type ID to filter by."),
  expand
};
export async function getInterviewReportHandler(input: z.infer<z.ZodObject<typeof getInterviewReportSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const qs = reportQuery(input, ["from", "to", "stageId", "interviewTypeId", "expand"]);
  return call(auth, client, "GET", `/api/agent/v1/jobs/${input.jobId}/reports/interviews${qs}`);
}

export const getPipelineReportSchema = {
  jobId: id.describe("Job ID to report on. Access is limited to jobs visible to the token user."),
  from: isoDateOrDateTime.optional().describe("Inclusive lower bound for stage-entry conversion metrics."),
  to: isoDateOrDateTime.optional().describe("Exclusive upper bound for stage-entry conversion metrics."),
  stageId: id.optional().describe("Optional Talented stage/column ID to filter by."),
  includeRejected: z.boolean().optional().describe("Include rejected applications in pipeline counts."),
  expand
};
export async function getPipelineReportHandler(input: z.infer<z.ZodObject<typeof getPipelineReportSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const qs = reportQuery(input, ["from", "to", "stageId", "includeRejected", "expand"]);
  return call(auth, client, "GET", `/api/agent/v1/jobs/${input.jobId}/reports/pipeline${qs}`);
}

export const getCandidateActivityReportSchema = {
  jobId: id.describe("Job ID to report on. Access is limited to jobs visible to the token user."),
  from: isoDateOrDateTime.optional().describe("Inclusive lower bound for activity timestamps."),
  to: isoDateOrDateTime.optional().describe("Exclusive upper bound for activity timestamps."),
  stageId: id.optional().describe("Optional Talented stage/column ID to filter by."),
  expand
};
export async function getCandidateActivityReportHandler(input: z.infer<z.ZodObject<typeof getCandidateActivityReportSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const qs = reportQuery(input, ["from", "to", "stageId", "expand"]);
  return call(auth, client, "GET", `/api/agent/v1/jobs/${input.jobId}/reports/activity${qs}`);
}

export const getApplicationSchema = {
  applicationId: id.describe("Application ID visible to the token user."),
  expand
};
export async function getApplicationHandler(input: { applicationId: number; expand?: string }, auth: AuthInfo | undefined, client: TalentedClient) {
  const params = new URLSearchParams();
  if (input.expand) params.set("expand", input.expand);
  const qs = params.toString();
  return call(auth, client, "GET", `/api/agent/v1/applications/${input.applicationId}${qs ? `?${qs}` : ""}`);
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

export const moveApplicationStageSchema = { applicationId: id, stageId: id, confirmEmail, companyId: confirmCompanyId };
export async function moveApplicationStageHandler(input: z.infer<z.ZodObject<typeof moveApplicationStageSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", `/api/agent/v1/applications/${input.applicationId}/stage`, { stageId: input.stageId, ...confirmBody(input) });
}

export const moveCandidateToStageSchema = {
  applicationId: id.describe("Application ID for the candidate/job pair to move. Required because one candidate can have multiple applications."),
  stageId: id.describe("Destination Talented stage/column ID in the same job."),
  confirmEmail,
  companyId: confirmCompanyId
};
export async function moveCandidateToStageHandler(input: z.infer<z.ZodObject<typeof moveCandidateToStageSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return moveApplicationStageHandler(input, auth, client);
}

export const rejectApplicationSchema = { applicationId: id, reason: z.string().optional(), confirmEmail, companyId: confirmCompanyId };
export async function rejectApplicationHandler(input: z.infer<z.ZodObject<typeof rejectApplicationSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", `/api/agent/v1/applications/${input.applicationId}/reject`, { reason: input.reason, ...confirmBody(input) });
}

export const unrejectApplicationSchema = { applicationId: id, confirmEmail, companyId: confirmCompanyId };
export async function unrejectApplicationHandler(input: z.infer<z.ZodObject<typeof unrejectApplicationSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", `/api/agent/v1/applications/${input.applicationId}/unreject`, confirmBody(input));
}

export const getCandidateSchema = { candidateId: id, expand };
export async function getCandidateHandler(input: { candidateId: number; expand?: string }, auth: AuthInfo | undefined, client: TalentedClient) {
  const params = new URLSearchParams();
  if (input.expand) params.set("expand", input.expand);
  const qs = params.toString();
  return call(auth, client, "GET", `/api/agent/v1/candidates/${input.candidateId}${qs ? `?${qs}` : ""}`);
}

export const addCandidateNoteSchema = { candidateId: id, content: z.string().min(1), confirmEmail, companyId: confirmCompanyId };
export async function addCandidateNoteHandler(input: z.infer<z.ZodObject<typeof addCandidateNoteSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", `/api/agent/v1/candidates/${input.candidateId}/notes`, { content: input.content, ...confirmBody(input) });
}

export const sendCandidateSmsSchema = {
  candidateId: id.describe("Candidate ID to text. The phone number always comes from the candidate record; arbitrary numbers cannot be messaged."),
  body: z.string().min(1).max(640).describe("SMS message body, 640 characters max."),
  confirmEmail,
  companyId: confirmCompanyId
};
export async function sendCandidateSmsHandler(input: z.infer<z.ZodObject<typeof sendCandidateSmsSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", `/api/agent/v1/candidates/${input.candidateId}/sms`, { body: input.body, ...confirmBody(input) });
}

export const updateCandidateStatusSchema = {
  candidateId: id,
  status: z.enum(["NEW", "CONTACTED", "INTERVIEWING", "HIRED", "REJECTED"]).optional(),
  isFavorite: z.boolean().optional(),
  confirmEmail,
  companyId: confirmCompanyId
};
export async function updateCandidateStatusHandler(input: z.infer<z.ZodObject<typeof updateCandidateStatusSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const { candidateId, confirmEmail: _confirmEmail, companyId: _companyId, ...body } = input;
  return call(auth, client, "PATCH", `/api/agent/v1/candidates/${candidateId}`, { ...body, ...confirmBody(input) });
}

export const listInterviewsSchema = {
  jobId: id.describe("Job ID. Access is limited to jobs visible to the token user."),
  stageId: id.optional().describe("Optional Talented stage/column ID to filter by."),
  interviewTypeId: id.optional().describe("Optional interview type ID to filter by."),
  status: z
    .enum(["not_started", "in_progress", "completed", "failed", "cancelled"])
    .optional()
    .describe("Filter by interview status."),
  failedOnly: z.boolean().optional().describe("Only return interviews that crashed on a pipeline/technical error."),
  from: isoDateOrDateTime.optional().describe("Inclusive lower bound for the interview window."),
  to: isoDateOrDateTime.optional().describe("Exclusive upper bound for the interview window."),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  expand
};
export async function listInterviewsHandler(input: z.infer<z.ZodObject<typeof listInterviewsSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const params = new URLSearchParams();
  for (const key of ["stageId", "interviewTypeId", "limit", "offset"] as const) {
    if (input[key] !== undefined) params.set(key, String(input[key]));
  }
  if (input.status) params.set("status", input.status);
  if (input.failedOnly !== undefined) params.set("failedOnly", String(input.failedOnly));
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.expand) params.set("expand", input.expand);
  const qs = params.toString();
  return call(auth, client, "GET", `/api/agent/v1/jobs/${input.jobId}/interviews${qs ? `?${qs}` : ""}`);
}

export const getInterviewSchema = {
  interviewId: id.describe("Interview ID visible to the token user."),
  expand
};
export async function getInterviewHandler(input: { interviewId: number; expand?: string }, auth: AuthInfo | undefined, client: TalentedClient) {
  const params = new URLSearchParams();
  if (input.expand) params.set("expand", input.expand);
  const qs = params.toString();
  return call(auth, client, "GET", `/api/agent/v1/interviews/${input.interviewId}${qs ? `?${qs}` : ""}`);
}

export const cancelInterviewSchema = {
  interviewId: id.describe("Interview ID to cancel."),
  reason: z.string().optional().describe("Optional reason recorded against the cancellation."),
  confirmEmail,
  companyId: confirmCompanyId
};
export async function cancelInterviewHandler(input: z.infer<z.ZodObject<typeof cancelInterviewSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", `/api/agent/v1/interviews/${input.interviewId}/cancel`, { reason: input.reason, ...confirmBody(input) });
}

export const regenerateInterviewSchema = {
  interviewId: id.describe("Interview ID to release and regenerate."),
  confirmEmail,
  companyId: confirmCompanyId
};
export async function regenerateInterviewHandler(input: z.infer<z.ZodObject<typeof regenerateInterviewSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", `/api/agent/v1/interviews/${input.interviewId}/regenerate`, confirmBody(input));
}

export const resendInterviewInviteSchema = {
  interviewId: id.describe("Interview ID whose invite email should be re-sent."),
  confirmEmail,
  companyId: confirmCompanyId
};
export async function resendInterviewInviteHandler(input: z.infer<z.ZodObject<typeof resendInterviewInviteSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", `/api/agent/v1/interviews/${input.interviewId}/resend`, confirmBody(input));
}

export const sendCandidateEmailSchema = {
  candidateId: id.describe("Candidate ID to email. Mail is sent from the company identity to the candidate's address on file."),
  subject: z.string().min(1).describe("Email subject line."),
  body: z.string().min(1).describe("Email body."),
  confirmEmail,
  companyId: confirmCompanyId
};
export async function sendCandidateEmailHandler(input: z.infer<z.ZodObject<typeof sendCandidateEmailSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", `/api/agent/v1/candidates/${input.candidateId}/email`, { subject: input.subject, body: input.body, ...confirmBody(input) });
}

export const getCandidateNotesSchema = {
  candidateId: id.describe("Candidate ID whose dashboard-visible notes to read.")
};
export async function getCandidateNotesHandler(input: { candidateId: number }, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "GET", `/api/agent/v1/candidates/${input.candidateId}/notes`);
}

export const bulkMoveApplicationsSchema = {
  jobId: id.describe("Job ID the applications belong to."),
  applicationIds: z.array(id).min(1).max(100).describe("Application IDs to move (1-100)."),
  stageId: id.describe("Destination Talented stage/column ID in the same job."),
  confirmEmails: z
    .array(z.string().email())
    .optional()
    .describe("Optional: candidate emails aligned by index to applicationIds; each is verified against its application's candidate when provided.")
};
export async function bulkMoveApplicationsHandler(input: z.infer<z.ZodObject<typeof bulkMoveApplicationsSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  return call(auth, client, "POST", `/api/agent/v1/jobs/${input.jobId}/applications/bulk-move`, {
    applicationIds: input.applicationIds,
    stageId: input.stageId,
    ...(input.confirmEmails !== undefined ? { confirmEmails: input.confirmEmails } : {})
  });
}

export const getReliabilityReportSchema = {
  jobId: id.describe("Job ID to report on. Access is limited to jobs visible to the token user."),
  from: isoDateOrDateTime.optional().describe("Inclusive lower bound for the reliability window."),
  to: isoDateOrDateTime.optional().describe("Exclusive upper bound for the reliability window."),
  interval: z.enum(["day", "week"]).optional().describe("Bucket interval for the reliability series.")
};
export async function getReliabilityReportHandler(input: z.infer<z.ZodObject<typeof getReliabilityReportSchema>>, auth: AuthInfo | undefined, client: TalentedClient) {
  const params = new URLSearchParams();
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.interval) params.set("interval", input.interval);
  const qs = params.toString();
  return call(auth, client, "GET", `/api/agent/v1/jobs/${input.jobId}/reports/reliability${qs ? `?${qs}` : ""}`);
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
  { name: "create_company", title: "Create Company", description: "Create a new company owned by you (the token user) and optionally invite teammates by email. You automatically become the company OWNER. Only the name is required; description, website, logo, location, industry, size, and timezone are optional. Each invited teammate receives an email invitation they must accept (existing Talented users included) — nobody is silently added. Requires the agent:write scope.", schema: createCompanySchema, handler: createCompanyHandler },
  { name: "list_jobs", title: "List Jobs", description: "List compact jobs in one accessible company, with safe filters. Responses are token-optimized: bounded descriptionPreview, counts, progression/hiring-plan summary, and no full HTML job description, question text, or competency bodies. Call get_job before ranking candidates or explaining fit. Responses are compact by default; pass expand for full detail.", schema: listJobsSchema, handler: listJobsHandler },
  { name: "get_job", title: "Get Job", description: "Get one accessible job with bounded descriptionText, scoringNote, progression mode/autoProgressThreshold, stage meanings, automation flags, and active hiring-plan competencies. This is the canonical job context call before candidate ranking, fit explanation, or score interpretation. Responses are compact by default; pass expand for full detail.", schema: getJobSchema, handler: getJobHandler },
  { name: "create_or_update_job", title: "Create Or Update Job", description: "Update safe fields on an existing job, or quickly create a bare draft job. For a full wizard-style new job posting (competency generation, pre-screen setup, optional publish), prefer create_job. Requires company owner/admin; no billing or admin routes.", schema: createOrUpdateJobSchema, handler: createOrUpdateJobHandler },
  { name: "create_job", title: "Create Job", description: "Post a new job, equivalent to the dashboard's create-job wizard. Provide as much as you can: title (required) plus description, department, level, location, salary, employment type, remote option, and application/interview settings. Write a complete, compelling job description yourself when the user only gives a brief. By default it scaffolds the automated Pre-Screen stage and generates interview competencies from the description (pass setupAutoScreen=false or generateCompetencies=false to skip). Jobs are created as DRAFT; set publish=true ONLY after confirming with the user, because publishing requires an active paid subscription and may incur charges — if it can't publish, the job stays a draft and the reason comes back in setup.publishError. Requires company owner/admin.", schema: createJobSchema, handler: createJobHandler },
  { name: "set_job_status", title: "Set Job Status", description: "Set one job status through the restricted non-admin status contract. Requires company owner/admin.", schema: setJobStatusSchema, handler: setJobStatusHandler },
  { name: "list_applications", title: "List Applications", description: "List candidate applications for one accessible job. Responses include resumeMatchScorePercent/applicationMatchScorePercent from AI resume screening when present, interviewScore/interviewScorePercent from scored interview competency assessments when present, and bounded aiScreeningContext highlights; filter by stageId plus minMatchScore/maxMatchScore for prompts like candidates in the application column with match over 40%. Responses are compact by default; pass expand for full detail.", schema: listApplicationsSchema, handler: listApplicationsHandler },
  { name: "get_interview_report", title: "Get Interview Report", description: "Report interview completion for one accessible job. Completed interviews are duration-based: effective call duration >= 120 seconds, using Interview.totalDurationSeconds before summed session durations. Responses are compact by default; pass expand for full detail.", schema: getInterviewReportSchema, handler: getInterviewReportHandler },
  { name: "get_pipeline_report", title: "Get Pipeline Report", description: "Report current pipeline counts and stage conversion metrics for one accessible job. Talented columns are stages; responses include stageId, columnId, names, order, and stageType. Responses are compact by default; pass expand for full detail.", schema: getPipelineReportSchema, handler: getPipelineReportHandler },
  { name: "get_candidate_activity_report", title: "Get Candidate Activity Report", description: "Report date-range candidate activity for one accessible job: applications created, stage entries/exits, interviews created, completed interviews, and note counts without note content. Responses are compact by default; pass expand for full detail.", schema: getCandidateActivityReportSchema, handler: getCandidateActivityReportHandler },
  { name: "get_application", title: "Get Application", description: "Get one accessible application with candidate, current stage, resumeMatchScorePercent/applicationMatchScorePercent, separate interviewScore/interviewScorePercent, and bounded aiScreeningContext. Does not return full resume text by default. Responses are compact by default; pass expand for full detail.", schema: getApplicationSchema, handler: getApplicationHandler },
  { name: "get_transcript", title: "Get Transcript", description: "Fetch the full interview transcript(s) for one application. This is a separate call from get_application, which never includes transcript text. Returns each interview's combined transcript (VAPI voice screens, or reconstructed from the message log for text interviews), the transcriptSource, per-session metadata (duration, ended reason, recording URL), effective duration, and completion status. Transcripts can be long, so call this only when you need the actual conversation content.", schema: getTranscriptSchema, handler: getTranscriptHandler },
  { name: "create_application", title: "Create Application", description: "Create one candidate/application in a job. No bulk creation.", schema: createApplicationSchema, handler: createApplicationHandler },
  { name: "move_application_stage", title: "Move Application Stage", description: "Move one application to a valid stage in the same job. No bulk movement." + SAFETY_NOTE, schema: moveApplicationStageSchema, handler: moveApplicationStageHandler },
  { name: "move_candidate_to_stage", title: "Move Candidate To Stage", description: "Friendly alias for moving one candidate application to one valid Talented stage/column. Requires applicationId and does not support bulk movement." + SAFETY_NOTE, schema: moveCandidateToStageSchema, handler: moveCandidateToStageHandler },
  { name: "reject_application", title: "Reject Application", description: "Reject one application through the ATS service." + SAFETY_NOTE, schema: rejectApplicationSchema, handler: rejectApplicationHandler },
  { name: "unreject_application", title: "Unreject Application", description: "Unreject one application." + SAFETY_NOTE, schema: unrejectApplicationSchema, handler: unrejectApplicationHandler },
  { name: "get_candidate", title: "Get Candidate", description: "Get one accessible candidate. Responses are compact by default; pass expand for full detail.", schema: getCandidateSchema, handler: getCandidateHandler },
  { name: "add_candidate_note", title: "Add Candidate Note", description: "Append one dashboard-visible candidate note." + SAFETY_NOTE, schema: addCandidateNoteSchema, handler: addCandidateNoteHandler },
  { name: "send_candidate_sms", title: "Send Candidate SMS", description: "Send one one-off SMS to one candidate's phone number on file. No bulk sends and no arbitrary phone numbers." + SAFETY_NOTE, schema: sendCandidateSmsSchema, handler: sendCandidateSmsHandler },
  { name: "update_candidate_status", title: "Update Candidate Status", description: "Update candidate status and/or favorite flag." + SAFETY_NOTE, schema: updateCandidateStatusSchema, handler: updateCandidateStatusHandler },
  { name: "list_interviews", title: "List Interviews", description: "List interviews for a job with health (status, technicalFailure, endedReason), candidate link, and score; filter failedOnly=true to find interviews that crashed on a pipeline error. Responses are compact by default; pass expand for full detail.", schema: listInterviewsSchema, handler: listInterviewsHandler },
  { name: "get_interview", title: "Get Interview", description: "One interview with link, endedReason, technicalFailure, and (when expanded) per-competency scorecard + per-session breakdown. Responses are compact by default; pass expand for full detail.", schema: getInterviewSchema, handler: getInterviewHandler },
  { name: "cancel_interview", title: "Cancel Interview", description: "Cancels/abandons an interview. Requires the agent:write scope." + SAFETY_NOTE, schema: cancelInterviewSchema, handler: cancelInterviewHandler },
  { name: "regenerate_interview", title: "Regenerate Interview", description: "Releases a started-but-failed or stale interview and mints a fresh interview + link on the same stage. Use when a candidate's interview crashed (custom-llm-400) and you need a new link. Requires the agent:write scope." + SAFETY_NOTE, schema: regenerateInterviewSchema, handler: regenerateInterviewHandler },
  { name: "resend_interview_invite", title: "Resend Interview Invite", description: "Re-sends the interview invite email. Requires the agent:write scope." + SAFETY_NOTE, schema: resendInterviewInviteSchema, handler: resendInterviewInviteHandler },
  { name: "send_candidate_email", title: "Send Candidate Email", description: "Sends a free-form email (subject+body) to one candidate from the company identity. Requires the agent:write scope." + SAFETY_NOTE, schema: sendCandidateEmailSchema, handler: sendCandidateEmailHandler },
  { name: "get_candidate_notes", title: "Get Candidate Notes", description: "Reads dashboard-visible candidate notes (the read side of add_candidate_note).", schema: getCandidateNotesSchema, handler: getCandidateNotesHandler },
  { name: "bulk_move_applications", title: "Bulk Move Applications", description: "Moves multiple applications to one stage in a single call. Requires the agent:write scope.", schema: bulkMoveApplicationsSchema, handler: bulkMoveApplicationsHandler },
  { name: "get_reliability_report", title: "Get Reliability Report", description: "Interview reliability over time — pipeline-error/technical-failure rate vs clean completions, to catch infra regressions.", schema: getReliabilityReportSchema, handler: getReliabilityReportHandler }
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
