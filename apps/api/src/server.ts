import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { loadEnv, warnAboutWeakSecretConfiguration } from "./config/env.js";
import { logger } from "./lib/logger.js";

async function main(): Promise<void> {
  const env = loadEnv();
  warnAboutWeakSecretConfiguration(env);
  await connectDatabase();

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info("api listening", {
      port: env.PORT,
      env: env.NODE_ENV,
      githubApp: env.GITHUB_APP_SLUG,
      githubCallbackUrl: env.GITHUB_CALLBACK_URL,
    });
  });
}

main().catch((error: unknown) => {
  logger.error("failed to start api", { error });
  process.exitCode = 1;
});
