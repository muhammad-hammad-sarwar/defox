import type { ApiErrorCode, ApiResponse } from "@defox/shared";
import type { NextFunction, Request, RequestHandler, Response } from "express";

export function sendSuccess<TData>(res: Response, data: TData, status = 200): void {
  const body: ApiResponse<TData> = { ok: true, data };
  res.status(status).json(body);
}

export function sendError(
  res: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): void {
  const body: ApiResponse<never> = {
    ok: false,
    error: { code, message, ...(details === undefined ? {} : { details }) },
  };
  res.status(status).json(body);
}

/** Forwards rejected promises from async handlers to the error middleware. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
