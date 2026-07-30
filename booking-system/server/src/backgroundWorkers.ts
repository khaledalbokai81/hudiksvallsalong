import { startMonitorAlertScheduler } from "./alerting.js";
import { startAutomatedEmailScheduler } from "./automatedEmails.js";
import { startEmailJobWorker } from "./emailJobs.js";
import { logger } from "./logger.js";
import { startReliabilityCleanupScheduler } from "./reliabilityJobs.js";

export type BackgroundWorkerHandles = {
  stop: () => void;
};

export function startBackgroundWorkers(): BackgroundWorkerHandles {
  const stopAutomatedEmailScheduler = startAutomatedEmailScheduler();
  const stopEmailJobWorker = startEmailJobWorker();
  const stopMonitorAlertScheduler = startMonitorAlertScheduler();
  const stopReliabilityCleanupScheduler = startReliabilityCleanupScheduler();

  logger.info("Background workers started");

  return {
    stop() {
      stopAutomatedEmailScheduler();
      stopEmailJobWorker();
      stopMonitorAlertScheduler();
      stopReliabilityCleanupScheduler();
      logger.info("Background workers stopped");
    }
  };
}
