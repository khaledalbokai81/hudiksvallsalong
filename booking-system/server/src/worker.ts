import mongoose from "mongoose";
import { sendStartupFailureAlert } from "./alerting.js";
import { startBackgroundWorkers, type BackgroundWorkerHandles } from "./backgroundWorkers.js";
import { connectDatabase } from "./db.js";
import { logger } from "./logger.js";

let backgroundWorkers: BackgroundWorkerHandles | undefined;

async function startWorker() {
  try {
    await connectDatabase();
    backgroundWorkers = startBackgroundWorkers();
    logger.info("Background worker process listening for jobs");
  } catch (error) {
    logger.error("Failed to start background worker process", { error });
    await sendStartupFailureAlert(error).catch((alertError) => {
      logger.error("Failed to send worker startup failure alert", { error: alertError });
    });
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  logger.info("Closing background worker process", { signal });
  backgroundWorkers?.stop();
  await mongoose.disconnect();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled worker promise rejection", { reason });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught worker exception", { error });
  process.exit(1);
});

void startWorker();
