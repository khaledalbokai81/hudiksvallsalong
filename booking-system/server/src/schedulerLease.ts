import { randomUUID } from "node:crypto";
import os from "node:os";
import { SchedulerLease } from "./models/SchedulerLease.js";

const ownerId = `${os.hostname()}:${process.pid}:${randomUUID()}`;

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

export async function runWithSchedulerLease<T>(
  key: string,
  ttlMs: number,
  task: () => Promise<T>
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    const lease = await SchedulerLease.findOneAndUpdate(
      {
        key,
        $or: [{ expiresAt: { $lte: now } }, { ownerId }]
      },
      {
        $set: {
          ownerId,
          expiresAt,
          heartbeatAt: now
        },
        $setOnInsert: { key }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean<{ ownerId: string }>();

    if (lease?.ownerId !== ownerId) {
      return { ran: false as const };
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { ran: false as const };
    }

    throw error;
  }

  return {
    ran: true as const,
    result: await task()
  };
}
