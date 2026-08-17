import { timingSafeEqual } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { getEnv } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { findUserById, verifySessionToken } from "../modules/auth/auth.service.js";
import type { UserDocument } from "../models/user.model.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: UserDocument;
  }
}

/** Resolves the authenticated application user from the HTTP-only session cookie. */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const env = getEnv();
    const raw = req.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined;
    if (!raw) throw ApiError.unauthorized();

    const payload = verifySessionToken(raw);
    req.user = await findUserById(payload.sub);
    next();
  } catch (error) {
    next(error);
  }
}

function timingSafeEqualString(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function getAuthenticatedUser(req: Request): UserDocument {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}

/**
 * Guards endpoints that only the future agent/sandbox service may call.
 * These endpoints return short-lived GitHub credentials and are never
 * reachable from a browser session.
 */
export function requireInternalService(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const env = getEnv();
  const expected = env.INTERNAL_SERVICE_TOKEN;
  if (!expected) {
    next(ApiError.forbidden("Internal service access is not configured"));
    return;
  }

  const provided = req.header("x-internal-service-token");
  if (!provided || !timingSafeEqualString(provided, expected)) {
    next(ApiError.unauthorized("Invalid internal service token"));
    return;
  }

  next();
}
