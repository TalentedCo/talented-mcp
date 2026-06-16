import { describe, expect, it } from "vitest";
import {
  registerTools,
  listApplicationsSchema,
  createCompanySchema,
  createJobSchema,
  toolNames
} from "@/lib/tools";
import type { TalentedClient } from "@/lib/talented-client";

function registerAndCollect() {
  const registered: Array<{ name: string; config: { description?: string } }> = [];
  const server = {
    registerTool: (name: string, config: { description?: string }) => {
      registered.push({ name, config });
    }
  };
  registerTools(server as unknown as Parameters<typeof registerTools>[0], {} as TalentedClient);
  return registered;
}

describe("registered tool list", () => {
  it("includes the safe Talented v1 MCP tools", () => {
    expect(toolNames).toEqual([
      "list_companies",
      "get_company",
      "create_company",
      "list_jobs",
      "get_job",
      "create_or_update_job",
      "create_job",
      "set_job_status",
      "list_applications",
      "get_interview_report",
      "get_pipeline_report",
      "get_candidate_activity_report",
      "get_application",
      "get_transcript",
      "create_application",
      "move_application_stage",
      "move_candidate_to_stage",
      "reject_application",
      "unreject_application",
      "get_candidate",
      "add_candidate_note",
      "send_candidate_sms",
      "update_candidate_status",
      "list_interviews",
      "get_interview",
      "cancel_interview",
      "regenerate_interview",
      "resend_interview_invite",
      "send_candidate_email",
      "get_candidate_notes",
      "bulk_move_applications",
      "get_reliability_report"
    ]);
  });

  it("scopes SMS sends to a candidate's phone on file", () => {
    const registered: Array<{ name: string; config: { description?: string } }> = [];
    const server = {
      registerTool: (name: string, config: { description?: string }) => {
        registered.push({ name, config });
      }
    };

    registerTools(server as unknown as Parameters<typeof registerTools>[0], {} as TalentedClient);

    const sendSms = registered.find((tool) => tool.name === "send_candidate_sms");
    expect(sendSms?.config.description).toContain("phone number on file");
    expect(sendSms?.config.description).toContain("No bulk sends");
  });

  it("documents separate resume match and interview score fields on application tools", () => {
    const registered: Array<{ name: string; config: { description?: string } }> = [];
    const server = {
      registerTool: (name: string, config: { description?: string }) => {
        registered.push({ name, config });
      }
    };

    registerTools(server as unknown as Parameters<typeof registerTools>[0], {} as TalentedClient);

    const listApplications = registered.find((tool) => tool.name === "list_applications");
    const getApplication = registered.find((tool) => tool.name === "get_application");

    expect(listApplications?.config.description).toContain("resumeMatchScorePercent");
    expect(listApplications?.config.description).toContain("interviewScorePercent");
    expect(listApplications?.config.description).toContain("minMatchScore");
    expect(getApplication?.config.description).toContain("Does not return full resume text");
  });

  it("documents compact job lists and get_job as the detailed context call", () => {
    const registered: Array<{ name: string; config: { description?: string } }> = [];
    const server = {
      registerTool: (name: string, config: { description?: string }) => {
        registered.push({ name, config });
      }
    };

    registerTools(server as unknown as Parameters<typeof registerTools>[0], {} as TalentedClient);

    const listJobs = registered.find((tool) => tool.name === "list_jobs");
    const getJob = registered.find((tool) => tool.name === "get_job");

    expect(listJobs?.config.description).toContain("token-optimized");
    expect(listJobs?.config.description).toContain("bounded descriptionPreview");
    expect(listJobs?.config.description).toContain("no full HTML job description");
    expect(listJobs?.config.description).toContain("Call get_job before ranking candidates");
    expect(getJob?.config.description).toContain("scoringNote");
    expect(getJob?.config.description).toContain("autoProgressThreshold");
    expect(getJob?.config.description).toContain("active hiring-plan competencies");
    expect(getJob?.config.description).toContain("canonical job context call");
  });

  it("accepts application match-score filters in the tool schema", () => {
    expect(listApplicationsSchema.minMatchScore.safeParse(40).success).toBe(true);
    expect(listApplicationsSchema.maxMatchScore.safeParse(90).success).toBe(true);
    expect(listApplicationsSchema.minMatchScore.safeParse(-1).success).toBe(false);
    expect(listApplicationsSchema.maxMatchScore.safeParse(101).success).toBe(false);
  });

  it("documents that create_company makes the caller OWNER and emails invitations", () => {
    const createCompany = registerAndCollect().find((tool) => tool.name === "create_company");
    expect(createCompany?.config.description).toContain("OWNER");
    expect(createCompany?.config.description).toContain("email invitation");
  });

  it("documents that create_job defaults to draft and warns before publishing", () => {
    const createJob = registerAndCollect().find((tool) => tool.name === "create_job");
    expect(createJob?.config.description).toContain("create-job wizard");
    expect(createJob?.config.description).toContain("created as DRAFT");
    expect(createJob?.config.description).toContain("confirming with the user");
    expect(createJob?.config.description).toContain("competencies");
  });

  it("validates create_company invite roles and create_job thresholds", () => {
    expect(createCompanySchema.name.safeParse("Acme").success).toBe(true);
    expect(createCompanySchema.name.safeParse("").success).toBe(false);
    const invites = createCompanySchema.invites;
    expect(invites.safeParse([{ email: "a@b.com", role: "ADMIN" }]).success).toBe(true);
    expect(invites.safeParse([{ email: "a@b.com", role: "OWNER" }]).success).toBe(false);
    expect(invites.safeParse([{ email: "not-an-email" }]).success).toBe(false);

    expect(createJobSchema.autoProgressThreshold.safeParse(70).success).toBe(true);
    expect(createJobSchema.autoProgressThreshold.safeParse(101).success).toBe(false);
    expect(createJobSchema.inviteMode.safeParse("AI_SCREEN").success).toBe(true);
    expect(createJobSchema.inviteMode.safeParse("NONSENSE").success).toBe(false);
  });
});
