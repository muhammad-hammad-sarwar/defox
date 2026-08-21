import { createHash, randomBytes } from "node:crypto";

import type {
  GitHubRepositoryDto,
  Paginated,
  RepositoryCloneCredentials,
  RepositorySelection,
  SessionRepositoryAuthorization,
  UpdateRepositoryAccessRequest,
  UpdateRepositoryAccessResponse,
} from "@defox/shared";

import { ApiError } from "../../lib/api-error.js";
import { logger } from "../../lib/logger.js";
import { GitHubCloneGrantModel } from "../../models/github-clone-grant.model.js";
import type { GitHubInstallationDocument } from "../../models/github-installation.model.js";
import {
  GitHubRepositoryModel,
  type GitHubRepositoryDocument,
} from "../../models/github-repository.model.js";
import { CLONE_GRANT_TTL_MS } from "./github.constants.js";
import { requireActiveInstallation } from "./github.installation.service.js";
import {
  fetchInstallationRepositories,
  getInstallationAccessToken,
} from "./github.service.js";
import type { ListRepositoriesOptions } from "./github.types.js";

function hashGrantToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function toRepositoryDto(
  repository: GitHubRepositoryDocument,
  installation: GitHubInstallationDocument,
): GitHubRepositoryDto {
  return {
    id: repository.id as string,
    githubRepositoryId: repository.githubRepositoryId,
    name: repository.name,
    fullName: repository.fullName,
    ownerLogin: repository.ownerLogin,
    private: repository.private,
    defaultBranch: repository.defaultBranch,
    htmlUrl: repository.htmlUrl,
    cloneUrl: repository.cloneUrl,
    permissions: repository.permissions,
    selected:
      installation.repositorySelection === "all" ? true : repository.selected,
    updatedAt: repository.updatedAt.toISOString(),
  };
}

/**
 * Replaces the locally cached repository metadata with what GitHub currently
 * grants the installation, preserving the user's own selection.
 */
export async function syncInstallationRepositories(
  installation: GitHubInstallationDocument,
): Promise<number> {
  const repositories = await fetchInstallationRepositories(
    installation.installationId,
  );
  // Newly granted repositories are enabled by default only while the user is
  // sharing everything; otherwise they stay opt-in.
  const selectByDefault = installation.repositorySelection === "all";

  if (repositories.length > 0) {
    await GitHubRepositoryModel.bulkWrite(
      repositories.map((repository) => ({
        updateOne: {
          filter: {
            installationId: installation.installationId,
            githubRepositoryId: repository.githubRepositoryId,
          },
          update: {
            $set: {
              userId: installation.userId,
              installationId: installation.installationId,
              ...repository,
            },
            $setOnInsert: { selected: selectByDefault },
          },
          upsert: true,
        },
      })),
    );
  }

  // Repositories GitHub no longer grants must disappear from the application.
  await GitHubRepositoryModel.deleteMany({
    installationId: installation.installationId,
    githubRepositoryId: {
      $nin: repositories.map((repo) => repo.githubRepositoryId),
    },
  });

  installation.repositoriesSyncedAt = new Date();
  await installation.save();

  logger.info("github repositories synced", {
    installationId: installation.installationId,
    count: repositories.length,
  });

  return repositories.length;
}

export async function listRepositories(
  userId: string,
  options: ListRepositoriesOptions,
): Promise<Paginated<GitHubRepositoryDto>> {
  const installation = await requireActiveInstallation(userId);

  const filter: Record<string, unknown> = {
    userId,
    installationId: installation.installationId,
  };
  if (options.search) {
    filter.fullName = { $regex: escapeRegExp(options.search), $options: "i" };
  }
  if (options.selectedOnly && installation.repositorySelection === "selected") {
    filter.selected = true;
  }

  const total = await GitHubRepositoryModel.countDocuments(filter);
  const documents = await GitHubRepositoryModel.find(filter)
    .sort({ fullName: 1 })
    .skip((options.page - 1) * options.perPage)
    .limit(options.perPage);

  const totalPages = Math.max(1, Math.ceil(total / options.perPage));
  return {
    items: documents.map((document) => toRepositoryDto(document, installation)),
    page: options.page,
    perPage: options.perPage,
    total,
    totalPages,
    hasNextPage: options.page < totalPages,
  };
}

/**
 * Applies the user's repository-access policy.
 * Every submitted id must already belong to the user's installation, so a
 * crafted repository id can never widen access.
 */
export async function updateRepositoryAccess(
  userId: string,
  input: UpdateRepositoryAccessRequest,
): Promise<UpdateRepositoryAccessResponse> {
  const installation = await requireActiveInstallation(userId);

  if (input.mode === "all") {
    installation.repositorySelection = "all";
    await installation.save();
    await GitHubRepositoryModel.updateMany(
      { userId, installationId: installation.installationId },
      { $set: { selected: true } },
    );
    const all = await GitHubRepositoryModel.find({
      userId,
      installationId: installation.installationId,
    }).select("githubRepositoryId");
    return {
      repositorySelection: "all",
      selectedRepositoryIds: all.map((repo) => repo.githubRepositoryId),
    };
  }

  const select = input.select ? [...new Set(input.select)] : [];
  const deselect = input.deselect ? [...new Set(input.deselect)] : [];
  const replacement = input.repositoryIds
    ? [...new Set(input.repositoryIds)]
    : null;

  await assertRepositoriesBelongToInstallation(userId, installation, [
    ...(replacement ?? []),
    ...select,
    ...deselect,
  ]);

  installation.repositorySelection = "selected";
  await installation.save();

  const scope = { userId, installationId: installation.installationId };

  if (replacement) {
    // Full replacement: the caller states the complete selection.
    await GitHubRepositoryModel.updateMany(scope, {
      $set: { selected: false },
    });
    if (replacement.length > 0) {
      await GitHubRepositoryModel.updateMany(
        { ...scope, githubRepositoryId: { $in: replacement } },
        { $set: { selected: true } },
      );
    }
  } else {
    // Delta update: repositories the caller never loaded keep their state.
    if (deselect.length > 0) {
      await GitHubRepositoryModel.updateMany(
        { ...scope, githubRepositoryId: { $in: deselect } },
        { $set: { selected: false } },
      );
    }
    if (select.length > 0) {
      await GitHubRepositoryModel.updateMany(
        { ...scope, githubRepositoryId: { $in: select } },
        { $set: { selected: true } },
      );
    }
  }

  const current = await GitHubRepositoryModel.find({
    ...scope,
    selected: true,
  }).select("githubRepositoryId");
  return {
    repositorySelection: "selected",
    selectedRepositoryIds: current.map((repo) => repo.githubRepositoryId),
  };
}

/** Rejects any repository id that is not granted to the user's installation. */
async function assertRepositoriesBelongToInstallation(
  userId: string,
  installation: GitHubInstallationDocument,
  repositoryIds: string[],
): Promise<void> {
  const requested = [...new Set(repositoryIds)];
  if (requested.length === 0) return;

  const owned = await GitHubRepositoryModel.find({
    userId,
    installationId: installation.installationId,
    githubRepositoryId: { $in: requested },
  }).select("githubRepositoryId");

  if (owned.length !== requested.length) {
    const ownedIds = new Set(owned.map((repo) => repo.githubRepositoryId));
    throw new ApiError(
      403,
      "GITHUB_UNAUTHORIZED_REPOSITORY",
      "One or more repositories are not available through your GitHub installation",
      { unknownRepositoryIds: requested.filter((id) => !ownedIds.has(id)) },
    );
  }
}

export async function getRepositorySelection(
  userId: string,
): Promise<RepositorySelection> {
  const installation = await requireActiveInstallation(userId);
  return installation.repositorySelection;
}

/**
 * The single authorization gate every future session/sandbox operation goes
 * through: authenticated user → installation → repository → selection policy.
 */
export async function authorizeRepositoryForUser(
  userId: string,
  githubRepositoryId: string,
): Promise<{
  repository: GitHubRepositoryDocument;
  installation: GitHubInstallationDocument;
}> {
  const installation = await requireActiveInstallation(userId);

  const repository = await GitHubRepositoryModel.findOne({
    userId,
    installationId: installation.installationId,
    githubRepositoryId,
  });

  if (!repository) {
    throw new ApiError(
      404,
      "GITHUB_REPOSITORY_UNAVAILABLE",
      "Repository is not available through your GitHub installation",
    );
  }

  if (installation.repositorySelection === "selected" && !repository.selected) {
    throw new ApiError(
      403,
      "GITHUB_REPOSITORY_NOT_SELECTED",
      "Repository is not enabled for this application",
    );
  }

  return { repository, installation };
}

/** Authorization result handed to the (future) session layer. */
export async function getRepositoryForSession(
  userId: string,
  githubRepositoryId: string,
): Promise<SessionRepositoryAuthorization> {
  const { repository, installation } = await authorizeRepositoryForUser(
    userId,
    githubRepositoryId,
  );

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + CLONE_GRANT_TTL_MS);
  await GitHubCloneGrantModel.create({
    userId: repository.userId,
    githubRepositoryId: repository.githubRepositoryId,
    installationId: installation.installationId,
    tokenHash: hashGrantToken(token),
    expiresAt,
  });

  return {
    authorized: true,
    repository: {
      githubRepositoryId: repository.githubRepositoryId,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      private: repository.private,
    },
    installationId: installation.installationId,
    cloneGrant: { token, expiresAt: expiresAt.toISOString() },
  };
}

/**
 * Redeems a single-use grant issued by `getRepositoryForSession`. The acting
 * user comes from the grant, never from the caller, so the internal service
 * token cannot be used to reach another tenant's repository.
 */
export async function redeemCloneGrant(
  githubRepositoryId: string,
  grantToken: string,
): Promise<RepositoryCloneCredentials> {
  const grant = await GitHubCloneGrantModel.findOneAndUpdate(
    {
      tokenHash: hashGrantToken(grantToken),
      githubRepositoryId,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { consumedAt: new Date() } },
  );


  if (!grant) {
    throw new ApiError(
      403,
      "GITHUB_UNAUTHORIZED_REPOSITORY",
      "Clone grant is invalid, expired, or already used",
    );
  }

  return getRepositoryCloneCredentials(
    grant.userId.toString(),
    githubRepositoryId,
  );
}

/**
 * Produces short-lived clone credentials for the future sandbox service.
 * Nothing here is persisted and the token never reaches a browser response.
 */
export async function getRepositoryCloneCredentials(
  userId: string,
  githubRepositoryId: string,
): Promise<RepositoryCloneCredentials> {
  const { repository, installation } = await authorizeRepositoryForUser(
    userId,
    githubRepositoryId,
  );

  if (!repository.permissions.pull) {
    throw new ApiError(
      403,
      "GITHUB_INSUFFICIENT_PERMISSIONS",
      "The installation cannot read this repository",
    );
  }

  const { token, expiresAt } = await getInstallationAccessToken(
    installation.installationId,
  );


  return {
    repository: {
      githubRepositoryId: repository.githubRepositoryId,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      cloneUrl: repository.cloneUrl,
    },
    token,
    tokenUsername: "x-access-token",
    expiresAt: expiresAt.toISOString(),
  };
}

export async function refreshRepositories(userId: string): Promise<number> {
  const installation = await requireActiveInstallation(userId);
  return syncInstallationRepositories(installation);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
