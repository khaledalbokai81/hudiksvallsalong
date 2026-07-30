import type { Server } from "node:http";
import mongoose from "mongoose";
import { sendStartupFailureAlert } from "./alerting.js";
import { createApp } from "./app.js";
import { startBackgroundWorkers, type BackgroundWorkerHandles } from "./backgroundWorkers.js";
import { config } from "./config.js";
import { connectDatabase, stopMemoryDatabase } from "./db.js";
import { logger } from "./logger.js";
import { assertStartupReadiness } from "./startupChecks.js";

const app = createApp();
const port = config.PORT;
let server: Server | undefined;
let backgroundWorkers: BackgroundWorkerHandles | undefined;

async function startServer() {
  try {
    await assertStartupReadiness();
    await connectDatabase();
    if (config.QA_SEED_DATA) {
      const { seedQaData } = await import("./qaSeed.js");

      await seedQaData({ source: "startup" });
    }
    if (config.API_BACKGROUND_WORKERS_ENABLED) {
      backgroundWorkers = startBackgroundWorkers();
    } else {
      logger.info("API background workers disabled");
    }
    server = app.listen(port, () => {
      logger.info("API listening", { url: `http://127.0.0.1:${port}` });
    });
  } catch (error) {
    logger.error("Failed to start API server", { error });
    await sendStartupFailureAlert(error).catch((alertError) => {
      logger.error("Failed to send startup failure alert", { error: alertError });
    });
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  logger.info("Closing API server", { signal });
  backgroundWorkers?.stop();

  server?.close(async () => {
    await mongoose.disconnect();
    await stopMemoryDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error });
  process.exit(1);
});

void startServer();
