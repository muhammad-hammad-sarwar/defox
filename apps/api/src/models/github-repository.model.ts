import {
  Schema,
  Types,
  model,
  type HydratedDocument,
  type Model,
} from "mongoose";

export interface GitHubRepositoryPermissionsAttributes {
  admin: boolean;
  push: boolean;
  pull: boolean;
}

export interface GitHubRepositoryAttributes {
  userId: Types.ObjectId;
  installationId: number;
  /** GitHub numeric repository id, stored as a string to stay JSON-safe. */
  githubRepositoryId: string;
  name: string;
  fullName: string;
  ownerLogin: string;
  ownerId: number;
  private: boolean;
  defaultBranch: string;
  /** Credential-free HTTPS clone URL. Tokens are never persisted here. */
  cloneUrl: string;
  htmlUrl: string;
  permissions: GitHubRepositoryPermissionsAttributes;
  /** Whether the user selected this repository for the application. */
  selected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type GitHubRepositoryDocument =
  HydratedDocument<GitHubRepositoryAttributes>;

const permissionsSchema = new Schema<GitHubRepositoryPermissionsAttributes>(
  {
    admin: { type: Boolean, required: true, default: false },
    push: { type: Boolean, required: true, default: false },
    pull: { type: Boolean, required: true, default: true },
  },
  { _id: false },
);

const githubRepositorySchema = new Schema<GitHubRepositoryAttributes>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    installationId: { type: Number, required: true },
    githubRepositoryId: { type: String, required: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    ownerLogin: { type: String, required: true },
    ownerId: { type: Number, required: true },
    private: { type: Boolean, required: true, default: false },
    defaultBranch: { type: String, required: true, default: "main" },
    cloneUrl: { type: String, required: true },
    htmlUrl: { type: String, required: true },
    permissions: { type: permissionsSchema, required: true },
    selected: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

// A repository is unique within the context of an installation.
githubRepositorySchema.index(
  { installationId: 1, githubRepositoryId: 1 },
  { unique: true },
);
githubRepositorySchema.index({ userId: 1, githubRepositoryId: 1 });
githubRepositorySchema.index({ userId: 1, installationId: 1, fullName: 1 });

export const GitHubRepositoryModel: Model<GitHubRepositoryAttributes> =
  model<GitHubRepositoryAttributes>("GitHubRepository", githubRepositorySchema);
