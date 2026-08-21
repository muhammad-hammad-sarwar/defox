import { createHash } from "node:crypto";

import { Sandbox } from "@e2b/code-interpreter";

import { getEnv } from "../../config/env.js";
import { ApiError } from "../../lib/api-error.js";
import { logger } from "../../lib/logger.js";
import {
  SANDBOX_TIMEOUT_MS,
  WORKSPACE_DIRECTORY,
} from "./sandbox.constants.js";
import { buildSandboxArgvCommand } from "./argv.js";
import type {
  CloneResult,
  SandboxCommandResult,
  SandboxInfo,
} from "./sandbox.types.js";

type SandboxForClone = Pick<Sandbox, "commands" | "files" | "sandboxId">;

function safeDirectoryName(repositoryName: string): string {
  const segments = repositoryName.split("/");
  if (
    segments.length !== 2 ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw ApiError.badRequest("Repository has an invalid full name");
  }

  const canonicalName = segments
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^\.+/, ""))
    .join("--")
    .slice(0, 100);
  const suffix = createHash("sha256").update(repositoryName).digest("hex").slice(0, 12);
  if (!canonicalName || canonicalName === "." || canonicalName === "..") {
    throw ApiError.badRequest("Repository has an invalid directory name");
  }
  return `${canonicalName}-${suffix}`;
}

function askpassPath(repositoryName: string): string {
  const suffix = createHash("sha256").update(repositoryName).digest("hex").slice(0, 24);
  return `${WORKSPACE_DIRECTORY}/.defox-git-askpass-${suffix}`;
}

/**
 * Git invokes this script only for the HTTPS username/password prompts. The
 * credentials remain invocation-scoped environment values and are never put in
 * a command string, git remote URL, or sandbox file.
 */
const GIT_ASKPASS_SCRIPT = `#!/bin/sh
case "$1" in
  *Username*) printf '%s\\n' "$DEFOX_GIT_ASKPASS_USERNAME" ;;
  *Password*) printf '%s\\n' "$DEFOX_GIT_ASKPASS_PASSWORD" ;;
  *) exit 1 ;;
esac
`;

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

export async function createSandbox(): Promise<SandboxInfo & { sandbox: Sandbox }> {
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
    const result = await sandbox.commands.run(
      buildSandboxArgvCommand({ executable: "pwd" }),
      { cwd: "/" },
    );
    const mapped = commandResult(result);
    if (mapped.exitCode !== 0) throw new Error("sandbox health check failed");
    logger.info("sandbox health check passed", { sandboxId: sandbox.sandboxId });
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
  sandbox: SandboxForClone,
  repository: { fullName: string; cloneUrl: string; defaultBranch: string },
  credentials: { token: string; tokenUsername: string },
): Promise<CloneResult> {
  const directory = `${WORKSPACE_DIRECTORY}/${safeDirectoryName(repository.fullName)}`;
  const askpass = askpassPath(repository.fullName);

  logger.info("cloning repository started", {
    sandboxId: sandbox.sandboxId,
    repository: repository.fullName,
  });

  try {
    await sandbox.files.makeDir(WORKSPACE_DIRECTORY);
    await sandbox.files.write(askpass, GIT_ASKPASS_SCRIPT);
    const chmodResult = await sandbox.commands.run(
      buildSandboxArgvCommand({ executable: "chmod", args: ["700", askpass] }),
      { cwd: WORKSPACE_DIRECTORY },
    );
    if (chmodResult.exitCode !== 0) {
      throw new Error("could not secure temporary git askpass helper");
    }

    const result = await sandbox.commands.run(
      buildSandboxArgvCommand({
        executable: "git",
        args: ["clone", "--branch", repository.defaultBranch, "--", repository.cloneUrl, directory],
      }),
      {
        cwd: WORKSPACE_DIRECTORY,
        envs: {
          GIT_ASKPASS: askpass,
          GIT_ASKPASS_REQUIRE: "force",
          GIT_TERMINAL_PROMPT: "0",
          DEFOX_GIT_ASKPASS_USERNAME: credentials.tokenUsername,
          DEFOX_GIT_ASKPASS_PASSWORD: credentials.token,
        },
      },
    );
    const mapped = commandResult(result);
    const cloneResult = {
      repository: repository.fullName,
      directory,
      success: mapped.exitCode === 0,
      ...mapped,
    };

    logger.info("cloning repository completed", {
      sandboxId: sandbox.sandboxId,
      repository: repository.fullName,
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
  } finally {
    try {
      await sandbox.files.remove(askpass);
    } catch {
      // The sandbox may have terminated; its filesystem is already gone.
    }
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
