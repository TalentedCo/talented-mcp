import { describe, expect, it } from "vitest";
import { TalentedApiError, TalentedClient } from "@/lib/talented-client";

type FetchCall = {
  url: string;
  method: string;
  headers: Headers;
  body: string | undefined;
};

function captured(status = 200, body: unknown = { ok: true }) {
  const calls: FetchCall[] = [];
  const fakeFetch: typeof globalThis.fetch = async (input, init) => {
    const req = new Request(input as RequestInfo, init);
    calls.push({
      url: req.url,
      method: req.method,
      headers: req.headers,
      body: init?.body === undefined ? undefined : String(init.body)
    });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" }
    });
  };
  return { calls, fakeFetch };
}

describe("TalentedClient", () => {
  it("forwards bearer tokens and JSON bodies", async () => {
    const { calls, fakeFetch } = captured();
    const client = new TalentedClient({ baseUrl: "http://talented.test", fetch: fakeFetch });

    await client.request("tal_test", "POST", "/api/agent/v1/test", { name: "Ada" });

    expect(calls[0].url).toBe("http://talented.test/api/agent/v1/test");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers.get("authorization")).toBe("Bearer tal_test");
    expect(calls[0].headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(calls[0].body!)).toEqual({ name: "Ada" });
  });

  it("raises TalentedApiError on non-2xx responses", async () => {
    const { fakeFetch } = captured(403, { error: "Forbidden" });
    const client = new TalentedClient({ baseUrl: "http://talented.test", fetch: fakeFetch });

    await expect(client.request("tal_test", "GET", "/api/agent/v1/me")).rejects.toMatchObject({
      status: 403,
      message: "Forbidden"
    } satisfies Partial<TalentedApiError>);
  });

  it("validates bearer tokens through the lightweight auth endpoint", async () => {
    const { calls, fakeFetch } = captured(200, {
      user: {
        id: 1,
        email: "owner@example.com",
        firstName: "Owner",
        lastName: "User"
      },
      token: {
        id: 2,
        name: "Claude",
        tokenPrefix: "tal_prefix",
        scopes: ["agent:read"],
        expiresAt: null
      }
    });
    const client = new TalentedClient({ baseUrl: "http://talented.test", fetch: fakeFetch });

    const validation = await client.validateToken("tal_test");

    expect(calls[0].url).toBe("http://talented.test/api/agent/v1/auth/validate");
    expect(calls[0].method).toBe("GET");
    expect(calls[0].headers.get("authorization")).toBe("Bearer tal_test");
    expect(validation.token.scopes).toEqual(["agent:read"]);
  });
});
