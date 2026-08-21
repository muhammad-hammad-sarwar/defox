import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let mongo: MongoMemoryServer;
let app: import("express").Express;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  Object.assign(process.env, {
    NODE_ENV: "test",
    MONGODB_URI: mongo.getUri(),
    MONGODB_DB_NAME: "defox-integration",
    WEB_APP_URL: "http://localhost:3000",
    SESSION_SECRET: "integration-session-secret-at-least-32-characters",
    GITHUB_APP_ID: "123",
    GITHUB_APP_NAME: "defox",
    GITHUB_APP_SLUG: "defox",
    GITHUB_CLIENT_ID: "integration-client-id",
    GITHUB_CLIENT_SECRET: "integration-client-secret",
    GITHUB_PRIVATE_KEY:
      "-----BEGIN PRIVATE KEY-----\nintegration-test-key\n-----END PRIVATE KEY-----",
    GITHUB_CALLBACK_URL: "http://localhost:3000/api/github/callback",
    GITHUB_WEBHOOK_SECRET: "integration-webhook-secret",
    INTERNAL_SERVICE_TOKEN: "integration-internal-service-token",
    E2B_API_KEY: "integration-e2b-key",
  });

  const { createApp } = await import("./app.js");
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: process.env.MONGODB_DB_NAME });
  app = createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("authentication API integration", () => {
  it("persists a user and permits the session cookie on /me", async () => {
    const agent = request.agent(app);

    const signup = await agent.post("/api/auth/signup").send({
      email: "person@example.test",
      name: "Test Person",
      password: "safe-test-password",
    });

    expect(signup.status).toBe(201);
    expect(signup.body).toMatchObject({
      ok: true,
      data: { user: { email: "person@example.test", name: "Test Person" } },
    });
    expect(signup.headers["set-cookie"]?.join(";")).toContain("defox_session=");

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      ok: true,
      data: { user: { email: "person@example.test", name: "Test Person" } },
    });
  });

  it("rejects malformed signup payloads with the stable validation response", async () => {
    const response = await request(app).post("/api/auth/signup").send({
      email: "not-an-email",
      name: "",
      password: "short",
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });
});
