import { verify } from "@octokit/webhooks-methods";

import { getEnv } from "../../config/env.js";
import { ApiError } from "../../lib/api-error.js";
import { logger } from "../../lib/logger.js";
import { GitHubWebhookEventModel } from "../../models/github-webhook-event.model.js";
import { SUPPORTED_WEBHOOK_EVENTS, type SupportedWebhookEvent } from "./github.constants.js";
import { markInstallationStatus } from "./github.installation.service.js";

export interface WebhookDelivery {
  event: string;
  deliveryId: string;
  signature: string | undefined;
  rawBody: Buffer;
}

export interface WebhookResult {
  event: string;
  action: string | null;
  handled: boolean;
}

interface WebhookPayload {
  action?: string;
  installation?: { id?: number };
  repository?: { full_name?: string };
}

function isSupported(event: string): event is SupportedWebhookEvent {
  return (SUPPORTED_WEBHOOK_EVENTS as readonly string[]).includes(event);
}

export async function handleWebhook(delivery: WebhookDelivery): Promise<WebhookResult> {
  const env = getEnv();
  if (!delivery.signature) {
    throw ApiError.unauthorized("Missing webhook signature");
  }

  const valid = await verify(
    env.GITHUB_WEBHOOK_SECRET,
    delivery.rawBody.toString("utf8"),
    delivery.signature,
  );
  if (!valid) {
    throw ApiError.unauthorized("Invalid webhook signature");
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(delivery.rawBody.toString("utf8")) as WebhookPayload;
  } catch {
    throw ApiError.badRequest("Webhook payload is not valid JSON");
  }

  const action = payload.action ?? null;
  const installationId = payload.installation?.id ?? null;
  const handled = isSupported(delivery.event);

  // Only safe metadata is stored; payload bodies are intentionally discarded.
  await GitHubWebhookEventModel.updateOne(
    { deliveryId: delivery.deliveryId },
    {
      $set: {
        event: delivery.event,
        action,
        installationId,
        repositoryFullName: payload.repository?.full_name ?? null,
        handled,
        receivedAt: new Date(),
      },
    },
    { upsert: true },
  );

  if (handled) {
    await routeEvent(delivery.event as SupportedWebhookEvent, action, installationId);
  } else {
    logger.info("ignoring unsupported github webhook event", { event: delivery.event });
  }

  return { event: delivery.event, action, handled };
}

/**
 * Placeholder router for future internal events. Only installation lifecycle
 * changes are acted on today: everything else is recorded and ignored.
 */
async function routeEvent(
  event: SupportedWebhookEvent,
  action: string | null,
  installationId: number | null,
): Promise<void> {
  if (event === "installation" && installationId) {
    if (action === "deleted") await markInstallationStatus(installationId, "removed");
    if (action === "suspend") await markInstallationStatus(installationId, "suspended");
    if (action === "unsuspend") await markInstallationStatus(installationId, "active");
  }

  logger.info("github webhook received", { event, action, installationId });
}
