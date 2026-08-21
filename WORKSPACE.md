# Defox workspace contracts

## Scope and compatibility

`packages/shared` is the browser/API/worker contract boundary. All durable values
that reach the browser must be versioned, JSON-compatible, bounded, redacted,
and scoped by session, root run, generation, and (where relevant) track.

Existing `SessionResponse` records remain readable and retain their
`repositories: SessionRepository[]` shape. They may represent historical
multi-repository sessions. This compatibility does **not** authorize new work:
every v1 `RootRunSnapshot` has exactly one `repository`, a captured `baseSha`,
and a `baseRef`. `assertExactlyOneRepository` must guard v1 root-run creation.

V1 has one primary repository/root run per session, one shared reconnectable
sandbox per root run, and one to three disjoint Coder tracks. The Integrator,
Tester, and Reviewer are serial roles on the canonical integration branch.

## State, revisions, and interruption

Root-run transitions are exhaustively defined in `root-run.ts`. Terminal states
(`completed`, `failed`, `cancelled`, `expired`) have no outbound transitions.
`cancel_requested` is a command flag, not a state. Protected effects progress
through separately visible, approval-gated states: `awaiting_push_approval` →
`pushing` → `awaiting_draft_pr_approval` → `creating_draft_pr` →
`awaiting_mark_ready_approval` → `marking_pr_ready` →
`awaiting_merge_approval` → `merging`. A product may stop after push or a draft
PR, but it may not imply that draft creation or marking-ready was pre-approved.

A user follow-up is persisted with an `interrupt_requested` event, moves the
run to `interrupt_requested`, and increments `generation`. This is legal even
from `queued`, `awaiting_user`, and `needs_human`, so follow-ups receive the
same immediate durable acknowledgement before runtime work exists or resumes.
Work carrying the old generation cannot mutate durable state or begin new tools. The runtime then
uses `interrupting` while it cancels model/tool work, drains leases, checkpoints
safe changes, and identifies uncertain effects. It re-enters `planning` only
with the new generation and must visibly reuse, discard, or supersede each
checkpoint. Protected GitHub effects reconcile by idempotency key and a
follow-up invalidates evidence-bound approvals rather than changing approved
action intent.

Every mutation uses an idempotency key and an expected content revision. A stale
revision, stale generation, duplicate key with a different request, invalid
transition, unavailable command, or ownership violation must return the stable
API codes in `api.ts` rather than silently succeeding.

## Tracks, worktrees, and paths

Planner output is validated by `assertValidTrackPlan`: it creates 1–3 tracks,
requires acyclic dependencies, a worktree/branch per track, and non-empty,
disjoint repository-relative ownership roots. Paths reject absolute paths,
traversal, symlink escape at the tool boundary, and `.git`; a Coder can only
write `assertTrackOwnsPath` paths. Dependencies become runnable after an
upstream `checkpointed` handoff commit (or `integrated`), allowing viable
ordered work without waiting for canonical integration. Attempts and generations
are recorded on tracks, agents, and steps.

## SSE and browser payloads

SSE is session-scoped. Each `SessionEvent` has stable schema `version: 1`, a
strictly increasing session cursor, an event ID/type, occurrence timestamp, and
optional root-run/generation scope. Cursor gaps are valid after crashes; duplicate
or late events are ignored by the reducer. On retention loss, unknown cursor, or
schema reset the server emits `stream.reset` with snapshot and retention cursors;
the client reloads the snapshot then resumes replay. Unknown schema versions and
malformed payloads fail closed. Reset cursors are non-negative safe integers
and the snapshot cursor cannot precede the oldest available cursor. Event
payloads are JSON-only, prevent unsafe prototype keys, have bounded nesting,
and are capped at 64 KiB measured in UTF-8 bytes before rendering.

## Checks, artifacts, approvals, and egress

Checks are always one of `passed`, `failed`, `skipped`, or `unavailable`.
Skipped/unavailable results require a visible reason and are not automatically
reclassified as product failures. Review findings have a severity and an
`accept`/`request_changes`/`blocked` outcome. Files, commands, preview state,
artifacts, usage, agent steps, and messages carry their root-run/generation
context where applicable.

Approvals bind one exact GitHub action to repository/target/base/head/diff/check
and review evidence, generation, revision, user, expiry, and idempotency key.
Evidence comparison is fieldwise/canonical rather than dependent on serialized
object-key order. Decisions use the canonical `approve`/`reject` vocabulary.
Approvals are invalid when any bound evidence or generation changes, and are
single-use once consumed. Browser contracts never expose sandbox IDs, E2B hosts,
envd tokens, GitHub installation tokens, private keys, raw credentials, or
hidden model reasoning.

Source snippets, diffs, structured prompts, and selected browser/repository
content may be sent to the configured model provider (xAI in v1). The GitHub
webhook HMAC secret must be non-empty to keep delivery verification enabled;
use a random value of at least 16 characters in production. Existing shorter
secrets emit a startup warning without disclosing the value. Persist only
redacted user-visible summaries, validated output, model/response IDs, usage,
timing, decisions, and audit evidence. Do not persist chain-of-thought or
credentials. Preview traffic remains proxied by Defox; browser clients receive
only authenticated application URLs.

## Explicit v2 boundary

V2 candidates are multiple repositories per root run, more than three or
dynamically-created specialist tracks, distributed sandboxes, cross-session
memory, autonomous deployment/publishing, non-squash merge strategies, and
interactive terminal WebSockets. None are implied by the v1 contracts.
