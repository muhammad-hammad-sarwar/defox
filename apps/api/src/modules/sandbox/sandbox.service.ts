import { Sandbox } from "@e2b/code-interpreter";

import { getEnv } from "../../config/env.js";
import { ApiError } from "../../lib/api-error.js";
import { logger } from "../../lib/logger.js";
import {
  SANDBOX_TIMEOUT_MS,
  WORKSPACE_DIRECTORY,
} from "./sandbox.constants.js";
import type {
  CloneResult,
  SandboxCommandResult,
  SandboxInfo,
} from "./sandbox.types.js";

function safeDirectoryName(repositoryName: string): string {
  const name = repositoryName
    .split("/")
    .at(-1)
    ?.replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 100);
  if (!name || name === "." || name === "..") {
    throw ApiError.badRequest("Repository has an invalid directory name");
  }
  return name;
}

function commandResult(result: {
  stdout: string;
  stderr: string;
  exitCode: number;
}): SandboxCommandResult {
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}

export async function createSandbox(): Promise<
  SandboxInfo & { sandbox: Sandbox }
> {
  try {
    const sandbox = await Sandbox.create({
      apiKey: getEnv().E2B_API_KEY,
      timeoutMs: SANDBOX_TIMEOUT_MS,
      metadata: { purpose: "coding-session" },
    });
    logger.info("sandbox created", { sandboxId: sandbox.sandboxId });
    return { sandboxId: sandbox.sandboxId, status: "creating", sandbox };
  } catch {
    throw new ApiError(
      502,
      "SESSION_CREATION_FAILED",
      "Could not create the coding sandbox",
    );
  }
}

export async function healthCheck(
  sandbox: Sandbox,
): Promise<SandboxCommandResult> {
  try {
    const result = await sandbox.commands.run("pwd && echo sandbox-ready", {
      cwd: "/",
    });
    const mapped = commandResult(result);
    if (mapped.exitCode !== 0) throw new Error("sandbox health check failed");
    logger.info("sandbox health check passed", {
      sandboxId: sandbox.sandboxId,
    });
    return mapped;
  } catch {
    throw new ApiError(
      502,
      "SESSION_CREATION_FAILED",
      "The coding sandbox failed its health check",
    );
  }
}

export async function cloneRepository(
  sandbox: Sandbox,
  repository: { fullName: string; cloneUrl: string; defaultBranch: string },
  credentials: { token: string; tokenUsername: string },
): Promise<CloneResult> {
  const directory = `${WORKSPACE_DIRECTORY}/${safeDirectoryName(repository.fullName)}`;

  const command = [
    "mkdir -p workspace",
    "cd workspace",
    `git clone ${repository?.cloneUrl}`,
  ].join("\n");

  logger.info("cloning repository started", {
    sandboxId: sandbox.sandboxId,
    repository: repository.fullName,
    directory,
  });

  try {
    logger.info("CREDENTIALS", credentials.tokenUsername);
    const result = await sandbox.commands.run(command, {
      envs: {
        GIT_USERNAME: credentials.tokenUsername,
        GIT_PASSWORD: credentials.token,
        GIT_CLONE_URL: repository.cloneUrl,
        GIT_TARGET: directory,
        GIT_BRANCH: repository.defaultBranch,
      },
    });
    const mapped = commandResult(result);

    const cloneResult = {
      repository: repository.fullName,
      directory,
      success: mapped.exitCode === 0,
      ...mapped,
    };

    logger.info("CLONE RESULT", cloneResult);
    logger.info("cloning repository completed", {
      sandboxId: sandbox.sandboxId,
      repository: repository.fullName,
      directory,
      success: cloneResult.success,
    });
    return cloneResult;
  } catch (error) {
    logger.error("clone command threw", {
      sandboxId: sandbox.sandboxId,
      repository: repository.fullName,
      error,
    });

    return {
      repository: repository.fullName,
      directory,
      success: false,
      stdout: "",
      stderr: "Repository clone failed",
      exitCode: 1,
    };
  }
}

export async function terminateSandbox(sandboxId: string): Promise<void> {
  logger.info("sandbox cleanup started", { sandboxId });
  try {
    await Sandbox.kill(sandboxId, { apiKey: getEnv().E2B_API_KEY });
  } catch {
    // An already terminated sandbox is the desired cleanup state.
  }
  logger.info("sandbox cleanup completed", { sandboxId });
}
