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
  "ROOT_RUN_NOT_FOUND",
  "ROOT_RUN_NOT_ACTIVE",
  "ROOT_RUN_REPOSITORY_COUNT_INVALID",
  "ILLEGAL_STATE_TRANSITION",
  "STALE_GENERATION",
  "STALE_REVISION",
  "IDEMPOTENCY_CONFLICT",
  "IDEMPOTENCY_KEY_REQUIRED",
  "EVENT_CURSOR_EXPIRED",
  "EVENT_VERSION_UNSUPPORTED",
  "EVENT_PAYLOAD_INVALID",
  "TRACK_NOT_FOUND",
  "TRACK_OWNERSHIP_VIOLATION",
  "TRACK_DEPENDENCY_UNSATISFIED",
  "AGENT_OUTPUT_INVALID",
  "FILE_REVISION_CONFLICT",
  "COMMAND_UNAVAILABLE",
  "PREVIEW_UNAVAILABLE",
  "ARTIFACT_NOT_FOUND",
  "APPROVAL_NOT_FOUND",
  "APPROVAL_STALE",
  "APPROVAL_EXPIRED",
  "APPROVAL_ALREADY_DECIDED",
  "APPROVAL_INVALIDATED",
  "GITHUB_ACTION_CONFLICT",
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
