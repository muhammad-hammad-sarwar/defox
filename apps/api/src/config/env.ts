import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

/**
 * GitHub App private keys are usually multi-line PEM files. When they travel
 * through an environment variable they are commonly stored either with escaped
 * newlines ("\\n") or base64 encoded. Normalize both shapes to a real PEM.
 */
function normalizePrivateKey(raw: string): string {
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  const candidate = trimmed.includes("BEGIN")
    ? trimmed.replace(/\\n/g, "\n")
    : Buffer.from(trimmed, "base64").toString("utf8");
  return `${candidate.trim()}\n`;
}

const privateKeySchema = z
  .string()
  .min(1, "GITHUB_PRIVATE_KEY is required")
  .transform(normalizePrivateKey)
  .refine(
    (key) => key.includes("-----BEGIN") && key.includes("PRIVATE KEY-----"),
    "GITHUB_PRIVATE_KEY must be a PEM private key (raw, escaped-newline, or base64 encoded)",
  );

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1).default("defox"),

  /** Public origin of the Next.js app; used for CORS and post-callback redirects. */
  WEB_APP_URL: z.string().url(),

  SESSION_COOKIE_NAME: z.string().min(1).default("defox_session"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24 * 7),

  GITHUB_APP_ID: z.coerce.number().int().positive(),
  GITHUB_APP_NAME: z.string().min(1),
  GITHUB_APP_SLUG: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_PRIVATE_KEY: privateKeySchema,
  GITHUB_CALLBACK_URL: z.string().url(),
  GITHUB_WEBHOOK_SECRET: z.string().min(1).optional(),

  /**
   * Shared secret used by the future agent/sandbox service to request
   * short-lived clone credentials. Never exposed to the browser.
   */
  INTERNAL_SERVICE_TOKEN: z.string().min(16).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/** Validates process.env once, at startup, and fails loudly when misconfigured. */
export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getEnv(): Env {
  return cachedEnv ?? loadEnv();
}
