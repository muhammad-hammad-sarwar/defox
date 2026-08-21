import { describe, expect, it, vi } from "vitest";

import { logger, redact, redactString } from "./logger.js";

describe("logger redaction", () => {
  it("redacts secret canaries from structured logs and token-shaped strings", () => {
    const canary = "ghp_abcdefghijklmnopqrstuvwxyz123456";
    const output = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    logger.info(`request failed with ${canary}`, {
      authorization: `Bearer ${canary}`,
      nested: { password: "secret-canary-value" },
      cloneUrl: `https://x-access-token:${canary}@github.com/acme/repo.git`,
    });

    const logged = String(output.mock.calls[0]?.[0]);
    expect(logged).not.toContain(canary);
    expect(logged).not.toContain("secret-canary-value");
    expect(logged).toContain("[redacted]");
  });

  it("redacts basic-auth URLs and private key values", () => {
    expect(
      redactString("https://user:password@example.test/repository.git"),
    ).toBe("https://[redacted]@example.test/repository.git");
    expect(
      redact({ privateKey: "-----BEGIN PRIVATE KEY-----\ncanary\n-----END PRIVATE KEY-----" }),
    ).toEqual({ privateKey: "[redacted]" });
  });
});
