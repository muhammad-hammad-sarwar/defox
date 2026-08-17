/**
 * Boundary types for the future sandbox/agent service.
 *
 * Nothing in this file is implemented yet: it exists so the GitHub module can
 * expose a stable contract that the future (Python) agent service and E2B
 * sandbox layer will consume. Clone credentials are short lived and must never
 * be sent to a browser or persisted.
 */

export interface RepositoryCloneCredentials {
  /** Repository identity (safe to log). */
  repository: {
    githubRepositoryId: string;
    fullName: string;
    defaultBranch: string;
    /** Credential-free HTTPS clone URL. */
    cloneUrl: string;
  };
  /** Short-lived GitHub installation access token. Never log or persist. */
  token: string;
  /** Username to pair with the token in a git credential helper. */
  tokenUsername: "x-access-token";
  /** ISO-8601 expiry of the installation token (GitHub issues 1 hour tokens). */
  expiresAt: string;
}

/** Result of the backend authorization check for a future coding session. */
export interface SessionRepositoryAuthorization {
  authorized: true;
  repository: {
    githubRepositoryId: string;
    fullName: string;
    defaultBranch: string;
    private: boolean;
  };
  installationId: number;
}
