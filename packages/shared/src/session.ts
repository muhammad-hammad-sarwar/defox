export type SessionStatus = "creating" | "ready" | "failed" | "stopped";
export type SandboxStatus = SessionStatus;

export interface SessionRepository {
  githubRepositoryId: string;
  fullName: string;
  ownerLogin: string;
  name: string;
  defaultBranch: string;
}

export interface SessionResponse {
  id: string;
  title: string;
  repositories: SessionRepository[];
  sandbox: { sandboxId: string; status: SandboxStatus };
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}
