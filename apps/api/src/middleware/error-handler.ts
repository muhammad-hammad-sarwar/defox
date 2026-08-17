import type { ErrorRequestHandler, RequestHandler } from "express";

import { ApiError } from "../lib/api-error.js";
import { sendError } from "../lib/http.js";
import { logger, redactString } from "../lib/logger.js";

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, "NOT_FOUND", `No route for ${req.method} ${req.path}`);
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      logger.error("request failed", { path: req.path, code: error.code, error });
    } else {
      logger.warn("request rejected", { path: req.path, code: error.code });
    }
    sendError(res, error.status, error.code, error.message, error.details);
    return;
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  logger.error("unhandled error", { path: req.path, message: redactString(message) });
  sendError(res, 500, "INTERNAL_ERROR", "Something went wrong");
};
