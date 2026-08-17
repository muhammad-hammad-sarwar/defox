/**
 * GitHub App permissions required for cloud-coding-agent V1.
 *
 * These are configured on the GitHub App itself; the list is kept here as the
 * single source of truth used by documentation and setup checks. Anything not
 * listed is intentionally not requested.
 */
export const REQUIRED_APP_PERMISSIONS = {
  /** Repository name, default branch, visibility. */
  metadata: "read",
  /** Read files, push commits, create branches. */
  contents: "write",
  /** Open pull requests from agent branches. */
  pull_requests: "write",
} as const;

/**
 * Permissions deliberately deferred to later milestones. Adding a key here to
 * REQUIRED_APP_PERMISSIONS is the only change needed on the application side.
 */
export const FUTURE_APP_PERMISSIONS = {
  issues: "write",
  checks: "read",
  actions: "read",
  workflows: "write",
} as const;

/** Webhook events the platform will eventually route to internal handlers. */
export const SUPPORTED_WEBHOOK_EVENTS = [
  "push",
  "pull_request",
  "installation",
  "installation_repositories",
  "repository",
] as const;

export type SupportedWebhookEvent = (typeof SUPPORTED_WEBHOOK_EVENTS)[number];

export const GITHUB_BASE_URL = "https://github.com";

/** GitHub issues installation tokens valid for one hour. */
export const INSTALLATION_TOKEN_TTL_SECONDS = 3600;

/** Refresh cached installation tokens this many seconds before they expire. */
export const INSTALLATION_TOKEN_REFRESH_MARGIN_SECONDS = 120;

export const OAUTH_STATE_TTL_MINUTES = 10;

export const DEFAULT_POST_INSTALL_REDIRECT_PATH = "/settings/github";
