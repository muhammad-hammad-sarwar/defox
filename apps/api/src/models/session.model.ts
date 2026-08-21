import {
  Schema,
  Types,
  model,
  type HydratedDocument,
  type Model,
} from "mongoose";

import type { SandboxStatus } from "../modules/sandbox/sandbox.types.js";
import type { SessionStatus } from "../modules/sessions/session.types.js";

export interface SessionRepositoryAttributes {
  githubRepositoryId: string;
  fullName: string;
  ownerLogin: string;
  name: string;
  defaultBranch: string;
}

export interface SessionAttributes {
  userId: Types.ObjectId;
  title: string;
  repositories: SessionRepositoryAttributes[];
  sandbox: { sandboxId: string | null; status: SandboxStatus };
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type SessionDocument = HydratedDocument<SessionAttributes>;

const repositorySchema = new Schema<SessionRepositoryAttributes>(
  {
    githubRepositoryId: { type: String, required: true },
    fullName: { type: String, required: true },
    ownerLogin: { type: String, required: true },
    name: { type: String, required: true },
    defaultBranch: { type: String, required: true },
  },
  { _id: false },
);

const sessionSchema = new Schema<SessionAttributes>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    repositories: { type: [repositorySchema], required: true },
    sandbox: {
      sandboxId: { type: String, default: null },
      status: {
        type: String,
        enum: ["creating", "ready", "failed", "stopped"],
        required: true,
        default: "creating",
      },
    },
    status: {
      type: String,
      enum: ["creating", "ready", "failed", "stopped"],
      required: true,
      default: "creating",
    },
  },
  { timestamps: true },
);

sessionSchema.index({ userId: 1, createdAt: -1 });
sessionSchema.index({ createdAt: -1 });

export const SessionModel: Model<SessionAttributes> = model<SessionAttributes>(
  "Session",
  sessionSchema,
);
