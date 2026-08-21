import { describe, expect, it, vi } from "vitest";

import { envSchema, warnAboutWeakSecretConfiguration } from "./env.js";

const validEnv = {
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  WEB_APP_URL: "http://localhost:3000",
  SESSION_SECRET: "a".repeat(32),
  GITHUB_APP_ID: "123",
  GITHUB_APP_NAME: "defox",
  GITHUB_APP_SLUG: "defox",
  GITHUB_CLIENT_ID: "client-id",
  GITHUB_CLIENT_SECRET: "client-secret",
  GITHUB_PRIVATE_KEY:
    "-----BEGIN PRIVATE KEY-----\\ncontents\\n-----END PRIVATE KEY-----",
  GITHUB_CALLBACK_URL: "http://localhost:3000/api/github/callback",
  GITHUB_WEBHOOK_SECRET: "a".repeat(16),
  INTERNAL_SERVICE_TOKEN: "a".repeat(16),
  E2B_API_KEY: "e2b-key",
};

describe("envSchema", () => {
  it("accepts a normalized PEM key and server-only defaults", () => {
    const parsed = envSchema.parse(validEnv);

    expect(parsed.GITHUB_PRIVATE_KEY).toContain("-----BEGIN PRIVATE KEY-----");
    expect(parsed.XAI_STORE_RESPONSES).toBe(false);
    expect(parsed.ARTIFACT_STORAGE_DRIVER).toBe("gridfs");
    expect(parsed.PREVIEW_ALLOWED_ORIGINS).toEqual([]);
  });

  it("parses only literal true and false boolean environment values", () => {
    expect(envSchema.parse({ ...validEnv, XAI_STORE_RESPONSES: "true" }).XAI_STORE_RESPONSES).toBe(true);
    expect(envSchema.parse({ ...validEnv, TELEMETRY_ENABLED: "false" }).TELEMETRY_ENABLED).toBe(false);
    expect(() => envSchema.parse({ ...validEnv, TELEMETRY_ENABLED: "1" })).toThrow(
      "TELEMETRY_ENABLED must be exactly true or false",
    );
  });

  it("validates preview origins as comma-separated HTTP(S) origins", () => {
    expect(
      envSchema.parse({
        ...validEnv,
        PREVIEW_ALLOWED_ORIGINS: "https://preview.example.test, http://localhost:3000",
      }).PREVIEW_ALLOWED_ORIGINS,
    ).toEqual(["https://preview.example.test", "http://localhost:3000"]);
    expect(() =>
      envSchema.parse({ ...validEnv, PREVIEW_ALLOWED_ORIGINS: "https://preview.example.test/path" }),
    ).toThrow("PREVIEW_ALLOWED_ORIGINS");
  });

  it("rejects a non-PEM private key", () => {
    expect(() =>
      envSchema.parse({ ...validEnv, GITHUB_PRIVATE_KEY: "not-a-private-key" }),
    ).toThrow("PEM private key");
  });

  it("requires the webhook and internal service secrets used by the API", () => {
    const { GITHUB_WEBHOOK_SECRET: _webhook, ...withoutWebhook } = validEnv;
    const { INTERNAL_SERVICE_TOKEN: _internal, ...withoutInternal } = validEnv;

    expect(() => envSchema.parse(withoutWebhook)).toThrow("GITHUB_WEBHOOK_SECRET");
    expect(() => envSchema.parse(withoutInternal)).toThrow("INTERNAL_SERVICE_TOKEN");
  });

  it("warns about short webhook secrets without printing their values", () => {
    const secret = "short-canary";
    const warning = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    warnAboutWeakSecretConfiguration(envSchema.parse({ ...validEnv, GITHUB_WEBHOOK_SECRET: secret }));

    expect(String(warning.mock.calls[0]?.[0])).toContain("GITHUB_WEBHOOK_SECRET");
    expect(String(warning.mock.calls[0]?.[0])).not.toContain(secret);
  });
});
