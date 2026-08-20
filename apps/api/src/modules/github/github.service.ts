import { createAppAuth } from "@octokit/auth-app";
import { RequestError } from "@octokit/request-error";
import { Octokit } from "@octokit/rest";

import { getEnv } from "../../config/env.js";
import { ApiError } from "../../lib/api-error.js";
import { logger } from "../../lib/logger.js";
import { INSTALLATION_TOKEN_REFRESH_MARGIN_SECONDS } from "./github.constants.js";
import type {
  InstallationToken,
  NormalizedInstallation,
  NormalizedRepository,
} from "./github.types.js";

type AppAuth = ReturnType<typeof createAppAuth>;

let appAuthInstance: AppAuth | null = null;
let appOctokitInstance: Octokit | null = null;

/**
 * Cache of short-lived installation tokens. Tokens live in memory only: they
 * are never persisted and are dropped as soon as they approach expiry.
 */
const installationTokenCache = new Map<number, InstallationToken>();

function getAppAuth(): AppAuth {
  if (appAuthInstance) return appAuthInstance;
  const env = getEnv();
  appAuthInstance = createAppAuth({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_PRIVATE_KEY,
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
  });
  return appAuthInstance;
}

/** Octokit authenticated as the GitHub App itself (JWT). */
export function getAppOctokit(): Octokit {
  if (appOctokitInstance) return appOctokitInstance;
  const env = getEnv();
  appOctokitInstance = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_PRIVATE_KEY,
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  });
  return appOctokitInstance;
}

function isFresh(token: InstallationToken): boolean {
  const marginMs = INSTALLATION_TOKEN_REFRESH_MARGIN_SECONDS * 1000;
  return token.expiresAt.getTime() - marginMs > Date.now();
}

/**
 * Mints (or reuses a still-fresh) installation access token.
 * The result must never be logged, persisted or returned to the browser.
 */
export async function getInstallationAccessToken(
  installationId: number,
): Promise<InstallationToken> {
  const cached = installationTokenCache.get(installationId);
  if (cached && isFresh(cached)) return cached;

  try {
    const auth = await getAppAuth()({ type: "installation", installationId });
    const token: InstallationToken = {
      token: auth.token,
      expiresAt: new Date(auth.expiresAt),
    };
    installationTokenCache.set(installationId, token);
    logger.info("minted github installation token", {
      installationId,
      expiresAt: token.expiresAt.toISOString(),
    });
    return token;
  } catch (error) {
    throw toApiError(error, installationId);
  }
}

export function invalidateInstallationToken(installationId: number): void {
  installationTokenCache.delete(installationId);
}

/** Octokit authenticated as a specific installation. */
export async function getInstallationOctokit(
  installationId: number,
): Promise<Octokit> {
  const { token } = await getInstallationAccessToken(installationId);
  return new Octokit({ auth: token });
}

/** Exchanges the OAuth `code` returned during installation for a user token. */
export async function getOctokitForOAuthCode(code: string): Promise<Octokit> {
  try {
    const auth = (await getAppAuth()({ type: "oauth-user", code })) as {
      token: string;
    };
    return new Octokit({ auth: auth.token });
  } catch (error) {
    throw toApiError(error);
  }
}

export async function fetchInstallation(
  installationId: number,
): Promise<NormalizedInstallation> {
  try {
    const { data } = await getAppOctokit().request(
      "GET /app/installations/{installation_id}",
      {
        installation_id: installationId,
      },
    );
    return normalizeInstallation(data);
  } catch (error) {
    throw toApiError(error, installationId);
  }
}

/** Lists every repository the installation can access, following pagination. */
export async function fetchInstallationRepositories(
  installationId: number,
): Promise<NormalizedRepository[]> {
  try {
    const octokit = await getInstallationOctokit(installationId);
    const repositories = await octokit.paginate(
      octokit.rest.apps.listReposAccessibleToInstallation,
      { per_page: 100 },
    );
    return repositories.map(normalizeRepository);
  } catch (error) {
    throw toApiError(error, installationId);
  }
}

/** Confirms the OAuth user who completed the flow really owns the installation. */
export async function userCanAccessInstallation(
  userOctokit: Octokit,
  installationId: number,
): Promise<boolean> {
  try {
    const installations = await userOctokit.paginate(
      userOctokit.rest.apps.listInstallationsForAuthenticatedUser,
      { per_page: 100 },
    );

    return installations.some(
      (installation) => installation.id === installationId,
    );
  } catch (error) {
    throw toApiError(error, installationId);
  }
}

type RawInstallation = {
  id: number;
  account?: unknown;
  repository_selection?: string;
  suspended_at?: string | null;
};

export function normalizeInstallation(
  raw: RawInstallation,
): NormalizedInstallation {
  const account = raw.account as
    | {
        id?: number;
        login?: string;
        slug?: string;
        type?: string;
        avatar_url?: string;
      }
    | null
    | undefined;

  const login = account?.login ?? account?.slug;
  if (!account || typeof account.id !== "number" || !login) {
    throw new ApiError(
      502,
      "GITHUB_INVALID_INSTALLATION",
      "GitHub returned an installation without an account",
    );
  }

  return {
    installationId: raw.id,
    accountId: account.id,
    accountLogin: login,
    accountType: account.type === "Organization" ? "Organization" : "User",
    accountAvatarUrl: account.avatar_url ?? null,
    githubRepositorySelection:
      raw.repository_selection === "all" ? "all" : "selected",
    suspended: Boolean(raw.suspended_at),
  };
}

type RawRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch?: string;
  clone_url?: string;
  html_url: string;
  owner: { id: number; login: string };
  permissions?: { admin?: boolean; push?: boolean; pull?: boolean };
};

export function normalizeRepository(raw: RawRepository): NormalizedRepository {
  return {
    githubRepositoryId: String(raw.id),
    name: raw.name,
    fullName: raw.full_name,
    ownerLogin: raw.owner.login,
    ownerId: raw.owner.id,
    private: raw.private,
    defaultBranch: raw.default_branch ?? "main",
    // Always store the credential-free URL; tokens are injected at clone time.
    cloneUrl: raw.clone_url ?? `${raw.html_url}.git`,
    htmlUrl: raw.html_url,
    permissions: {
      admin: Boolean(raw.permissions?.admin),
      push: Boolean(raw.permissions?.push),
      pull: raw.permissions?.pull ?? true,
    },
  };
}

/**
 * Converts an Octokit failure into a client-safe ApiError. GitHub response
 * bodies are not forwarded so tokens or internal details cannot leak.
 */
export function toApiError(error: unknown, installationId?: number): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof RequestError) {
    const rateLimitRemaining =
      error.response?.headers?.["x-ratelimit-remaining"];
    if (error.status === 403 && rateLimitRemaining === "0") {
      return new ApiError(
        429,
        "GITHUB_RATE_LIMITED",
        "GitHub API rate limit exceeded",
      );
    }
    if (error.status === 401) {
      if (installationId !== undefined)
        invalidateInstallationToken(installationId);
      return new ApiError(
        502,
        "GITHUB_TOKEN_EXPIRED",
        "GitHub rejected the installation credentials",
      );
    }
    if (error.status === 403) {
      return new ApiError(
        403,
        "GITHUB_INSUFFICIENT_PERMISSIONS",
        "The GitHub App installation lacks the required permissions",
      );
    }
    if (error.status === 404) {
      if (installationId !== undefined)
        invalidateInstallationToken(installationId);
      return new ApiError(
        404,
        "GITHUB_INSTALLATION_REMOVED",
        "The GitHub App installation is no longer available",
      );
    }
    return new ApiError(502, "GITHUB_API_ERROR", "GitHub API request failed");
  }

  logger.error("unexpected github failure", { error });
  return new ApiError(502, "GITHUB_API_ERROR", "GitHub API request failed");
}
