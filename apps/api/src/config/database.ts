import mongoose from "mongoose";

import { getEnv } from "./env.js";
import { logger } from "../lib/logger.js";

export async function connectDatabase(): Promise<typeof mongoose> {
  const env = getEnv();
  mongoose.set("strictQuery", true);

  const connection = await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 10_000,
  });

  logger.info("mongodb connected", { database: env.MONGODB_DB_NAME });
  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
