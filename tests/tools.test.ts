import { describe, expect, it } from "vitest";
import { z } from "zod";
import { listApplicationsSchema, toolDefinitions, toolNames } from "@/lib/tools";

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

  it("documents application match and interview score fields", () => {
    const listApplications = toolDefinitions.find(
      (tool) => tool.name === "list_applications"
    );
    const getApplication = toolDefinitions.find(
      (tool) => tool.name === "get_application"
    );

    expect(listApplications?.description).toContain("resumeMatchScorePercent");
    expect(listApplications?.description).toContain("interviewScore");
    expect(listApplications?.description).toContain("minMatchScore/maxMatchScore");
    expect(getApplication?.description).toContain("bounded aiScreeningSummary");
  });

  it("accepts match-score filter inputs for list_applications", () => {
    const parsed = z.object(listApplicationsSchema).parse({
      jobId: 20,
      stageId: 100,
      minMatchScore: 40,
      maxMatchScore: 85,
    });

    expect(parsed).toMatchObject({
      jobId: 20,
      stageId: 100,
      minMatchScore: 40,
      maxMatchScore: 85,
    });
  });
});
