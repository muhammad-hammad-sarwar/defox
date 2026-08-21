import { ContractValidationError, assertNonEmptyString, assertNonNegativeInteger } from "./contracts.js";

export const ROOT_RUN_STATES = [
  "queued", "preparing", "planning", "dispatching", "coding_parallel", "integrating",
  "testing", "reviewing", "correcting", "awaiting_push_approval", "pushing",
  "awaiting_draft_pr_approval", "creating_draft_pr", "awaiting_mark_ready_approval",
  "marking_pr_ready", "awaiting_merge_approval", "merging", "interrupt_requested", "interrupting",
  "awaiting_user", "needs_human", "completed", "failed", "cancelled", "expired",
] as const;
export type RootRunState = (typeof ROOT_RUN_STATES)[number];

export const TERMINAL_ROOT_RUN_STATES = ["completed", "failed", "cancelled", "expired"] as const;
export type TerminalRootRunState = (typeof TERMINAL_ROOT_RUN_STATES)[number];

const allNonTerminal = ROOT_RUN_STATES.filter(
  (state): state is Exclude<RootRunState, TerminalRootRunState> => !TERMINAL_ROOT_RUN_STATES.includes(state as TerminalRootRunState),
);

/** All allowed root-run transitions. Terminal states intentionally have no exits. */
export const ROOT_RUN_TRANSITIONS: Readonly<Record<RootRunState, readonly RootRunState[]>> = {
  queued: ["preparing", "interrupt_requested", "cancelled", "failed", "expired"],
  preparing: ["planning", "interrupt_requested", "awaiting_user", "needs_human", "cancelled", "failed", "expired"],
  planning: ["dispatching", "awaiting_user", "needs_human", "interrupt_requested", "cancelled", "failed", "expired"],
  dispatching: ["coding_parallel", "integrating", "interrupt_requested", "needs_human", "cancelled", "failed", "expired"],
  coding_parallel: ["integrating", "interrupt_requested", "needs_human", "cancelled", "failed", "expired"],
  integrating: ["testing", "planning", "needs_human", "interrupt_requested", "cancelled", "failed", "expired"],
  testing: ["reviewing", "needs_human", "interrupt_requested", "cancelled", "failed", "expired"],
  reviewing: ["correcting", "awaiting_push_approval", "completed", "needs_human", "interrupt_requested", "cancelled", "failed", "expired"],
  correcting: ["dispatching", "integrating", "reviewing", "needs_human", "interrupt_requested", "cancelled", "failed", "expired"],
  awaiting_push_approval: ["pushing", "awaiting_user", "interrupt_requested", "cancelled", "failed", "expired"],
  pushing: ["awaiting_draft_pr_approval", "completed", "needs_human", "failed", "expired"],
  awaiting_draft_pr_approval: ["creating_draft_pr", "awaiting_user", "interrupt_requested", "cancelled", "failed", "expired"],
  creating_draft_pr: ["awaiting_mark_ready_approval", "awaiting_merge_approval", "needs_human", "failed", "expired"],
  awaiting_mark_ready_approval: ["marking_pr_ready", "awaiting_merge_approval", "awaiting_user", "interrupt_requested", "cancelled", "failed", "expired"],
  marking_pr_ready: ["awaiting_merge_approval", "needs_human", "failed", "expired"],
  awaiting_merge_approval: ["merging", "awaiting_user", "interrupt_requested", "cancelled", "failed", "expired"],
  merging: ["completed", "needs_human", "failed", "expired"],
  interrupt_requested: ["interrupting", "cancelled", "failed", "expired"],
  interrupting: ["planning", "awaiting_user", "needs_human", "cancelled", "failed", "expired"],
  awaiting_user: ["planning", "awaiting_push_approval", "awaiting_draft_pr_approval", "awaiting_mark_ready_approval", "awaiting_merge_approval", "interrupt_requested", "cancelled", "expired"],
  needs_human: ["planning", "awaiting_user", "interrupt_requested", "cancelled", "failed", "expired"],
  completed: [],
  failed: [],
  cancelled: [],
  expired: [],
};

export interface RootRunRepository {
  githubRepositoryId: string;
  fullName: string;
  baseSha: string;
  baseRef: string;
}

export interface RootRunSnapshot {
  id: string;
  sessionId: string;
  repository: RootRunRepository;
  state: RootRunState;
  /** Incremented before cancellation/replanning; old leases may no longer mutate durable state. */
  generation: number;
  /** Optimistic content revision for commands and user mutations. */
  revision: number;
  attempt: number;
  cancelRequested: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRootRunRequest {
  /** V1 admits one, and only one, repository into each root run. */
  repositoryId: string;
  baseSha: string;
  prompt: string;
  idempotencyKey: string;
  expectedSessionRevision: number;
}

export const isTerminalRootRunState = (state: RootRunState): state is TerminalRootRunState =>
  TERMINAL_ROOT_RUN_STATES.includes(state as TerminalRootRunState);

export function canTransitionRootRun(from: RootRunState, to: RootRunState): boolean {
  return ROOT_RUN_TRANSITIONS[from].includes(to);
}

export function assertRootRunTransition(from: RootRunState, to: RootRunState): void {
  if (!canTransitionRootRun(from, to))
    throw new ContractValidationError("ILLEGAL_STATE_TRANSITION", `Cannot transition root run from ${from} to ${to}`);
}

export function transitionRootRun(run: RootRunSnapshot, to: RootRunState, now: string): RootRunSnapshot {
  assertRootRunTransition(run.state, to);
  return { ...run, state: to, revision: run.revision + 1, updatedAt: now };
}

export function assertCurrentGeneration(run: Pick<RootRunSnapshot, "generation">, generation: number): void {
  assertNonNegativeInteger(generation, "generation");
  if (run.generation !== generation)
    throw new ContractValidationError("STALE_GENERATION", `Generation ${generation} is stale; current generation is ${run.generation}`);
}

export function assertCurrentRevision(run: Pick<RootRunSnapshot, "revision">, revision: number): void {
  assertNonNegativeInteger(revision, "revision");
  if (run.revision !== revision)
    throw new ContractValidationError("STALE_REVISION", `Revision ${revision} is stale; current revision is ${run.revision}`);
}

/** Begin interruption synchronously with persistence of the user follow-up. */
export function requestInterruption(run: RootRunSnapshot, now: string): RootRunSnapshot {
  if (isTerminalRootRunState(run.state))
    throw new ContractValidationError("ILLEGAL_STATE_TRANSITION", "A terminal root run cannot be interrupted");
  assertRootRunTransition(run.state, "interrupt_requested");
  return { ...run, state: "interrupt_requested", generation: run.generation + 1, revision: run.revision + 1, updatedAt: now };
}

/** A replan only occurs after interrupting leases drain and uses the bumped generation. */
export function replanAfterInterruption(run: RootRunSnapshot, now: string): RootRunSnapshot {
  assertRootRunTransition(run.state, "planning");
  return { ...run, state: "planning", revision: run.revision + 1, updatedAt: now };
}

/** Historical sessions may have multiple repositories; this restriction starts at v1 root-run creation. */
export function assertExactlyOneRepository(repositoryIds: readonly string[]): string {
  if (repositoryIds.length !== 1)
    throw new ContractValidationError("VALIDATION_ERROR", "A v1 root run requires exactly one repository");
  const repositoryId = repositoryIds[0];
  assertNonEmptyString(repositoryId, "repositoryIds[0]");
  return repositoryId;
}

export function assertCreateRootRunRequest(input: CreateRootRunRequest): void {
  assertNonEmptyString(input.repositoryId, "repositoryId");
  assertNonEmptyString(input.baseSha, "baseSha");
  assertNonEmptyString(input.prompt, "prompt");
  assertNonEmptyString(input.idempotencyKey, "idempotencyKey");
  assertNonNegativeInteger(input.expectedSessionRevision, "expectedSessionRevision");
}

export { allNonTerminal as NON_TERMINAL_ROOT_RUN_STATES };
