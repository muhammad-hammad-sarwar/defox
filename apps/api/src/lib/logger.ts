/**
 * Minimal structured logger with credential redaction.
 *
 * Every value that is logged passes through `redact`, so an accidentally
 * logged GitHub token, PEM key or basic-auth clone URL never reaches stdout.
 */

const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|authorization|private_?key|credential)/i;

const TOKEN_VALUE_PATTERNS: RegExp[] = [
  /gh[pousr]_[A-Za-z0-9]{16,}/g, // classic/app/user/refresh tokens
  /v1\.[0-9a-f]{40}/g, // installation access tokens
  /-----BEGIN[\s\S]*?PRIVATE KEY-----[\s\S]*?-----END[\s\S]*?PRIVATE KEY-----/g,
];

const REDACTED = "[redacted]";

export function redactString(value: string): string {
  let output = value;
  for (const pattern of TOKEN_VALUE_PATTERNS) {
    output = output.replace(pattern, REDACTED);
  }
  // https://user:token@github.com/owner/repo.git
  output = output.replace(/(https?:\/\/)[^/\s@]+@/g, `$1${REDACTED}@`);
  return output;
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (typeof value === "string") return redactString(value);
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(item, depth + 1),
      ]),
    );
  }
  return value;
}

type Level = "debug" | "info" | "warn" | "error";

function write(level: Level, message: string, context?: unknown): void {
  const entry = {
    level,
    time: new Date().toISOString(),
    message: redactString(message),
    ...(context === undefined ? {} : { context: redact(context) }),
  };
  const line = JSON.stringify(entry);
  if (level === "error") process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export const logger = {
  debug: (message: string, context?: unknown) => write("debug", message, context),
  info: (message: string, context?: unknown) => write("info", message, context),
  warn: (message: string, context?: unknown) => write("warn", message, context),
  error: (message: string, context?: unknown) => write("error", message, context),
};
