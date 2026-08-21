import type { Request, Response } from "express";

import { sendSuccess } from "../../lib/http.js";
import { getAuthenticatedUser } from "../../middleware/auth.js";
import { parseBody, parseOrThrow } from "../../middleware/validate.js";
import {
  createSessionSchema,
  sessionIdParamSchema,
} from "./session.validation.js";
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
} from "./session.service.js";

export async function postSession(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  sendSuccess(
    res,
    await createSession(user.id as string, parseBody(createSessionSchema, req)),
    201,
  );
}

export async function getSessions(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  sendSuccess(res, await listSessions(user.id as string));
}

export async function getOneSession(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getAuthenticatedUser(req);
  const { sessionId } = parseOrThrow(sessionIdParamSchema, req.params);
  sendSuccess(res, await getSession(user.id as string, sessionId));
}

export async function removeSession(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getAuthenticatedUser(req);
  const { sessionId } = parseOrThrow(sessionIdParamSchema, req.params);
  await deleteSession(user.id as string, sessionId);
  sendSuccess(res, { stopped: true });
}
