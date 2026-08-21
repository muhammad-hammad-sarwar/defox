export type SessionStatus = "creating" | "ready" | "failed" | "stopped";
export type SandboxStatus = SessionStatus;

export interface SessionRepository {
  githubRepositoryId: string;
  fullName: string;
  ownerLogin: string;
  name: string;
  defaultBranch: string;
}

/**
 * User-facing historical session summary. `repositories` deliberately remains
 * an array because pre-v1 sessions can contain multiple repositories. New v1
 * root runs use `RootRunSnapshot.repository` and always contain exactly one.
 */
export interface SessionResponse {
  id: string;
  title: string;
  repositories: SessionRepository[];
  sandbox: { sandboxId: string; status: SandboxStatus };
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  /** Optimistic revision when supplied by v1-capable APIs; absent on historical records. */
  revision?: number;
}
