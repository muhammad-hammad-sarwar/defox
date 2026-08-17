import { Router } from "express";

import { asyncHandler } from "../../lib/http.js";
import { requireAuth, requireInternalService } from "../../middleware/auth.js";
import {
  authorizeRepository,
  disconnectGitHub,
  getGitHubConnection,
  getRepositories,
  handleCallback,
  issueCloneCredentials,
  patchRepositoryAccess,
  receiveWebhook,
  startInstallation,
  syncRepositories,
} from "./github.controller.js";

export const githubRouter: Router = Router();

// Signature-verified, unauthenticated: the raw body parser is installed in app.ts.
githubRouter.post("/webhooks", asyncHandler(receiveWebhook));

// GitHub redirects the browser here; the request is authorized by the
// single-use state issued when the flow started, not by a session cookie.
githubRouter.get("/callback", asyncHandler(handleCallback));

githubRouter.get("/", requireAuth, asyncHandler(getGitHubConnection));
githubRouter.delete("/", requireAuth, asyncHandler(disconnectGitHub));
githubRouter.get("/install", requireAuth, asyncHandler(startInstallation));

githubRouter.get("/repositories", requireAuth, asyncHandler(getRepositories));
githubRouter.post("/repositories/sync", requireAuth, asyncHandler(syncRepositories));
githubRouter.patch("/repositories/access", requireAuth, asyncHandler(patchRepositoryAccess));
githubRouter.post("/repositories/authorize", requireAuth, asyncHandler(authorizeRepository));

/**
 * Internal surface for the future agent/sandbox service. Guarded by a shared
 * service token and never exposed through the browser session.
 */
export const githubInternalRouter: Router = Router();

githubInternalRouter.post(
  "/repositories/:githubRepositoryId/clone-credentials",
  requireInternalService,
  asyncHandler(issueCloneCredentials),
);
