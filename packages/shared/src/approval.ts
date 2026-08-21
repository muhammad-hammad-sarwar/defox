import { ContractValidationError, assertNonEmptyString, assertNonNegativeInteger } from "./contracts.js";

export const APPROVAL_ACTIONS = ["push_branch", "create_draft_pr", "mark_pr_ready", "squash_merge"] as const;
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];
export const APPROVAL_STATES = ["pending", "approved", "rejected", "expired", "invalidated", "consumed"] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];
export const APPROVAL_DECISIONS = ["approve", "reject"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export interface ApprovalEvidence {
  repositoryFullName: string;
  targetBranch: string;
  baseSha: string;
  headSha: string;
  diffHash: string;
  checkSnapshotHash: string;
  reviewSnapshotHash: string;
  pullRequestNumber: number | null;
}

export interface ApprovalRequest {
  id: string;
  rootRunId: string;
  action: ApprovalAction;
  state: ApprovalState;
  generation: number;
  revision: number;
  idempotencyKey: string;
  requestedByUserId: string;
  evidence: ApprovalEvidence;
  expiresAt: string;
  createdAt: string;
  decidedAt: string | null;
}

export interface ApprovalDecisionRequest {
  expectedRevision: number;
  idempotencyKey: string;
  decision: ApprovalDecision;
  feedback?: string;
}

/** Evidence is scalar-only, so compare each bound value independent of object key order. */
export function approvalEvidenceMatches(left: ApprovalEvidence, right: ApprovalEvidence): boolean {
  return left.repositoryFullName === right.repositoryFullName &&
    left.targetBranch === right.targetBranch &&
    left.baseSha === right.baseSha &&
    left.headSha === right.headSha &&
    left.diffHash === right.diffHash &&
    left.checkSnapshotHash === right.checkSnapshotHash &&
    left.reviewSnapshotHash === right.reviewSnapshotHash &&
    left.pullRequestNumber === right.pullRequestNumber;
}

/** Any generation or evidence change invalidates the single-use protected-effect approval. */
export function approvalMatches(
  approval: ApprovalRequest,
  current: Pick<ApprovalRequest, "generation" | "evidence">,
  now: string,
): boolean {
  return approval.state === "approved" && approval.generation === current.generation &&
    approval.expiresAt > now && approvalEvidenceMatches(approval.evidence, current.evidence);
}

export function assertApprovalDecision(approval: ApprovalRequest, request: ApprovalDecisionRequest, now: string): void {
  assertNonNegativeInteger(request.expectedRevision, "expectedRevision");
  assertNonEmptyString(request.idempotencyKey, "idempotencyKey");
  if (!APPROVAL_DECISIONS.includes(request.decision))
    throw new ContractValidationError("VALIDATION_ERROR", `Unknown approval decision: ${String(request.decision)}`);
  if (approval.revision !== request.expectedRevision)
    throw new ContractValidationError("STALE_REVISION", "Approval revision is stale");
  if (approval.state !== "pending" || approval.expiresAt <= now)
    throw new ContractValidationError("APPROVAL_STALE", "Approval is no longer pending");
}

export const GITHUB_ACTION_STATUSES = ["pending", "running", "succeeded", "failed", "reconciled"] as const;
export type GitHubActionStatus = (typeof GITHUB_ACTION_STATUSES)[number];
export interface GitHubAction {
  id: string;
  rootRunId: string;
  approvalId: string;
  action: ApprovalAction;
  idempotencyKey: string;
  status: GitHubActionStatus;
  attempt: number;
  externalId: string | null;
  completedAt: string | null;
}
