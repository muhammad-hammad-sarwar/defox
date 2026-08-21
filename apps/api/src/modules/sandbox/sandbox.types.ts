export type SandboxStatus = "creating" | "ready" | "failed" | "stopped";

export interface SandboxInfo {
  sandboxId: string;
  status: SandboxStatus;
}

export interface SandboxCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CloneResult extends SandboxCommandResult {
  repository: string;
  directory: string;
  success: boolean;
}