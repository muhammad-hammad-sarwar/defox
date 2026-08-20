import type { ApiErrorCode } from "@defox/shared";

import { redactString } from "./logger.js";

/**
 * Application-level error carrying a stable, client-safe error code.
 * Messages are redacted so GitHub credentials can never surface in a response.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(redactString(message));
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = "Bad request", details?: unknown): ApiError {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }

  static validation(
    message = "Invalid request payload",
    details?: unknown,
  ): ApiError {
    return new ApiError(422, "VALIDATION_ERROR", message, details);
  }

  static unauthorized(message = "Authentication required"): ApiError {
    return new ApiError(401, "UNAUTHORIZED", message);
  }

  static forbidden(message = "Not allowed"): ApiError {
    return new ApiError(403, "FORBIDDEN", message);
  }

  static notFound(message = "Resource not found"): ApiError {
    return new ApiError(404, "NOT_FOUND", message);
  }

  static conflict(message = "Conflict"): ApiError {
    return new ApiError(409, "CONFLICT", message);
  }

  static internal(message = "Something went wrong"): ApiError {
    return new ApiError(500, "INTERNAL_ERROR", message);
  }
}
