import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";

import { getEnv } from "./config/env.js";
import { sendSuccess } from "./lib/http.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import {
  githubInternalRouter,
  githubRouter,
} from "./modules/github/github.routes.js";
import { sessionRouter } from "./modules/sessions/session.routes.js";

export function createApp(): Express {
  const env = getEnv();
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: env.WEB_APP_URL, credentials: true }));
  app.use(cookieParser());

  // Webhook signatures are verified over the exact bytes GitHub sent, so this
  // route keeps a raw body while every other route gets JSON parsing.
  app.use("/api/github/webhooks", express.raw({ type: "application/json", limit: "1mb" }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/auth", authRouter);
  app.use("/api/github", githubRouter);
  app.use("/api/internal/github", githubInternalRouter);
  app.use("/api/sessions", sessionRouter);

  app.get("/api/health", (_req, res) => {
    sendSuccess(res, { status: "ok", uptime: process.uptime() });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
