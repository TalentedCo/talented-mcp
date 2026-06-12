import { describe, expect, it, vi } from "vitest";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { TalentedClient } from "@/lib/talented-client";
import {
  getCandidateActivityReportHandler,
  listApplicationsHandler,
  getInterviewReportHandler,
  getPipelineReportHandler,
  moveCandidateToStageHandler
} from "@/lib/tools";

function fakeClient() {
  const request = vi.fn(async () => ({ ok: true }));
  return {
    client: { request } as unknown as TalentedClient,
    request
  };
}

const auth = { token: "tal_test" } as AuthInfo;

describe("report MCP tools", () => {
  it("forwards application stage and match-score filters to the Agent API", async () => {
    const { client, request } = fakeClient();

    await listApplicationsHandler(
      {
        jobId: 20,
        stageId: 100,
        minMatchScore: 40,
        maxMatchScore: 90
      },
      auth,
      client
    );

    expect(request).toHaveBeenCalledWith(
      "tal_test",
      "GET",
      "/api/agent/v1/jobs/20/applications?stageId=100&minMatchScore=40&maxMatchScore=90",
      undefined
    );
  });

  it("forwards interview report filters to the Agent API", async () => {
    const { client, request } = fakeClient();

    await getInterviewReportHandler(
      {
        jobId: 20,
        from: "2026-06-01",
        to: "2026-07-01",
        stageId: 100,
        interviewTypeId: 700
      },
      auth,
      client
    );

    expect(request).toHaveBeenCalledWith(
      "tal_test",
      "GET",
      "/api/agent/v1/jobs/20/reports/interviews?from=2026-06-01&to=2026-07-01&stageId=100&interviewTypeId=700",
      undefined
    );
  });

  it("forwards pipeline report filters including rejected applications", async () => {
    const { client, request } = fakeClient();

    await getPipelineReportHandler(
      {
        jobId: 20,
        from: "2026-06-01",
        to: "2026-07-01",
        includeRejected: true
      },
      auth,
      client
    );

    expect(request).toHaveBeenCalledWith(
      "tal_test",
      "GET",
      "/api/agent/v1/jobs/20/reports/pipeline?from=2026-06-01&to=2026-07-01&includeRejected=true",
      undefined
    );
  });

  it("forwards candidate activity report stage filters", async () => {
    const { client, request } = fakeClient();

    await getCandidateActivityReportHandler(
      {
        jobId: 20,
        stageId: 100
      },
      auth,
      client
    );

    expect(request).toHaveBeenCalledWith(
      "tal_test",
      "GET",
      "/api/agent/v1/jobs/20/reports/activity?stageId=100",
      undefined
    );
  });

  it("keeps the candidate movement alias one-at-a-time over application stage movement", async () => {
    const { client, request } = fakeClient();

    await moveCandidateToStageHandler(
      {
        applicationId: 55,
        stageId: 100
      },
      auth,
      client
    );

    expect(request).toHaveBeenCalledWith(
      "tal_test",
      "POST",
      "/api/agent/v1/applications/55/stage",
      { stageId: 100 }
    );
  });
});
