/**
 * GitHub DTOs exposed to the frontend. These intentionally contain no GitHub
 * credentials: no installation tokens, no client secrets, no private keys.
 */

export type RepositorySelection = "all" | "selected";

export interface GitHubAccountDto {
  id: number;
  login: string;
  type: "User" | "Organization";
  avatarUrl: string | null;
}

export interface GitHubInstallationDto {
  installationId: number;
  account: GitHubAccountDto;
  /** What GitHub itself granted the installation. */
  githubRepositorySelection: RepositorySelection;
  /** What the user chose to expose to this application. */
  repositorySelection: RepositorySelection;
  connectedAt: string;
  updatedAt: string;
  /** GitHub page where the user edits which repositories the App can access. */
  manageUrl: string;
}

export interface GitHubConnectionDto {
  connected: boolean;
  installation: GitHubInstallationDto | null;
  account: GitHubAccountDto | null;
  repositorySelection: RepositorySelection | null;
  appSlug: string;
}

export interface GitHubRepositoryDto {
  id: string;
  githubRepositoryId: string;
  name: string;
  fullName: string;
  ownerLogin: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  cloneUrl: string;
  permissions: GitHubRepositoryPermissions;
  /** True when the repository is enabled for this application. */
  selected: boolean;
  updatedAt: string;
}

export interface GitHubRepositoryPermissions {
  admin: boolean;
  push: boolean;
  pull: boolean;
}

export interface UpdateRepositoryAccessAllRequest {
  mode: "all";
}

export interface UpdateRepositoryAccessSelectedRequest {
  mode: "selected";
  /** Full replacement of the selection. Omit to keep the current choices. */
  repositoryIds?: string[];
  /**
   * Incremental changes, so a paginated picker never has to submit (and thus
   * never accidentally clears) repositories it did not load.
   * Cannot be combined with `repositoryIds`.
   */
  select?: string[];
  deselect?: string[];
}

export type UpdateRepositoryAccessRequest =
  | UpdateRepositoryAccessAllRequest
  | UpdateRepositoryAccessSelectedRequest;

export interface UpdateRepositoryAccessResponse {
  repositorySelection: RepositorySelection;
  selectedRepositoryIds: string[];
}
