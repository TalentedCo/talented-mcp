import { describe, expect, it } from "vitest";
import { toolNames } from "@/lib/tools";

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
      "reject_application",
      "unreject_application",
      "get_candidate",
      "add_candidate_note",
      "update_candidate_status"
    ]);
  });
});
