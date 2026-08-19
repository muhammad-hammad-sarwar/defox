import {
  Schema,
  Types,
  model,
  type HydratedDocument,
  type Model,
} from "mongoose";

/**
 * Single-use state issued when a user starts the GitHub App installation flow.
 * The callback is only trusted when it presents a state we issued ourselves,
 * which is how the installation is bound to the authenticated application user.
 */
export interface GitHubOAuthStateAttributes {
  userId: Types.ObjectId;
  state: string;
  redirectPath: string;
  consumedAt?: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type GitHubOAuthStateDocument =
  HydratedDocument<GitHubOAuthStateAttributes>;

const githubOAuthStateSchema = new Schema<GitHubOAuthStateAttributes>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    state: { type: String, required: true, unique: true },
    redirectPath: { type: String, required: true, default: "/settings/github" },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

githubOAuthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GitHubOAuthStateModel: Model<GitHubOAuthStateAttributes> =
  model<GitHubOAuthStateAttributes>("GitHubOAuthState", githubOAuthStateSchema);
