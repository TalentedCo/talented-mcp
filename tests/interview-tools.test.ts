import { describe, expect, it, vi } from "vitest";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { TalentedClient } from "@/lib/talented-client";
import {
  listInterviewsHandler,
  getInterviewHandler,
  cancelInterviewHandler,
  regenerateInterviewHandler,
  resendInterviewInviteHandler,
  sendCandidateEmailHandler,
  getCandidateNotesHandler,
  bulkMoveApplicationsHandler,
  getReliabilityReportHandler,
  listApplicationsHandler,
  getInterviewReportHandler
} from "@/lib/tools";

function fakeClient() {
  const request = vi.fn(async () => ({ ok: true }));
  return {
    client: { request } as unknown as TalentedClient,
    request
  };
}

const auth = { token: "tal_test" } as AuthInfo;

describe("interview MCP tools", () => {
  it("forwards interview list filters to the Agent API", async () => {
    const { client, request } = fakeClient();

    await listInterviewsHandler(
      {
        jobId: 20,
        stageId: 100,
        interviewTypeId: 700,
        status: "failed",
        failedOnly: true,
        from: "2026-06-01",
        to: "2026-07-01",
        limit: 25,
        offset: 5
      },
      auth,
      client
    );

    expect(request).toHaveBeenCalledWith(
      "tal_test",
      "GET",
      "/api/agent/v1/jobs/20/interviews?stageId=100&interviewTypeId=700&limit=25&offset=5&status=failed&failedOnly=true&from=2026-06-01&to=2026-07-01",
      undefined
    );
  });

  it("forwards the expand param on get_interview", async () => {
    const { client, request } = fakeClient();

    await getInterviewHandler({ interviewId: 88, expand: "all" }, auth, client);

    expect(request).toHaveBeenCalledWith(
      "tal_test",
      "GET",
      "/api/agent/v1/interviews/88?expand=all",
      undefined
    );
  });

  it("posts a cancel reason", async () => {
    const { client, request } = fakeClient();

    await cancelInterviewHandler({ interviewId: 88, reason: "no show" }, auth, client);

    expect(request).toHaveBeenCalledWith(
      "tal_test",
      "POST",
      "/api/agent/v1/interviews/88/cancel",
      { reason: "no show" }
    );
  });

  it("regenerates an interview with no body", async () => {
    const { client, request } = fakeClient();

    await regenerateInterviewHandler({ interviewId: 88 }, auth, client);

    expect(request).toHaveBeenCalledWith(
      "tal_test",
      "POST",
      "/api/agent/v1/interviews/88/regenerate",
      undefined
    );
  });

  it("resends an interview invite with no body", async () => {
    const { client, request } = fakeClient();

    await resendInterviewInviteHandler({ interviewId: 88 }, auth, client);

    expect(request).toHaveBeenCalledWith(
      "tal_test",
      "POST",
      "/api/agent/v1/interviews/88/resend",
      undefined
    );
  });

  it("sends a candidate email with subject and body", async () => {
    const { client, request } = fakeClient();

    await sendCandidateEmailHandler(
      { candidateId: 42, subject: "Next steps", body: "Hello there" },
      auth,
      client
    );

    expect(request).toHaveBeenCalledWith(
      "tal_test",
      "POST",
      "/api/agent/v1/candidates/42/email",
      { subject: "Next steps", body: "Hello there" }
    );
  });

  it("reads candidate notes", async () => {
    const { client, request } = fakeClient();

    await getCandidateNotesHandler({ candidateId: 42 }, auth, client);

    expect(request).toHaveBeenCalledWith(
      "tal_test",
      "GET",
      "/api/agent/v1/candidates/42/notes",
      undefined
    );
  });

  it("bulk-moves applications to a stage", async () => {
    const { client, request } = fakeClient();

    await bulkMoveApplicationsHandler(
      { jobId: 20, applicationIds: [1, 2, 3], stageId: 100 },
      auth,
      client
    );

    expect(request).toHaveBeenCalledWith(
      "tal_test",
      "POST",
      "/api/agent/v1/jobs/20/applications/bulk-move",
      { applicationIds: [1, 2, 3], stageId: 100 }
    );
  });

  it("forwards reliability report filters", async () => {
    const { client, request } = fakeClient();

    await getReliabilityReportHandler(
      { jobId: 20, from: "2026-06-01", to: "2026-07-01", interval: "week" },
      auth,
      client
    );

    expect(request).toHaveBeenCalledWith(
      "tal_test",
      "GET",
      "/api/agent/v1/jobs/20/reports/reliability?from=2026-06-01&to=2026-07-01&interval=week",
      undefined
    );
  });
});

describe("expand param forwarding", () => {
  it("forwards expand on list_applications", async () => {
    const { client, request } = fakeClient();

    await listApplicationsHandler({ jobId: 20, expand: "true" }, auth, client);

    expect(request).toHaveBeenCalledWith(
      "tal_test",
      "GET",
      "/api/agent/v1/jobs/20/applications?expand=true",
      undefined
    );
  });

  it("forwards expand on get_interview_report", async () => {
    const { client, request } = fakeClient();

    await getInterviewReportHandler({ jobId: 20, expand: "all" }, auth, client);

    expect(request).toHaveBeenCalledWith(
      "tal_test",
      "GET",
      "/api/agent/v1/jobs/20/reports/interviews?expand=all",
      undefined
    );
  });
});
