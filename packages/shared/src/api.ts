/**
 * Transport-level contract shared by the Express API and the Next.js web app.
 * Every API response is one of these two shapes.
 */

export interface ApiSuccess<TData> {
  ok: true;
  data: TData;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

export const API_ERROR_CODES = [
  "BAD_REQUEST",
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INTERNAL_ERROR",
  "GITHUB_NOT_CONNECTED",
  "GITHUB_INSTALLATION_CANCELLED",
  "GITHUB_INVALID_STATE",
  "GITHUB_INVALID_INSTALLATION",
  "GITHUB_INSTALLATION_REMOVED",
  "GITHUB_REPOSITORY_UNAVAILABLE",
  "GITHUB_REPOSITORY_NOT_SELECTED",
  "GITHUB_INSUFFICIENT_PERMISSIONS",
  "GITHUB_RATE_LIMITED",
  "GITHUB_API_ERROR",
  "GITHUB_TOKEN_EXPIRED",
  "GITHUB_UNAUTHORIZED_REPOSITORY",
  "SESSION_CREATION_FAILED",
  "SESSION_NOT_FOUND",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface Paginated<TItem> {
  items: TItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}
