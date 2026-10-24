import app from "./app";
import { logger } from "./lib/logger";

export { app };
export {
  extractJson,
  buildFallbackDeliverable,
  runGenerationPipeline,
  tweakWebapp,
} from "./lib/ai/pipeline.js";
export {
  createAuthToken,
  verifyAuthToken,
  hashPassword,
  verifyPassword,
} from "./routes/auth.js";
export {
  MAX_IDEA_LENGTH,
  MAX_MESSAGE_LENGTH,
} from "./routes/generations/index.js";
export { CreateGenerationBody, TweakGenerationBody } from "@workspace/api-zod";

if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  const rawPort = process.env["PORT"] || "3000";
  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}
