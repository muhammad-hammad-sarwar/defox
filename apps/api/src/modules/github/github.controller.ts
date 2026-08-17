import type { Request, Response } from "express";

import { getEnv } from "../../config/env.js";
import { ApiError } from "../../lib/api-error.js";
import { sendSuccess } from "../../lib/http.js";
import { logger } from "../../lib/logger.js";
import { getAuthenticatedUser } from "../../middleware/auth.js";
import { parseBody, parseOrThrow, parseQuery } from "../../middleware/validate.js";
import { DEFAULT_POST_INSTALL_REDIRECT_PATH } from "./github.constants.js";
import {
  consumeInstallationState,
  createInstallationUrl,
  disconnectInstallation,
  getConnection,
  handleInstallationCallback,
} from "./github.installation.service.js";
import {
  getRepositoryCloneCredentials,
  getRepositoryForSession,
  listRepositories,
  refreshRepositories,
  updateRepositoryAccess,
} from "./github.repository.service.js";
import {
  callbackQuerySchema,
  cloneCredentialsBodySchema,
  installQuerySchema,
  listRepositoriesQuerySchema,
  repositoryIdParamSchema,
  sessionRepositorySchema,
  updateRepositoryAccessSchema,
} from "./github.validation.js";
import { handleWebhook } from "./github.webhook.service.js";

/** GET /api/github */
export async function getGitHubConnection(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  sendSuccess(res, await getConnection(user.id as string));
}

/** GET /api/github/install */
export async function startInstallation(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const { redirect } = parseQuery(installQuerySchema, req);
  const url = await createInstallationUrl(
    user,
    redirect ?? DEFAULT_POST_INSTALL_REDIRECT_PATH,
  );
  res.redirect(url);
}

function buildWebRedirect(path: string, params: Record<string, string>): string {
  const env = getEnv();
  const url = new URL(path, env.WEB_APP_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/** GET /api/github/callback */
export async function handleCallback(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(callbackQuerySchema, req.query);
  let redirectPath = DEFAULT_POST_INSTALL_REDIRECT_PATH;

  try {
    if (!query.state) {
      throw new ApiError(
        400,
        "GITHUB_INVALID_STATE",
        "Missing installation state",
      );
    }

    const consumed = await consumeInstallationState(query.state);
    redirectPath = consumed.redirectPath;

    if (query.setup_action === "request") {
      // The user asked an organization owner to approve the installation.
      res.redirect(buildWebRedirect(redirectPath, { github: "pending" }));
      return;
    }

    if (!query.installation_id) {
      throw new ApiError(
        400,
        "GITHUB_INSTALLATION_CANCELLED",
        "GitHub installation was cancelled",
      );
    }

    await handleInstallationCallback({
      userId: consumed.userId,
      installationId: query.installation_id,
      ...(query.code ? { code: query.code } : {}),
    });

    res.redirect(buildWebRedirect(redirectPath, { github: "connected" }));
  } catch (error) {
    const code = error instanceof ApiError ? error.code : "GITHUB_API_ERROR";
    logger.warn("github callback failed", { code });
    // Only a stable error code travels back to the browser: never a token.
    res.redirect(buildWebRedirect(redirectPath, { github: "error", reason: code }));
  }
}

/** GET /api/github/repositories */
export async function getRepositories(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const query = parseQuery(listRepositoriesQuerySchema, req);

  if (query.refresh) {
    await refreshRepositories(user.id as string);
  }

  const result = await listRepositories(user.id as string, {
    page: query.page,
    perPage: query.perPage,
    ...(query.search ? { search: query.search } : {}),
    ...(query.selectedOnly === undefined ? {} : { selectedOnly: query.selectedOnly }),
  });
  sendSuccess(res, result);
}

/** POST /api/github/repositories/sync */
export async function syncRepositories(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const count = await refreshRepositories(user.id as string);
  sendSuccess(res, { synced: count });
}

/** PATCH /api/github/repositories/access */
export async function patchRepositoryAccess(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const input = parseBody(updateRepositoryAccessSchema, req);
  sendSuccess(res, await updateRepositoryAccess(user.id as string, input));
}

/**
 * POST /api/github/repositories/authorize
 * Pre-flight used by the UI before a future coding session is created.
 */
export async function authorizeRepository(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const { repositoryId } = parseBody(sessionRepositorySchema, req);
  sendSuccess(res, await getRepositoryForSession(user.id as string, repositoryId));
}

/**
 * POST /api/internal/github/repositories/:githubRepositoryId/clone-credentials
 * Internal endpoint for the future sandbox/agent service. Never called by a browser.
 */
export async function issueCloneCredentials(req: Request, res: Response): Promise<void> {
  const { githubRepositoryId } = parseOrThrow(repositoryIdParamSchema, req.params);
  // The internal caller states which application user the sandbox runs for.
  const { userId } = parseBody(cloneCredentialsBodySchema, req);

  sendSuccess(res, await getRepositoryCloneCredentials(userId, githubRepositoryId));
}

/** DELETE /api/github */
export async function disconnectGitHub(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  await disconnectInstallation(user.id as string);
  sendSuccess(res, { disconnected: true });
}

/** POST /api/github/webhooks */
export async function receiveWebhook(req: Request, res: Response): Promise<void> {
  const event = req.header("x-github-event");
  const deliveryId = req.header("x-github-delivery");
  if (!event || !deliveryId) {
    throw ApiError.badRequest("Missing GitHub webhook headers");
  }

  const rawBody = req.body as Buffer;
  const result = await handleWebhook({
    event,
    deliveryId,
    signature: req.header("x-hub-signature-256"),
    rawBody: Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody)),
  });

  sendSuccess(res, result, 202);
}
