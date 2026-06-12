import { describe, expect, it } from "vitest";
import type { TalentedClient } from "@/lib/talented-client";
import { registerResources } from "@/lib/resources";

describe("registered MCP resources", () => {
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

  it("describes company jobs as compact and points clients to get_job", () => {
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

    const companyJobs = registered.find((resource) => resource.name === "company-jobs");
    expect(companyJobs?.config.description).toContain("Compact jobs");
    expect(companyJobs?.config.description).toContain("Omits full job descriptions");
    expect(companyJobs?.config.description).toContain("use get_job");
    expect(companyJobs?.config.description).toContain("hiring-plan data");
  });
});
