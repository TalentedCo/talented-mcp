import { describe, expect, it, vi } from "vitest";
import {
  getCandidateActivityReportHandler,
  getInterviewReportHandler,
  getPipelineReportHandler,
  moveCandidateToStageHandler,
  toolNames
} from "@/lib/tools";

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
      "get_application",
      "create_application",
      "move_application_stage",
      "move_candidate_to_stage",
      "get_interview_report",
      "get_pipeline_report",
      "get_stage_conversion_report",
      "get_candidate_activity_report",
      "reject_application",
      "unreject_application",
      "get_candidate",
      "add_candidate_note",
      "update_candidate_status"
    ]);
  });

  it("calls the interview report Agent API path with report filters", async () => {
    const client = {
      request: vi.fn().mockResolvedValue({ report: "interviews" })
    };

    await getInterviewReportHandler(
      {
        companyId: 10,
        from: "2026-06-01",
        to: "2026-06-08",
        jobId: 20,
        stageId: 30,
        groupBy: "stage"
      },
      { token: "tal_test" } as never,
      client as never
    );

    expect(client.request).toHaveBeenCalledWith(
      "tal_test",
      "GET",
      "/api/agent/v1/companies/10/reports/interviews?from=2026-06-01&to=2026-06-08&jobId=20&stageId=30&groupBy=stage",
      undefined
    );
  });

  it("calls pipeline and activity report paths with structured filters", async () => {
    const client = {
      request: vi.fn().mockResolvedValue({ ok: true })
    };
    const auth = { token: "tal_test" } as never;

    await getPipelineReportHandler(
      {
        companyId: 10,
        from: "2026-06-01",
        to: "2026-06-08",
        includeRejected: true
      },
      auth,
      client as never
    );
    await getCandidateActivityReportHandler(
      {
        companyId: 10,
        groupBy: "job"
      },
      auth,
      client as never
    );

    expect(client.request).toHaveBeenNthCalledWith(
      1,
      "tal_test",
      "GET",
      "/api/agent/v1/companies/10/reports/pipeline?from=2026-06-01&to=2026-06-08&includeRejected=true",
      undefined
    );
    expect(client.request).toHaveBeenNthCalledWith(
      2,
      "tal_test",
      "GET",
      "/api/agent/v1/companies/10/reports/activity?groupBy=job",
      undefined
    );
  });

  it("keeps the friendly movement alias one application at a time", async () => {
    const client = {
      request: vi.fn().mockResolvedValue({ application: { id: 88 } })
    };

    await moveCandidateToStageHandler(
      { applicationId: 88, stageId: 30 },
      { token: "tal_test" } as never,
      client as never
    );

    expect(client.request).toHaveBeenCalledWith(
      "tal_test",
      "POST",
      "/api/agent/v1/applications/88/stage",
      { stageId: 30 }
    );
  });
});
