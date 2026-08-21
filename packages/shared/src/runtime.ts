import { ContractValidationError, assertBrowserSafeValue, assertNonEmptyString, assertNonNegativeInteger, isRecord } from "./contracts.js";
import { ROOT_RUN_STATES, type RootRunState } from "./root-run.js";

export const AGENT_ROLES = ["planner", "coder", "integrator", "tester", "reviewer", "orchestrator"] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];
export const AGENT_STATES = ["queued", "running", "waiting", "completed", "failed", "cancelled"] as const;
export type AgentState = (typeof AGENT_STATES)[number];

export interface AgentRun {
  id: string;
  rootRunId: string;
  trackId: string | null;
  role: AgentRole;
  generation: number;
  attempt: number;
  state: AgentState;
  startedAt: string | null;
  completedAt: string | null;
}

export const STEP_KINDS = ["model", "tool", "handoff", "decision", "checkpoint"] as const;
export type StepKind = (typeof STEP_KINDS)[number];
export const STEP_STATES = ["queued", "running", "completed", "failed", "cancelled"] as const;
export type StepState = (typeof STEP_STATES)[number];

export interface AgentStep {
  id: string;
  agentId: string;
  kind: StepKind;
  state: StepState;
  generation: number;
  attempt: number;
  summary: string;
  startedAt: string | null;
  completedAt: string | null;
}

export const MESSAGE_AUTHORS = ["user", "system", "agent"] as const;
export type MessageAuthor = (typeof MESSAGE_AUTHORS)[number];
export interface SessionMessage {
  id: string;
  sessionId: string;
  rootRunId: string | null;
  generation: number | null;
  author: MessageAuthor;
  agentId: string | null;
  content: string;
  createdAt: string;
}

export const CHECK_STATUSES = ["passed", "failed", "skipped", "unavailable"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];
export interface CheckResult {
  id: string;
  name: string;
  status: CheckStatus;
  commandProfile: string | null;
  reason: string | null;
  artifactIds: string[];
  startedAt: string | null;
  completedAt: string | null;
}

export const REVIEW_SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type ReviewSeverity = (typeof REVIEW_SEVERITIES)[number];
export const REVIEW_OUTCOMES = ["accept", "request_changes", "blocked"] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];
export interface ReviewFinding {
  id: string;
  severity: ReviewSeverity;
  title: string;
  description: string;
  path: string | null;
  line: number | null;
  resolved: boolean;
}

export interface ReviewResult {
  outcome: ReviewOutcome;
  findings: ReviewFinding[];
  summary: string;
  artifactIds: string[];
}

export interface UsageSnapshot {
  modelInputTokens: number;
  modelOutputTokens: number;
  toolCalls: number;
  elapsedMs: number;
  estimatedCostUsd: number | null;
}

export const FILE_KINDS = ["file", "directory", "symlink"] as const;
export type FileKind = (typeof FILE_KINDS)[number];
export interface FileEntry {
  path: string;
  kind: FileKind;
  sizeBytes: number;
  revision: string;
  contentType: string | null;
}

export interface FileWriteRequest {
  path: string;
  content: string;
  expectedRevision: string;
  idempotencyKey: string;
}

export const COMMAND_STATUSES = ["queued", "running", "passed", "failed", "cancelled", "timed_out", "unavailable"] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];
export interface CommandExecution {
  id: string;
  profile: string;
  argv: string[];
  cwd: string;
  generation: number;
  status: CommandStatus;
  exitCode: number | null;
  artifactIds: string[];
}

export interface PreviewSnapshot {
  status: "starting" | "ready" | "failed" | "stopped";
  port: number | null;
  url: string | null;
  generation: number;
  updatedAt: string;
}

export const ARTIFACT_KINDS = ["log", "patch", "diff", "screenshot", "trace", "report", "file"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
export interface ArtifactDescriptor {
  id: string;
  kind: ArtifactKind;
  name: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  expiresAt: string | null;
}

export function assertAgentCanMutateGeneration(agent: Pick<AgentRun, "generation">, currentGeneration: number): void {
  assertNonNegativeInteger(currentGeneration, "currentGeneration");
  if (agent.generation !== currentGeneration)
    throw new ContractValidationError("STALE_GENERATION", `Agent generation ${agent.generation} is stale; current generation is ${currentGeneration}`);
}

export function assertCheckResult(result: CheckResult): void {
  assertNonEmptyString(result.id, "check.id");
  assertNonEmptyString(result.name, "check.name");
  if (!CHECK_STATUSES.includes(result.status))
    throw new ContractValidationError("VALIDATION_ERROR", `Unknown check status: ${String(result.status)}`);
  if ((result.status === "skipped" || result.status === "unavailable") && !result.reason)
    throw new ContractValidationError("VALIDATION_ERROR", `A ${result.status} check requires a visible reason`);
}

export function isVisibleRootRunState(value: unknown): value is RootRunState {
  return typeof value === "string" && ROOT_RUN_STATES.includes(value as RootRunState);
}

/** Reject unstructured model/agent output before it can affect orchestration. */
export function assertStructuredRoleOutput(value: unknown): asserts value is { summary: string; data: Record<string, unknown> } {
  if (!isRecord(value) || !isRecord(value.data))
    throw new ContractValidationError("VALIDATION_ERROR", "Role output must contain a data object");
  assertNonEmptyString(value.summary, "role output summary");
  assertBrowserSafeValue(value.data, "role output data");
}
