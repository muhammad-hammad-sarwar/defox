import type { Request } from "express";
import { ZodError, type ZodSchema } from "zod";

import { ApiError } from "../lib/api-error.js";

function formatIssues(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

/** Parses and validates a request body/query, converting Zod errors to ApiError. */
export function parseOrThrow<TSchema extends ZodSchema>(
  schema: TSchema,
  value: unknown,
): ReturnType<TSchema["parse"]> {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw ApiError.validation("Invalid request payload", formatIssues(error));
    }
    throw error;
  }
}

export function parseBody<TSchema extends ZodSchema>(
  schema: TSchema,
  req: Request,
): ReturnType<TSchema["parse"]> {
  return parseOrThrow(schema, req.body);
}

export function parseQuery<TSchema extends ZodSchema>(
  schema: TSchema,
  req: Request,
): ReturnType<TSchema["parse"]> {
  return parseOrThrow(schema, req.query);
}
