import { randomBytes } from "node:crypto";

import type { GitHubAccountDto, GitHubConnectionDto } from "@defox/shared";

import { getEnv } from "../../config/env.js";
import { ApiError } from "../../lib/api-error.js";
import { logger } from "../../lib/logger.js";
import { GitHubCloneGrantModel } from "../../models/github-clone-grant.model.js";
import {
  GitHubInstallationModel,
  type GitHubInstallationDocument,
} from "../../models/github-installation.model.js";
import { GitHubOAuthStateModel } from "../../models/github-oauth-state.model.js";
import { GitHubRepositoryModel } from "../../models/github-repository.model.js";
import type { UserDocument } from "../../models/user.model.js";
import {
  GITHUB_BASE_URL,
  OAUTH_STATE_TTL_MINUTES,
} from "./github.constants.js";
import {
  fetchInstallation,
  getOctokitForOAuthCode,
  invalidateInstallationToken,
  userCanAccessInstallation,
} from "./github.service.js";
import { syncInstallationRepositories } from "./github.repository.service.js";

/** Creates a single-use state and the GitHub App installation URL for a user. */
export async function createInstallationUrl(
  user: UserDocument,
  redirectPath: string,
): Promise<string> {
  const env = getEnv();
  const state = randomBytes(32).toString("hex");

  await GitHubOAuthStateModel.create({
    userId: user._id,
    state,
    redirectPath,
    expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MINUTES * 60 * 1000),
  });

  const url = new URL(
    `${GITHUB_BASE_URL}/apps/${env.GITHUB_APP_SLUG}/installations/new`,
  );
  url.searchParams.set("state", state);
  return url.toString();
}

export interface ConsumedState {
  userId: string;
  redirectPath: string;
}

/** Validates and burns an installation state. Replays are rejected. */
export async function consumeInstallationState(
  state: string,
): Promise<ConsumedState> {
  const record = await GitHubOAuthStateModel.findOneAndUpdate(
    { state, consumedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { consumedAt: new Date() } },
    { new: true },
  );

  if (!record) {
    throw new ApiError(
      400,
      "GITHUB_INVALID_STATE",
      "The GitHub installation link is invalid or has expired",
    );
  }

  return {
    userId: record.userId.toString(),
    redirectPath: record.redirectPath,
  };
}

export interface HandleCallbackInput {
  userId: string;
  installationId: number;
  /** OAuth code returned when the App requests user authorization on install. */
  code?: string;
}

/**
 * Persists an installation for the application user that started the flow and
 * synchronizes the repositories GitHub grants it.
 */
export async function handleInstallationCallback(
  input: HandleCallbackInput,
): Promise<GitHubInstallationDocument> {
  const installation = await fetchInstallation(input.installationId);

  if (input.code) {
    // Extra defence: confirm the GitHub user who authorized the flow actually
    // has access to the installation id supplied in the callback.
    const userOctokit = await getOctokitForOAuthCode(input.code);
    const allowed = await userCanAccessInstallation(
      userOctokit,
      input.installationId,
    );
    if (!allowed) {
      throw new ApiError(
        403,
        "GITHUB_INVALID_INSTALLATION",
        "The authorizing GitHub user cannot access this installation",
      );
    }
  }
  const existing = await GitHubInstallationModel.findOne({
    installationId: installation.installationId,
  });

  if (existing && existing.userId.toString() !== input.userId) {
    throw new ApiError(
      409,
      "GITHUB_INVALID_INSTALLATION",
      "This GitHub installation is already connected to another account",
    );
  }
  const document = await GitHubInstallationModel.findOneAndUpdate(
    { installationId: installation.installationId },
    {
      $set: {
        userId: input.userId,
        githubAccountId: installation.accountId,
        githubAccountLogin: installation.accountLogin,
        githubAccountType: installation.accountType,
        githubAccountAvatarUrl: installation.accountAvatarUrl,
        githubRepositorySelection: installation.githubRepositorySelection,
        status: installation.suspended ? "suspended" : "active",
      },
      $setOnInsert: { repositorySelection: "all" },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  if (!document) {
    throw ApiError.internal("Failed to persist the GitHub installation");
  }

  await syncInstallationRepositories(document);

  logger.info("github installation connected", {
    userId: input.userId,
    installationId: document.installationId,
    account: document.githubAccountLogin,
  });

  return document;
}

/** The installation backing the authenticated user's GitHub connection. */
export async function findActiveInstallation(
  userId: string,
): Promise<GitHubInstallationDocument | null> {
  return GitHubInstallationModel.findOne({
    userId,
    status: { $ne: "removed" },
  }).sort({ updatedAt: -1 });
}

export async function requireActiveInstallation(
  userId: string,
): Promise<GitHubInstallationDocument> {
  const installation = await findActiveInstallation(userId);
  if (!installation) {
    throw new ApiError(404, "GITHUB_NOT_CONNECTED", "GitHub is not connected");
  }
  if (installation.status === "suspended") {
    throw new ApiError(
      403,
      "GITHUB_INSTALLATION_REMOVED",
      "The GitHub App installation is suspended",
    );
  }
  return installation;
}

function toAccountDto(
  installation: GitHubInstallationDocument,
): GitHubAccountDto {
  return {
    id: installation.githubAccountId,
    login: installation.githubAccountLogin,
    type: installation.githubAccountType,
    avatarUrl: installation.githubAccountAvatarUrl ?? null,
  };
}

export async function getConnection(
  userId: string,
): Promise<GitHubConnectionDto> {
  const env = getEnv();
  const installation = await findActiveInstallation(userId);

  if (!installation) {
    return {
      connected: false,
      installation: null,
      account: null,
      repositorySelection: null,
      appSlug: env.GITHUB_APP_SLUG,
    };
  }

  const account = toAccountDto(installation);
  return {
    connected: installation.status === "active",
    installation: {
      installationId: installation.installationId,
      account,
      githubRepositorySelection: installation.githubRepositorySelection,
      repositorySelection: installation.repositorySelection,
      connectedAt: installation.createdAt.toISOString(),
      updatedAt: installation.updatedAt.toISOString(),
      manageUrl: buildManageInstallationUrl(installation),
    },
    account,
    repositorySelection: installation.repositorySelection,
    appSlug: env.GITHUB_APP_SLUG,
  };
}

/** Forgets the local installation record and its repository metadata. */
export async function disconnectInstallation(userId: string): Promise<void> {
  const installation = await requireActiveInstallation(userId);

  await GitHubRepositoryModel.deleteMany({
    userId,
    installationId: installation.installationId,
  });
  await GitHubCloneGrantModel.deleteMany({
    userId,
    installationId: installation.installationId,
  });
  await GitHubInstallationModel.deleteOne({ _id: installation._id });
  invalidateInstallationToken(installation.installationId);

  logger.info("github installation disconnected", {
    userId,
    installationId: installation.installationId,
  });
}

/** Marks an installation as removed/suspended (used by webhook handling). */
export async function markInstallationStatus(
  installationId: number,
  status: "active" | "suspended" | "removed",
): Promise<void> {
  invalidateInstallationToken(installationId);
  await GitHubInstallationModel.updateOne(
    { installationId },
    { $set: { status } },
  );
}

/** Builds the GitHub page where a user manages which repositories are shared. */
export function buildManageInstallationUrl(
  installation: GitHubInstallationDocument,
): string {
  return installation.githubAccountType === "Organization"
    ? `${GITHUB_BASE_URL}/organizations/${installation.githubAccountLogin}/settings/installations/${installation.installationId}`
    : `${GITHUB_BASE_URL}/settings/installations/${installation.installationId}`;
}
