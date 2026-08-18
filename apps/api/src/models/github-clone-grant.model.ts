import {
  Schema,
  Types,
  model,
  models,
  type HydratedDocument,
  type Model,
} from "mongoose";

/**
 * Single-use capability issued when an authenticated user authorizes a
 * repository for a future session. The sandbox service redeems it (together
 * with the internal service token) instead of naming an application user, so a
 * leaked service token alone cannot mint credentials for other tenants.
 */
export interface GitHubCloneGrantAttributes {
  userId: Types.ObjectId;
  githubRepositoryId: string;
  installationId: number;
  tokenHash: string;
  consumedAt?: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type GitHubCloneGrantDocument = HydratedDocument<GitHubCloneGrantAttributes>;

const githubCloneGrantSchema = new Schema<GitHubCloneGrantAttributes>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    githubRepositoryId: { type: String, required: true },
    installationId: { type: Number, required: true },
    tokenHash: { type: String, required: true, unique: true },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

githubCloneGrantSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GitHubCloneGrantModel: Model<GitHubCloneGrantAttributes> =
  (models.GitHubCloneGrant as Model<GitHubCloneGrantAttributes> | undefined) ??
  model<GitHubCloneGrantAttributes>("GitHubCloneGrant", githubCloneGrantSchema);
