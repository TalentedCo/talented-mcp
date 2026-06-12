import { describe, expect, it } from "vitest";
import type { TalentedClient } from "@/lib/talented-client";
import { registerResources } from "@/lib/resources";

describe("registered MCP resources", () => {
  it("describes company jobs as compact and points detail callers to get_job", () => {
    const registered: Array<{ name: string; config: { description?: string } }> = [];
    const server = {
      registerResource: (
        name: string,
        _template: unknown,
        config: { description?: string }
      ) => {
        registered.push({ name, config });
      },
    };

    registerResources(server as never, {} as TalentedClient);

    expect(
      registered.find((resource) => resource.name === "company-jobs")?.config
        .description
    ).toContain("Compact jobs");
    expect(
      registered.find((resource) => resource.name === "company-jobs")?.config
        .description
    ).toContain("call get_job");
  });

  it("describes application resources as including score fields", () => {
    const registered: Array<{ name: string; config: { description?: string } }> = [];
    const server = {
      registerResource: (
        name: string,
        _template: unknown,
        config: { description?: string }
      ) => {
        registered.push({ name, config });
      },
    };

    registerResources(server as never, {} as TalentedClient);

    expect(
      registered.find((resource) => resource.name === "job-applications")?.config
        .description
    ).toContain("resume match and interview score");
    expect(
      registered.find((resource) => resource.name === "application")?.config
        .description
    ).toContain("bounded screening context");
  });
});
