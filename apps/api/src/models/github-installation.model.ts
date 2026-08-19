import type { RepositorySelection } from "@defox/shared";
import {
  Schema,
  Types,
  model,
  type HydratedDocument,
  type Model,
} from "mongoose";

export type InstallationStatus = "active" | "suspended" | "removed";

export interface GitHubInstallationAttributes {
  userId: Types.ObjectId;
  installationId: number;
  githubAccountId: number;
  githubAccountLogin: string;
  githubAccountType: "User" | "Organization";
  githubAccountAvatarUrl?: string | null;
  /** What GitHub granted the installation ("all" or "selected"). */
  githubRepositorySelection: RepositorySelection;
  /** What the application user allows this application to use. */
  repositorySelection: RepositorySelection;
  status: InstallationStatus;
  repositoriesSyncedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type GitHubInstallationDocument =
  HydratedDocument<GitHubInstallationAttributes>;

const githubInstallationSchema = new Schema<GitHubInstallationAttributes>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    installationId: { type: Number, required: true, unique: true },
    githubAccountId: { type: Number, required: true, index: true },
    githubAccountLogin: { type: String, required: true },
    githubAccountType: {
      type: String,
      enum: ["User", "Organization"],
      required: true,
    },
    githubAccountAvatarUrl: { type: String, default: null },
    githubRepositorySelection: {
      type: String,
      enum: ["all", "selected"],
      required: true,
      default: "selected",
    },
    repositorySelection: {
      type: String,
      enum: ["all", "selected"],
      required: true,
      default: "all",
    },
    status: {
      type: String,
      enum: ["active", "suspended", "removed"],
      required: true,
      default: "active",
    },
    repositoriesSyncedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

githubInstallationSchema.index({ userId: 1, status: 1 });

export const GitHubInstallationModel: Model<GitHubInstallationAttributes> =
  model<GitHubInstallationAttributes>(
    "GitHubInstallation",
    githubInstallationSchema,
  );
