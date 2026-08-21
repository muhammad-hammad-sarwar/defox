import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

/**
 * GitHub App private keys are usually multi-line PEM files. When they travel
 * through an environment variable they are commonly stored either with escaped
 * newlines ("\\n") or base64 encoded. Normalize both shapes to a real PEM.
 */
function normalizePrivateKey(raw: string): string {
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, "");
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
    (key) =>
      /^-----BEGIN (?:RSA )?PRIVATE KEY-----\n[\s\S]+\n-----END (?:RSA )?PRIVATE KEY-----\n$/.test(
        key,
      ),
    "GITHUB_PRIVATE_KEY must be a PEM private key (raw, escaped-newline, or base64 encoded)",
  );

const nonNegativeInteger = (name: string, defaultValue: number) =>
  z.coerce.number().int().nonnegative(`${name} must be a non-negative integer`).default(defaultValue);
const positiveInteger = (name: string, defaultValue: number) =>
  z.coerce.number().int().positive(`${name} must be a positive integer`).default(defaultValue);
const positiveBytes = (name: string, defaultValue: number) =>
  positiveInteger(name, defaultValue);
const optionalNonEmptyString = () =>
  z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional());
const optionalUrl = () =>
  z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional());
const booleanFromEnvironment = (name: string, defaultValue: boolean) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === "") return defaultValue;
      if (value === true || value === "true") return true;
      if (value === false || value === "false") return false;
      return value;
    },
    z.boolean({
      invalid_type_error: `${name} must be exactly true or false`,
    }),
  );
const previewAllowedOrigins = z
  .string()
  .default("")
  .transform((value, context) => {
    const origins = value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);

    for (const origin of origins) {
      try {
        const parsed = new URL(origin);
        if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol)) {
          throw new Error("not an HTTP origin");
        }
      } catch {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PREVIEW_ALLOWED_ORIGINS must be a comma-separated list of HTTP(S) origins",
        });
        return z.NEVER;
      }
    }
    return origins;
  });

/**
 * Process configuration. Values for the future runtime are deliberately
 * optional/defaulted so local development and tests do not require credentials
 * for integrations that are not invoked by this baseline application.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: positiveInteger("PORT", 4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB_NAME: z.string().min(1).default("defox"),

  /** Public origin of the Next.js app; used for CORS and post-callback redirects. */
  WEB_APP_URL: z.string().url(),

  SESSION_COOKIE_NAME: z.string().min(1).default("defox_session"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  SESSION_TTL_HOURS: positiveInteger("SESSION_TTL_HOURS", 24 * 7),

  GITHUB_APP_ID: z.coerce.number().int().positive("GITHUB_APP_ID must be a positive integer"),
  GITHUB_APP_NAME: z.string().min(1),
  GITHUB_APP_SLUG: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_PRIVATE_KEY: privateKeySchema,
  GITHUB_CALLBACK_URL: z.string().url(),
  /** Required because the public webhook route must verify every delivery. */
  GITHUB_WEBHOOK_SECRET: z.string().min(1, "GITHUB_WEBHOOK_SECRET is required"),
  /** Server-only credential for the current internal clone-credentials route. */
  INTERNAL_SERVICE_TOKEN: z.string().min(16, "INTERNAL_SERVICE_TOKEN must be at least 16 characters"),
  E2B_API_KEY: z.string().min(1, "E2B_API_KEY is required"),

  // Upcoming server-only runtime configuration. These settings do not enable a
  // provider or a sandbox by themselves, so safe defaults keep tests hermetic.
  XAI_API_KEY: optionalNonEmptyString(),
  XAI_BASE_URL: z.string().url().default("https://api.x.ai/v1"),
  XAI_MODEL: z.string().min(1).default("grok-3-mini"),
  XAI_STORE_RESPONSES: booleanFromEnvironment("XAI_STORE_RESPONSES", false),
  E2B_TEMPLATE: optionalNonEmptyString(),
  E2B_IDLE_TIMEOUT_MS: positiveInteger("E2B_IDLE_TIMEOUT_MS", 20 * 60 * 1000),
  E2B_HARD_TIMEOUT_MS: positiveInteger("E2B_HARD_TIMEOUT_MS", 120 * 60 * 1000),
  ARTIFACT_STORAGE_DRIVER: z.enum(["gridfs", "s3"]).default("gridfs"),
  ARTIFACT_MAX_ITEM_BYTES: positiveBytes("ARTIFACT_MAX_ITEM_BYTES", 50 * 1024 * 1024),
  ARTIFACT_MAX_RUN_BYTES: positiveBytes("ARTIFACT_MAX_RUN_BYTES", 500 * 1024 * 1024),
  PREVIEW_MAX_PORTS: positiveInteger("PREVIEW_MAX_PORTS", 1),
  PREVIEW_ALLOWED_ORIGINS: previewAllowedOrigins,
  EVENT_RETENTION_DAYS: positiveInteger("EVENT_RETENTION_DAYS", 7),
  ARTIFACT_RETENTION_DAYS: positiveInteger("ARTIFACT_RETENTION_DAYS", 30),
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl(),
  TELEMETRY_ENABLED: booleanFromEnvironment("TELEMETRY_ENABLED", false),
  AGENT_MAX_PARALLEL_TRACKS: positiveInteger("AGENT_MAX_PARALLEL_TRACKS", 3),
  AGENT_RUN_TIMEOUT_MS: positiveInteger("AGENT_RUN_TIMEOUT_MS", 90 * 60 * 1000),
  AGENT_TURN_TIMEOUT_MS: positiveInteger("AGENT_TURN_TIMEOUT_MS", 10 * 60 * 1000),
  AGENT_MAX_TOOL_CALLS: positiveInteger("AGENT_MAX_TOOL_CALLS", 200),
  AGENT_MAX_OUTPUT_TOKENS: positiveInteger("AGENT_MAX_OUTPUT_TOKENS", 16_000),
  AGENT_MAX_TOTAL_TOKENS: positiveInteger("AGENT_MAX_TOTAL_TOKENS", 1_000_000),
  AGENT_MAX_CORRECTIONS: nonNegativeInteger("AGENT_MAX_CORRECTIONS", 1),
  AGENT_MODEL_RETRIES: nonNegativeInteger("AGENT_MODEL_RETRIES", 2),
  TOOL_COMMAND_TIMEOUT_MS: positiveInteger("TOOL_COMMAND_TIMEOUT_MS", 10 * 60 * 1000),
  TOOL_MAX_INLINE_BYTES: positiveBytes("TOOL_MAX_INLINE_BYTES", 256 * 1024),
  TOOL_MAX_TEXT_FILE_BYTES: positiveBytes("TOOL_MAX_TEXT_FILE_BYTES", 2 * 1024 * 1024),
  TOOL_MAX_DIFF_BYTES: positiveBytes("TOOL_MAX_DIFF_BYTES", 1024 * 1024),
  BROWSER_MAX_ACTIONS: positiveInteger("BROWSER_MAX_ACTIONS", 100),
  BROWSER_ACTION_TIMEOUT_MS: positiveInteger("BROWSER_ACTION_TIMEOUT_MS", 30 * 1000),
  APPROVAL_TTL_MS: positiveInteger("APPROVAL_TTL_MS", 30 * 60 * 1000),
  RUN_USER_CONCURRENCY: positiveInteger("RUN_USER_CONCURRENCY", 2),
  RUN_GLOBAL_CONCURRENCY: positiveInteger("RUN_GLOBAL_CONCURRENCY", 20),
});

/**
 * Session cookies are marked secure everywhere except plain-HTTP localhost, so
 * a staging deployment that forgets NODE_ENV cannot emit them over plaintext.
 */
/** Logs configuration-strength warnings without exposing configuration values. */
export function warnAboutWeakSecretConfiguration(env: Env): void {
  if (env.GITHUB_WEBHOOK_SECRET.length < 16) {
    process.stderr.write(
      "GITHUB_WEBHOOK_SECRET is shorter than the recommended 16 characters; rotate it to a random production secret.\n",
    );
  }
}

export function isSecureCookieOrigin(webAppUrl: string): boolean {
  const { protocol, hostname } = new URL(webAppUrl);
  if (protocol === "https:") return true;
  return !(hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]");
}

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
