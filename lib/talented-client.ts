// `||` (not `??`) so an empty TALENTED_API_BASE_URL also falls back instead of
// resolving to a host-less "". Default matches the production app domain.
const DEFAULT_BASE_URL =
  process.env.TALENTED_API_BASE_URL || "https://talented.co";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export class TalentedApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown
  ) {
    super(message);
    this.name = "TalentedApiError";
  }
}

export type TalentedClientOptions = {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
};

export class TalentedClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(opts: TalentedClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
  }

  async request<T>(
    token: string,
    method: Method,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" })
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    const parsed = text ? parseJson(text) : null;

    if (!response.ok) {
      throw new TalentedApiError(
        response.status,
        errorMessage(parsed) ?? `Talented API returned HTTP ${response.status}`,
        parsed
      );
    }

    return parsed as T;
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(body: unknown): string | null {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    return typeof error === "string" ? error : null;
  }
  return null;
}
