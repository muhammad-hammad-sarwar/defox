import { Schema, model, models, type HydratedDocument, type Model } from "mongoose";

/**
 * Safe metadata about received webhook deliveries. Payload bodies are not
 * stored: only the few fields needed to later route events to internal
 * handlers (push, pull_request, installation, ...).
 */
export interface GitHubWebhookEventAttributes {
  deliveryId: string;
  event: string;
  action?: string | null;
  installationId?: number | null;
  repositoryFullName?: string | null;
  handled: boolean;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type GitHubWebhookEventDocument = HydratedDocument<GitHubWebhookEventAttributes>;

const githubWebhookEventSchema = new Schema<GitHubWebhookEventAttributes>(
  {
    deliveryId: { type: String, required: true, unique: true },
    event: { type: String, required: true, index: true },
    action: { type: String, default: null },
    installationId: { type: Number, default: null, index: true },
    repositoryFullName: { type: String, default: null },
    handled: { type: Boolean, required: true, default: false },
    receivedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true },
);

export const GitHubWebhookEventModel: Model<GitHubWebhookEventAttributes> =
  (models.GitHubWebhookEvent as Model<GitHubWebhookEventAttributes> | undefined) ??
  model<GitHubWebhookEventAttributes>("GitHubWebhookEvent", githubWebhookEventSchema);
