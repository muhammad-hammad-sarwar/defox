import { BROWSER_EVENT_MAX_BYTES, ContractValidationError, assertBoundedBrowserSafeValue, assertNonEmptyString, isRecord, type BrowserSafeValue } from "./contracts.js";

export const EVENT_SCHEMA_VERSION = 1 as const;
export const SESSION_EVENT_TYPES = [
  "session.created", "session.updated", "message.created", "run.created", "run.state_changed",
  "generation.changed", "track.updated", "agent.updated", "step.updated", "model.updated",
  "tool.updated", "command.updated", "file.updated", "git.updated", "integration.updated",
  "test.updated", "review.updated", "approval.updated", "github.updated", "preview.updated",
  "artifact.created", "stream.reset",
] as const;
export type SessionEventType = (typeof SESSION_EVENT_TYPES)[number];

export interface SessionEvent<TPayload extends BrowserSafeValue = BrowserSafeValue> {
  version: typeof EVENT_SCHEMA_VERSION;
  /** Strictly increasing per session; crashes may leave gaps. */
  cursor: number;
  id: string;
  sessionId: string;
  rootRunId: string | null;
  generation: number | null;
  type: SessionEventType;
  occurredAt: string;
  payload: TPayload;
}

export interface SessionEventReset {
  version: typeof EVENT_SCHEMA_VERSION;
  type: "stream.reset";
  oldestAvailableCursor: number;
  snapshotCursor: number;
  reason: "cursor_expired" | "unknown_cursor" | "schema_changed";
}

export interface SessionEventFeed<TSnapshot extends BrowserSafeValue = BrowserSafeValue> {
  snapshot: TSnapshot;
  snapshotCursor: number;
  events: SessionEvent[];
  reset: SessionEventReset | null;
}

export interface EventReducerState<TSnapshot extends BrowserSafeValue = BrowserSafeValue> {
  snapshot: TSnapshot;
  cursor: number;
  needsReset: boolean;
}

function assertEventCursor(value: unknown, field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new ContractValidationError("EVENT_PAYLOAD_INVALID", `${field} must be a non-negative safe integer`);
}

export function assertSessionEvent(event: unknown): asserts event is SessionEvent {
  if (!isRecord(event)) throw new ContractValidationError("EVENT_PAYLOAD_INVALID", "Event must be an object");
  if (event.version !== EVENT_SCHEMA_VERSION)
    throw new ContractValidationError("EVENT_VERSION_UNSUPPORTED", `Unsupported event schema version: ${String(event.version)}`);
  assertEventCursor(event.cursor, "event.cursor");
  if (event.cursor < 1) throw new ContractValidationError("EVENT_PAYLOAD_INVALID", "event.cursor must be at least one");
  assertNonEmptyString(event.id, "event.id");
  assertNonEmptyString(event.sessionId, "event.sessionId");
  if (event.rootRunId !== null && typeof event.rootRunId !== "string")
    throw new ContractValidationError("EVENT_PAYLOAD_INVALID", "event.rootRunId must be a string or null");
  if (event.generation !== null && (typeof event.generation !== "number" || !Number.isSafeInteger(event.generation) || event.generation < 0))
    throw new ContractValidationError("EVENT_PAYLOAD_INVALID", "event.generation must be a non-negative integer or null");
  if (typeof event.type !== "string" || !SESSION_EVENT_TYPES.includes(event.type as SessionEventType))
    throw new ContractValidationError("EVENT_PAYLOAD_INVALID", `Unknown event type: ${String(event.type)}`);
  assertNonEmptyString(event.occurredAt, "event.occurredAt");
  assertBoundedBrowserSafeValue(event.payload, "event.payload");
}

/** Duplicate or late events are ignored; a gap is legal because a crash can consume cursors. */
export function reduceSessionEvent<TSnapshot extends BrowserSafeValue>(
  state: EventReducerState<TSnapshot>,
  event: SessionEvent,
  apply: (snapshot: TSnapshot, event: SessionEvent) => TSnapshot,
): EventReducerState<TSnapshot> {
  assertSessionEvent(event);
  if (event.cursor <= state.cursor) return state;
  return { snapshot: apply(state.snapshot, event), cursor: event.cursor, needsReset: false };
}

export function assertSessionEventReset(reset: unknown): asserts reset is SessionEventReset {
  if (!isRecord(reset))
    throw new ContractValidationError("EVENT_PAYLOAD_INVALID", "Event reset must be an object");
  if (reset.version !== EVENT_SCHEMA_VERSION)
    throw new ContractValidationError("EVENT_VERSION_UNSUPPORTED", `Unsupported reset schema version: ${String(reset.version)}`);
  if (reset.type !== "stream.reset")
    throw new ContractValidationError("EVENT_PAYLOAD_INVALID", "Event reset has an invalid type");
  assertEventCursor(reset.oldestAvailableCursor, "reset.oldestAvailableCursor");
  assertEventCursor(reset.snapshotCursor, "reset.snapshotCursor");
  if (reset.snapshotCursor < reset.oldestAvailableCursor)
    throw new ContractValidationError("EVENT_PAYLOAD_INVALID", "reset.snapshotCursor precedes reset.oldestAvailableCursor");
  if (reset.reason !== "cursor_expired" && reset.reason !== "unknown_cursor" && reset.reason !== "schema_changed")
    throw new ContractValidationError("EVENT_PAYLOAD_INVALID", "Event reset has an invalid reason");
}

export function reduceSessionEventReset<TSnapshot extends BrowserSafeValue>(
  state: EventReducerState<TSnapshot>,
  reset: SessionEventReset,
): EventReducerState<TSnapshot> {
  assertSessionEventReset(reset);
  return { ...state, cursor: reset.snapshotCursor, needsReset: true };
}

export { BROWSER_EVENT_MAX_BYTES };
