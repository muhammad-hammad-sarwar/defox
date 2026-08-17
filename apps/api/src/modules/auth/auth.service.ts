import type { AuthUserDto } from "@defox/shared";
import bcrypt from "bcryptjs";
import type { CookieOptions, Response } from "express";
import jwt from "jsonwebtoken";

import { getEnv } from "../../config/env.js";
import { ApiError } from "../../lib/api-error.js";
import { UserModel, type UserDocument } from "../../models/user.model.js";

export interface SessionPayload {
  sub: string;
  email: string;
}

function cookieOptions(): CookieOptions {
  const env = getEnv();
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
  };
}

export function toAuthUserDto(user: UserDocument): AuthUserDto {
  return {
    id: user.id as string,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}

export function issueSessionCookie(res: Response, user: UserDocument): void {
  const env = getEnv();
  const payload: SessionPayload = { sub: user.id as string, email: user.email };
  const token = jwt.sign(payload, env.SESSION_SECRET, {
    expiresIn: `${env.SESSION_TTL_HOURS}h`,
  });
  res.cookie(env.SESSION_COOKIE_NAME, token, cookieOptions());
}

export function clearSessionCookie(res: Response): void {
  const env = getEnv();
  res.clearCookie(env.SESSION_COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
}

export function verifySessionToken(token: string): SessionPayload {
  const env = getEnv();
  try {
    const decoded = jwt.verify(token, env.SESSION_SECRET);
    if (typeof decoded === "string" || typeof decoded.sub !== "string") {
      throw new Error("malformed session payload");
    }
    return { sub: decoded.sub, email: String(decoded.email ?? "") };
  } catch {
    throw ApiError.unauthorized("Session is invalid or has expired");
  }
}

export async function registerUser(input: {
  email: string;
  name: string;
  password: string;
}): Promise<UserDocument> {
  const email = input.email.toLowerCase();
  const existing = await UserModel.findOne({ email });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  return UserModel.create({ email, name: input.name, passwordHash });
}

export async function authenticateUser(input: {
  email: string;
  password: string;
}): Promise<UserDocument> {
  const user = await UserModel.findOne({ email: input.email.toLowerCase() }).select(
    "+passwordHash",
  );
  if (!user) throw ApiError.unauthorized("Invalid email or password");

  const matches = await bcrypt.compare(input.password, user.passwordHash);
  if (!matches) throw ApiError.unauthorized("Invalid email or password");

  return user;
}

export async function findUserById(userId: string): Promise<UserDocument> {
  const user = await UserModel.findById(userId);
  if (!user) throw ApiError.unauthorized("Session user no longer exists");
  return user;
}
