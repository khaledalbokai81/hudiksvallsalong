import { config } from "./config.js";
import { logger } from "./logger.js";
import { buildExpiredUnverifiedBookingFilter } from "./bookingLifecycle.js";
import { Booking } from "./models/Booking.js";
import { EmailJob } from "./models/EmailJob.js";
import { clearPublicApiMicrocache } from "./middleware/publicCache.js";
import { runWithSchedulerLease } from "./schedulerLease.js";

let scheduler: NodeJS.Timeout | undefined;
let isProcessing = false;

const reliabilityCleanupLeaseTtlMs = Math.max(
  config.RELIABILITY_CLEANUP_INTERVAL_MS * 2,
  60_000
);

function buildStaleProcessingEmailJobFilter(now: Date) {
  return {
    status: "processing",
    $or: [
      { lockedUntil: { $exists: false } },
      { lockedUntil: { $lte: now } },
      { updatedAt: { $lte: new Date(now.getTime() - config.EMAIL_JOB_LOCK_MS) } }
    ]
  };
}

export async function expireUnverifiedBookings(
  extraFilter: Record<string, unknown> = {},
  now = new Date()
) {
  const expiredBookings = await Booking.find({
    ...buildExpiredUnverifiedBookingFilter(now),
    ...extraFilter
  })
    .select("_id")
    .sort({ emailVerificationExpiresAt: 1, createdAt: 1 })
    .limit(config.RELIABILITY_CLEANUP_BATCH_SIZE)
    .lean<{ _id: unknown }[]>();

  if (expiredBookings.length === 0) {
    return 0;
  }

  const result = await Booking.updateMany(
    { _id: { $in: expiredBookings.map((booking) => booking._id) } },
    {
      $set: {
        status: "canceled",
        canceledAt: now
      },
      $unset: {
        resolvedAt: ""
      }
    }
  );

  if (result.modifiedCount > 0) {
    clearPublicApiMicrocache("/availability");
  }

  return result.modifiedCount;
}

export async function repairStaleEmailJobs(now = new Date()) {
  const staleFilter = buildStaleProcessingEmailJobFilter(now);
  const failedJobs = await EmailJob.find({
    ...staleFilter,
    $expr: { $gte: ["$attempts", "$maxAttempts"] }
  })
    .select("_id")
    .sort({ updatedAt: 1, createdAt: 1 })
    .limit(config.RELIABILITY_CLEANUP_BATCH_SIZE)
    .lean<{ _id: unknown }[]>();
  const retryableJobs = await EmailJob.find({
    ...staleFilter,
    $expr: { $lt: ["$attempts", "$maxAttempts"] }
  })
    .select("_id")
    .sort({ updatedAt: 1, createdAt: 1 })
    .limit(config.RELIABILITY_CLEANUP_BATCH_SIZE)
    .lean<{ _id: unknown }[]>();
  const failedResult = await EmailJob.updateMany(
    {
      ...staleFilter,
      _id: { $in: failedJobs.map((job) => job._id) },
      $expr: { $gte: ["$attempts", "$maxAttempts"] }
    },
    {
      $set: {
        status: "failed",
        lastError: "Recovered from stale processing state after max attempts"
      },
      $unset: {
        lockedUntil: ""
      }
    }
  );
  const retryableResult = await EmailJob.updateMany(
    {
      ...staleFilter,
      _id: { $in: retryableJobs.map((job) => job._id) },
      $expr: { $lt: ["$attempts", "$maxAttempts"] }
    },
    {
      $set: {
        status: "pending",
        runAt: now
      },
      $unset: {
        lockedUntil: "",
        lastError: ""
      }
    }
  );

  return {
    failed: failedResult.modifiedCount,
    retryable: retryableResult.modifiedCount
  };
}

export async function processReliabilityCleanup(now = new Date()) {
  const [expiredBookings, staleEmailJobs] = await Promise.all([
    expireUnverifiedBookings({}, now),
    repairStaleEmailJobs(now)
  ]);

  return {
    expiredBookings,
    staleEmailJobs
  };
}

export function startReliabilityCleanupScheduler() {
  if (!config.RELIABILITY_CLEANUP_ENABLED || scheduler) {
    return () => undefined;
  }

  async function runSafely() {
    if (isProcessing) {
      return;
    }

    isProcessing = true;

    try {
      await runWithSchedulerLease(
        "reliability-cleanup",
        reliabilityCleanupLeaseTtlMs,
        () => processReliabilityCleanup()
      );
    } catch (error) {
      logger.error("Failed to process reliability cleanup", { error });
    } finally {
      isProcessing = false;
    }
  }

  scheduler = setInterval(() => {
    void runSafely();
  }, config.RELIABILITY_CLEANUP_INTERVAL_MS);

  void runSafely();

  return () => {
    if (scheduler) {
      clearInterval(scheduler);
      scheduler = undefined;
    }
  };
}
