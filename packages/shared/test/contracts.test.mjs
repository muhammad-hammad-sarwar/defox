import assert from "node:assert/strict";
import test from "node:test";

import {
  BROWSER_EVENT_MAX_BYTES,
  ContractValidationError,
  ROOT_RUN_STATES,
  approvalEvidenceMatches,
  approvalMatches,
  areTrackDependenciesSatisfied,
  assertApprovalDecision,
  assertCurrentGeneration,
  assertExactlyOneRepository,
  assertSessionEvent,
  assertSessionEventReset,
  assertTrackOwnsPath,
  assertTrackTransition,
  assertValidTrackPlan,
  isVisibleRootRunState,
  reduceSessionEvent,
  reduceSessionEventReset,
  requestInterruption,
  transitionRootRun,
} from "../dist/index.js";

const run = {
  id: "run_1",
  sessionId: "session_1",
  repository: { githubRepositoryId: "1", fullName: "acme/app", baseSha: "a".repeat(40), baseRef: "main" },
  state: "planning",
  generation: 2,
  revision: 4,
  attempt: 1,
  cancelRequested: false,
  createdAt: "2026-08-21T00:00:00.000Z",
  updatedAt: "2026-08-21T00:00:00.000Z",
};

function expectContractCode(code, action) {
  assert.throws(action, (error) => error instanceof ContractValidationError && error.code === code);
}

test("root-run transitions cover approval-gated push, draft PR, and mark-ready effects", () => {
  const push = transitionRootRun({ ...run, state: "reviewing" }, "awaiting_push_approval", run.updatedAt);
  const pushing = transitionRootRun(push, "pushing", run.updatedAt);
  const awaitingDraft = transitionRootRun(pushing, "awaiting_draft_pr_approval", run.updatedAt);
  const creatingDraft = transitionRootRun(awaitingDraft, "creating_draft_pr", run.updatedAt);
  const awaitingReady = transitionRootRun(creatingDraft, "awaiting_mark_ready_approval", run.updatedAt);
  const markingReady = transitionRootRun(awaitingReady, "marking_pr_ready", run.updatedAt);
  assert.equal(markingReady.state, "marking_pr_ready");
  expectContractCode("ILLEGAL_STATE_TRANSITION", () => transitionRootRun({ ...run, state: "completed" }, "planning", run.updatedAt));
  expectContractCode("ILLEGAL_STATE_TRANSITION", () => transitionRootRun(run, "merging", run.updatedAt));
});

test("follow-up interruption is admitted from queued, awaiting_user, and needs_human", () => {
  for (const state of ["queued", "awaiting_user", "needs_human"]) {
    const interrupted = requestInterruption({ ...run, state }, "2026-08-21T00:01:00.000Z");
    assert.equal(interrupted.state, "interrupt_requested");
    assert.equal(interrupted.generation, 3);
    expectContractCode("STALE_GENERATION", () => assertCurrentGeneration(interrupted, 2));
  }
  expectContractCode("ILLEGAL_STATE_TRANSITION", () => requestInterruption({ ...run, state: "completed" }, run.updatedAt));
});

test("v1 root-run creation requires exactly one repository while historical sessions remain arrays", () => {
  assert.equal(assertExactlyOneRepository(["123"]), "123");
  expectContractCode("VALIDATION_ERROR", () => assertExactlyOneRepository([]));
  expectContractCode("VALIDATION_ERROR", () => assertExactlyOneRepository(["123", "456"]));
});

const makeTrack = (id, paths, dependsOn = [], state = "planned") => ({
  id,
  title: id,
  dependsOn,
  ownership: { paths },
  state,
  attempt: 1,
  generation: 1,
  branchName: `defox/run/${id}`,
  worktreePath: `/worktrees/${id}`,
});

test("checkpointed dependencies unblock dependent tracks and normalized roots remain confined", () => {
  const upstream = makeTrack("upstream", ["packages/shared/"], [], "checkpointed");
  const dependent = makeTrack("dependent", ["apps/api/"], ["upstream"]);
  assert.equal(areTrackDependenciesSatisfied(dependent, [upstream, dependent]), true);
  assertValidTrackPlan([makeTrack("ui", ["apps/web/"]), makeTrack("api", ["apps/api/"])]);
  assert.equal(assertTrackOwnsPath(makeTrack("ui", ["apps/web/"]), "apps/web/page.tsx"), "apps/web/page.tsx");
  expectContractCode("TRACK_OWNERSHIP_VIOLATION", () => assertValidTrackPlan([makeTrack("one", ["apps/"]), makeTrack("two", ["apps/api/"])]));
  expectContractCode("TRACK_OWNERSHIP_VIOLATION", () => assertTrackOwnsPath(makeTrack("ui", ["apps/web"]), "apps/web/../api/app.ts"));
  assertTrackTransition("running", "checkpointed");
  expectContractCode("ILLEGAL_STATE_TRANSITION", () => assertTrackTransition("integrated", "running"));
});

const event = (cursor, payload = { status: "planning" }) => ({
  version: 1,
  cursor,
  id: `event_${cursor}`,
  sessionId: "session_1",
  rootRunId: "run_1",
  generation: 1,
  type: "run.state_changed",
  occurredAt: "2026-08-21T00:00:00.000Z",
  payload,
});

test("event reducer ignores duplicates, accepts cursor gaps, and validates reset cursors", () => {
  const initial = { snapshot: { events: [] }, cursor: 3, needsReset: false };
  const apply = (snapshot, current) => ({ events: [...snapshot.events, current.cursor] });
  assert.deepEqual(reduceSessionEvent(initial, event(3), apply), initial);
  const gap = reduceSessionEvent(initial, event(8), apply);
  assert.equal(gap.cursor, 8);
  const reset = reduceSessionEventReset(gap, { version: 1, type: "stream.reset", oldestAvailableCursor: 12, snapshotCursor: 14, reason: "cursor_expired" });
  assert.equal(reset.cursor, 14);
  expectContractCode("EVENT_PAYLOAD_INVALID", () => assertSessionEventReset({ version: 1, type: "stream.reset", oldestAvailableCursor: -1, snapshotCursor: 0, reason: "cursor_expired" }));
  expectContractCode("EVENT_PAYLOAD_INVALID", () => assertSessionEventReset({ version: 1, type: "stream.reset", oldestAvailableCursor: 10, snapshotCursor: 9, reason: "cursor_expired" }));
});

const evidence = {
  repositoryFullName: "acme/app", targetBranch: "main", baseSha: "a", headSha: "b", diffHash: "c",
  checkSnapshotHash: "d", reviewSnapshotHash: "e", pullRequestNumber: 1,
};
const approval = {
  id: "approval_1", rootRunId: "run_1", action: "squash_merge", state: "approved", generation: 2,
  revision: 4, idempotencyKey: "key_1", requestedByUserId: "user_1", evidence,
  expiresAt: "2026-08-22T00:00:00.000Z", createdAt: "2026-08-21T00:00:00.000Z", decidedAt: null,
};

test("approval evidence is compared canonically and decision vocabulary is validated", () => {
  const reOrderedEvidence = { headSha: "b", repositoryFullName: "acme/app", baseSha: "a", targetBranch: "main", diffHash: "c", reviewSnapshotHash: "e", checkSnapshotHash: "d", pullRequestNumber: 1 };
  assert.equal(approvalEvidenceMatches(evidence, reOrderedEvidence), true);
  assert.equal(approvalMatches(approval, { generation: 2, evidence: reOrderedEvidence }, "2026-08-21T01:00:00.000Z"), true);
  assert.equal(approvalMatches(approval, { generation: 2, evidence: { ...evidence, headSha: "changed" } }, "2026-08-21T01:00:00.000Z"), false);
  expectContractCode("STALE_REVISION", () => assertApprovalDecision({ ...approval, state: "pending" }, { expectedRevision: 3, idempotencyKey: "decision_1", decision: "approve" }, "2026-08-21T01:00:00.000Z"));
  expectContractCode("VALIDATION_ERROR", () => assertApprovalDecision({ ...approval, state: "pending" }, { expectedRevision: 4, idempotencyKey: "decision_1", decision: "yes" }, "2026-08-21T01:00:00.000Z"));
});

test("events fail closed for unknown versions, malformed payloads, and oversized UTF-8 payloads", () => {
  expectContractCode("EVENT_VERSION_UNSUPPORTED", () => assertSessionEvent({ ...event(1), version: 2 }));
  expectContractCode("EVENT_PAYLOAD_INVALID", () => assertSessionEvent({ ...event(1), type: "run.unknown" }));
  expectContractCode("EVENT_PAYLOAD_INVALID", () => assertSessionEvent({ ...event(1), payload: JSON.parse('{"__proto__":"unsafe"}') }));
  // Each emoji requires four UTF-8 bytes but two UTF-16 code units.
  expectContractCode("EVENT_PAYLOAD_INVALID", () => assertSessionEvent({ ...event(1), payload: "😀".repeat(Math.ceil(BROWSER_EVENT_MAX_BYTES / 4)) }));
});

test("visible state checking stays derived from ROOT_RUN_STATES", () => {
  for (const state of ROOT_RUN_STATES) assert.equal(isVisibleRootRunState(state), true);
  assert.equal(isVisibleRootRunState("awaiting_action_approval"), false);
});
