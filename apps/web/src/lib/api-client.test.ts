import { describe, expect, it, vi } from "vitest";

import { apiFetch } from "./api-client";

describe("apiFetch", () => {
  it("uses a same-origin request and unwraps successful API responses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { connected: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(apiFetch<{ connected: boolean }>("/api/github")).resolves.toEqual({
      connected: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/github",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("converts API errors to ApiRequestError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: { code: "GITHUB_NOT_CONNECTED", message: "Connect GitHub first" },
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(apiFetch("/api/github")).rejects.toEqual(
      expect.objectContaining({
        name: "ApiRequestError",
        code: "GITHUB_NOT_CONNECTED",
        status: 401,
      }),
    );
  });
});
