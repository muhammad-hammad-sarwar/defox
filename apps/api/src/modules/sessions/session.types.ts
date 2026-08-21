import type { SessionResponse as SharedSessionResponse } from "@defox/shared";

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

export interface SessionResponse extends SharedSessionResponse {
  sandbox: SandboxInfo;
  revision?: number;
}

export type { CloneResult };
