import { z } from "zod";

/** Only relative, single-slash paths may be used as post-install redirects. */
const redirectPathSchema = z
  .string()
  .regex(/^\/(?!\/)[A-Za-z0-9\-._~/]*$/, "redirect must be a relative path");

export const installQuerySchema = z.object({
  redirect: redirectPathSchema.optional(),
});

export const callbackQuerySchema = z.object({
  installation_id: z.coerce.number().int().positive().optional(),
  setup_action: z.enum(["install", "update", "request"]).optional(),
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
});

export const listRepositoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().trim().min(1).max(200).optional(),
  selectedOnly: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .optional(),
  refresh: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .optional(),
});

const githubRepositoryIdSchema = z
  .string()
  .regex(/^\d+$/, "repository ids are numeric GitHub ids");

const repositoryIdListSchema = z.array(githubRepositoryIdSchema).max(1000);

export const updateRepositoryAccessSchema = z
  .discriminatedUnion("mode", [
    z.object({ mode: z.literal("all") }),
    z.object({
      mode: z.literal("selected"),
      /** Full replacement of the selection. */
      repositoryIds: repositoryIdListSchema.optional(),
      /** Incremental changes; cannot be combined with repositoryIds. */
      select: repositoryIdListSchema.optional(),
      deselect: repositoryIdListSchema.optional(),
    }),
  ])
  .refine(
    (input) =>
      input.mode === "all" || !(input.repositoryIds && (input.select || input.deselect)),
    "repositoryIds cannot be combined with select/deselect",
  )
  .refine(
    (input) =>
      input.mode === "all" || !input.select?.some((id) => input.deselect?.includes(id)),
    "a repository cannot be both selected and deselected",
  );

export const repositoryIdParamSchema = z.object({
  githubRepositoryId: githubRepositoryIdSchema,
});

export const sessionRepositorySchema = z.object({
  repositoryId: githubRepositoryIdSchema,
});

/**
 * Body of the internal clone-credentials endpoint (agent/sandbox service).
 * The acting user is derived from the grant, never named by the caller.
 */
export const cloneCredentialsBodySchema = z.object({
  grantToken: z.string().regex(/^[a-f0-9]{64}$/, "grantToken is malformed"),
});

export type ListRepositoriesQuery = z.infer<typeof listRepositoriesQuerySchema>;
export type CallbackQuery = z.infer<typeof callbackQuerySchema>;
