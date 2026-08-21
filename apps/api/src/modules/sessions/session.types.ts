import type { CloneResult, SandboxInfo } from "../sandbox/sandbox.types.js";

export type SessionStatus = "creating" | "ready" | "failed" | "stopped";

export interface SessionRepository {
  githubRepositoryId: string;
  fullName: string;
  ownerLogin: string;
  name: string;
  defaultBranch: string;
}

export interface CreateSessionInput {
  repositoryIds: string[];
  title?: string;
}

export interface SessionResponse {
  id: string;
  title: string;
  repositories: SessionRepository[];
  sandbox: SandboxInfo;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

export type { CloneResult };
