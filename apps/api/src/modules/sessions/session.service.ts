import { ApiError } from "../../lib/api-error.js";
import { logger } from "../../lib/logger.js";
import {
  SessionModel,
  type SessionDocument,
} from "../../models/session.model.js";
import {
  authorizeRepositoryForUser,
  getRepositoryForSession,
  redeemCloneGrant,
} from "../github/github.repository.service.js";
import {
  cloneRepository,
  createSandbox,
  healthCheck,
  terminateSandbox,
} from "../sandbox/sandbox.service.js";
import type { SessionResponse } from "./session.types.js";

function toResponse(session: SessionDocument): SessionResponse {
  return {
    id: session.id,
    title: session.title,
    repositories: session.repositories,
    sandbox: {
      sandboxId: session.sandbox.sandboxId ?? "",
      status: session.sandbox.status,
    },
    status: session.status,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    revision: session.__v,
  };
}

export async function createSession(
  userId: string,
  input: { repositoryIds: string[]; title?: string },
): Promise<SessionResponse> {
  logger.info("session creation started", {
    userId,
    repositoryCount: input.repositoryIds.length,
  });

  const authorized = await Promise.all(
    input.repositoryIds.map((repositoryId) =>
      authorizeRepositoryForUser(userId, repositoryId),
    ),
  );

  logger.info("session repositories validated", {
    userId,
    repositoryCount: authorized.length,
  });

  const session = await SessionModel.create({
    userId,
    title: input.title ?? "New Coding Session",
    repositories: authorized.map(({ repository }) => ({
      ...repository,
      ownerLogin: repository.fullName.split("/")[0] ?? "unknown",
      name: repository.fullName.split("/").at(-1) ?? repository.fullName,
    })),
    sandbox: { sandboxId: null, status: "creating" },
    status: "creating",
  });

  let sandboxId: string | null = null;
  try {
    const sandbox = await createSandbox();
    sandboxId = sandbox.sandboxId;
    session.sandbox = { sandboxId, status: "creating" };
    await session.save();
    await healthCheck(sandbox.sandbox);

    for (const item of authorized) {
      const grant = await getRepositoryForSession(
        userId,
        item.repository.githubRepositoryId,
      );

      const credentials = await redeemCloneGrant(
        item.repository.githubRepositoryId,
        grant.cloneGrant.token,
      );

      const result = await cloneRepository(
        sandbox.sandbox,
        credentials.repository,
        credentials,
      );
      if (!result.success)
        throw new Error(`clone failed for ${result.repository}`);
    }

    session.status = "ready";
    session.sandbox.status = "ready";
    await session.save();
    logger.info("session ready", { sessionId: session.id, sandboxId });
    return toResponse(session);
  } catch (error) {
    session.status = "failed";
    session.sandbox.status = "failed";
    await session.save();
    logger.error("session failed", { sessionId: session.id, sandboxId, error });
    if (sandboxId) await terminateSandbox(sandboxId);
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      502,
      "SESSION_CREATION_FAILED",
      "Could not prepare the coding session",
    );
  }
}

export async function listSessions(userId: string): Promise<SessionResponse[]> {
  const sessions = await SessionModel.find({ userId }).sort({ createdAt: -1 });
  return sessions.map(toResponse);
}

export async function getSession(
  userId: string,
  sessionId: string,
): Promise<SessionResponse> {
  const session = await SessionModel.findOne({ _id: sessionId, userId });
  if (!session)
    throw new ApiError(404, "SESSION_NOT_FOUND", "Session not found");
  return toResponse(session);
}

export async function deleteSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  const session = await SessionModel.findOne({ _id: sessionId, userId });
  if (!session)
    throw new ApiError(404, "SESSION_NOT_FOUND", "Session not found");
  if (session.sandbox.sandboxId)
    await terminateSandbox(session.sandbox.sandboxId);
  session.status = "stopped";
  session.sandbox.status = "stopped";
  await session.save();
}
