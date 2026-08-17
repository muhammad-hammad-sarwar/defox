import type { RepositorySelection } from "@defox/shared";

/** Subset of the GitHub installation payload the application persists. */
export interface NormalizedInstallation {
  installationId: number;
  accountId: number;
  accountLogin: string;
  accountType: "User" | "Organization";
  accountAvatarUrl: string | null;
  githubRepositorySelection: RepositorySelection;
  suspended: boolean;
}

/** Subset of the GitHub repository payload the application persists. */
export interface NormalizedRepository {
  githubRepositoryId: string;
  name: string;
  fullName: string;
  ownerLogin: string;
  ownerId: number;
  private: boolean;
  defaultBranch: string;
  cloneUrl: string;
  htmlUrl: string;
  permissions: { admin: boolean; push: boolean; pull: boolean };
}

/** Short-lived installation token. Never persisted, never sent to a browser. */
export interface InstallationToken {
  token: string;
  expiresAt: Date;
}

export interface ListRepositoriesOptions {
  page: number;
  perPage: number;
  search?: string;
  selectedOnly?: boolean;
}
