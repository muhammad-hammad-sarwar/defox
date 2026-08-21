/** Shared primitives for durable, browser-facing v1 contracts. */

import type { ApiErrorCode } from "./api.js";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type BrowserSafeValue = JsonValue;

export const BROWSER_EVENT_MAX_BYTES = 64 * 1024;
export const BROWSER_EVENT_MAX_DEPTH = 12;

/** Contract errors deliberately use the public API error-code vocabulary. */
export type ContractErrorCode = Extract<
  ApiErrorCode,
  | "VALIDATION_ERROR"
  | "EVENT_VERSION_UNSUPPORTED"
  | "EVENT_PAYLOAD_INVALID"
  | "STALE_GENERATION"
  | "STALE_REVISION"
  | "ILLEGAL_STATE_TRANSITION"
  | "TRACK_OWNERSHIP_VIOLATION"
  | "APPROVAL_STALE"
>;

export class ContractValidationError extends Error {
  constructor(readonly code: ContractErrorCode, message: string) {
    super(message);
    this.name = "ContractValidationError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0)
    throw new ContractValidationError("VALIDATION_ERROR", `${field} must be a non-empty string`);
}

export function assertNonNegativeInteger(value: unknown, field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new ContractValidationError("VALIDATION_ERROR", `${field} must be a non-negative safe integer`);
}

/** Reject values that could be unsafe to render or that exceed bounded SSE storage. */
export function assertBrowserSafeValue(
  value: unknown,
  field = "value",
  depth = 0,
): asserts value is BrowserSafeValue {
  if (depth > BROWSER_EVENT_MAX_DEPTH)
    throw new ContractValidationError("EVENT_PAYLOAD_INVALID", `${field} exceeds maximum nesting depth`);
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new ContractValidationError("EVENT_PAYLOAD_INVALID", `${field} must not contain non-finite numbers`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertBrowserSafeValue(item, `${field}[${index}]`, depth + 1));
    return;
  }
  if (!isRecord(value))
    throw new ContractValidationError("EVENT_PAYLOAD_INVALID", `${field} must be JSON-compatible`);
  for (const [key, item] of Object.entries(value)) {
    if (key === "__proto__" || key === "prototype" || key === "constructor")
      throw new ContractValidationError("EVENT_PAYLOAD_INVALID", `${field} contains an unsafe key`);
    assertBrowserSafeValue(item, `${field}.${key}`, depth + 1);
  }
}

export function assertBoundedBrowserSafeValue(value: unknown, field = "value"): asserts value is BrowserSafeValue {
  assertBrowserSafeValue(value, field);
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new ContractValidationError("EVENT_PAYLOAD_INVALID", `${field} cannot be serialized`);
  }
  // JSON's string length counts UTF-16 code units; SSE limits are byte limits.
  if (new TextEncoder().encode(encoded).byteLength > BROWSER_EVENT_MAX_BYTES)
    throw new ContractValidationError("EVENT_PAYLOAD_INVALID", `${field} exceeds ${BROWSER_EVENT_MAX_BYTES} UTF-8 bytes`);
}
