import { z } from "zod";

const repositoryIdsSchema = z
  .array(z.string().regex(/^\d+$/, "repository ids are numeric GitHub ids"))
  .min(1)
  .max(100)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "repositoryIds cannot contain duplicates",
  );

export const createSessionSchema = z.object({
  repositoryIds: repositoryIdsSchema,
  title: z.string().trim().min(1).max(120).optional(),
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().regex(/^[a-f\d]{24}$/i, "sessionId is malformed"),
});
