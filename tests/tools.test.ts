import { describe, expect, it } from "vitest";
import { registerTools, listApplicationsSchema, toolNames } from "@/lib/tools";
import type { TalentedClient } from "@/lib/talented-client";

describe("registered tool list", () => {
  it("includes the safe Talented v1 MCP tools", () => {
    expect(toolNames).toEqual([
      "list_companies",
      "get_company",
      "list_jobs",
      "get_job",
      "create_or_update_job",
      "set_job_status",
      "list_applications",
      "get_interview_report",
      "get_pipeline_report",
      "get_candidate_activity_report",
      "get_application",
      "create_application",
      "move_application_stage",
      "move_candidate_to_stage",
      "reject_application",
      "unreject_application",
      "get_candidate",
      "add_candidate_note",
      "update_candidate_status"
    ]);
  });

  it("documents separate resume match and interview score fields on application tools", () => {
    const registered: Array<{ name: string; config: { description?: string } }> = [];
    const server = {
      registerTool: (name: string, config: { description?: string }) => {
        registered.push({ name, config });
      }
    };

    registerTools(server as never, {} as TalentedClient);

    const listApplications = registered.find((tool) => tool.name === "list_applications");
    const getApplication = registered.find((tool) => tool.name === "get_application");

    expect(listApplications?.config.description).toContain("resumeMatchScorePercent");
    expect(listApplications?.config.description).toContain("interviewScorePercent");
    expect(listApplications?.config.description).toContain("minMatchScore");
    expect(getApplication?.config.description).toContain("Does not return full resume text");
  });

  it("accepts application match-score filters in the tool schema", () => {
    expect(listApplicationsSchema.minMatchScore.safeParse(40).success).toBe(true);
    expect(listApplicationsSchema.maxMatchScore.safeParse(90).success).toBe(true);
    expect(listApplicationsSchema.minMatchScore.safeParse(-1).success).toBe(false);
    expect(listApplicationsSchema.maxMatchScore.safeParse(101).success).toBe(false);
  });
});
