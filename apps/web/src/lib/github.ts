import type {
  GitHubConnectionDto,
  GitHubRepositoryDto,
  Paginated,
  RepositorySelection,
  SessionRepositoryAuthorization,
  UpdateRepositoryAccessRequest,
  UpdateRepositoryAccessResponse,
} from "@defox/shared";

import { apiFetch } from "./api-client";
import axios from "axios";

export async function getConnection(): Promise<GitHubConnectionDto> {
  const response = await axios.get("http://localhost:4000/api/github", {
    withCredentials: true,
  });

  return response.data?.data;
}

export async function listRepositories(params: {
  page?: number;
  perPage?: number;
  search?: string;
  selectedOnly?: boolean;
  refresh?: boolean;
}): Promise<Paginated<GitHubRepositoryDto>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  if (params.search) query.set("search", params.search);
  if (params.selectedOnly !== undefined)
    query.set("selectedOnly", String(params.selectedOnly));
  if (params.refresh) query.set("refresh", "true");

  const response = await axios.get(
    `http://localhost:4000/api/github/repositories?${query}`,
    {
      withCredentials: true,
    },
  );

  return response.data?.data;
}

export async function updateRepositoryAccess(
  input: UpdateRepositoryAccessRequest,
): Promise<UpdateRepositoryAccessResponse> {
  const response = await axios.patch(
    "http://localhost:4000/api/github/repositories/access",
    input,
    { withCredentials: true },
  );

  return response.data?.data;
}

export function disconnectGitHub(): Promise<{ disconnected: boolean }> {
  return axios.delete("http://localhost:4000/api/github", {
    withCredentials: true,
  });
}

export function authorizeRepository(
  repositoryId: string,
): Promise<SessionRepositoryAuthorization> {
  return apiFetch<SessionRepositoryAuthorization>(
    "http://localhost:4000/api/github/repositories/authorize",
    {
      method: "POST",
      body: JSON.stringify({ repositoryId }),
    },
  );
}

export function selectionLabel(selection: RepositorySelection): string {
  return selection === "all"
    ? "All repositories"
    : "Only selected repositories";
}

/** Human readable copy for the backend's stable error codes. */
export const ERROR_MESSAGES: Record<string, string> = {
  GITHUB_NOT_CONNECTED: "GitHub is not connected yet.",
  GITHUB_INSTALLATION_CANCELLED: "The GitHub installation was cancelled.",
  GITHUB_INVALID_STATE: "That GitHub link expired. Please start again.",
  GITHUB_INVALID_INSTALLATION: "That GitHub installation could not be used.",
  GITHUB_INSTALLATION_REMOVED:
    "The GitHub App installation was removed or suspended.",
  GITHUB_REPOSITORY_UNAVAILABLE:
    "That repository is not available through your installation.",
  GITHUB_REPOSITORY_NOT_SELECTED:
    "That repository is not enabled for this application.",
  GITHUB_INSUFFICIENT_PERMISSIONS:
    "The GitHub App lacks the required permissions.",
  GITHUB_RATE_LIMITED: "GitHub rate limit reached. Try again shortly.",
  GITHUB_API_ERROR: "GitHub could not be reached. Try again.",
  GITHUB_TOKEN_EXPIRED: "GitHub credentials expired. Reconnect GitHub.",
  GITHUB_UNAUTHORIZED_REPOSITORY:
    "One or more repositories are not yours to select.",
};

export function messageForCode(code: string, fallback: string): string {
  return ERROR_MESSAGES[code] ?? fallback;
}
