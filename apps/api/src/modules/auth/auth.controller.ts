import type { Request, Response } from "express";

import { getAuthenticatedUser } from "../../middleware/auth.js";
import { parseBody } from "../../middleware/validate.js";
import { sendSuccess } from "../../lib/http.js";
import {
  authenticateUser,
  clearSessionCookie,
  issueSessionCookie,
  registerUser,
  toAuthUserDto,
} from "./auth.service.js";
import { loginSchema, signupSchema } from "./auth.validation.js";

export async function signup(req: Request, res: Response): Promise<void> {
  const input = parseBody(signupSchema, req);
  const user = await registerUser(input);
  issueSessionCookie(res, user);
  sendSuccess(res, { user: toAuthUserDto(user) }, 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = parseBody(loginSchema, req);
  const user = await authenticateUser(input);
  issueSessionCookie(res, user);
  sendSuccess(res, { user: toAuthUserDto(user) });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  clearSessionCookie(res);
  sendSuccess(res, { loggedOut: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  sendSuccess(res, { user: toAuthUserDto(user) });
}
