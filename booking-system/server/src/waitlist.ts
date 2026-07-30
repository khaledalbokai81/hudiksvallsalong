import { DateTime } from "luxon";
import type { ClientSession } from "mongoose";
import { createHash, randomBytes } from "node:crypto";
import { config } from "./config.js";
import { ensureSlotAvailable } from "./bookingAvailability.js";
import { enqueueEmailJob } from "./emailJobs.js";
import { AppError, createHttpError } from "./middleware/errorHandling.js";
import {
  WaitlistEntry,
  type WaitlistEntryDocument
} from "./models/WaitlistEntry.js";
import { getBusinessSettings } from "./services.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

function getActiveKey(serviceId: string, slotStartAt: Date, email: string) {
  return createHash("sha256")
    .update(`${serviceId}:${slotStartAt.toISOString()}:${email.toLowerCase()}`)
    .digest("hex");
}

function formatAppointment(value: Date, timezone: string) {
  return DateTime.fromJSDate(value, { zone: "utc" }).setZone(timezone).toLocaleString({
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });
}

function buildWaitlistBookingUrl(token: string) {
  const url = new URL("/booking", config.APP_BASE_URL);
  url.searchParams.set("waitlist", token);
  return url.toString();
}

export async function joinWaitlist(input: {
  name: string;
  email: string;
  phone: string;
  serviceId: string;
  serviceName: string;
  serviceDurationHours: number;
  slotStartAt: Date;
  slotEndAt: Date;
}) {
  const email = input.email.toLowerCase();
  const activeKey = getActiveKey(input.serviceId, input.slotStartAt, email);
  let entry: WaitlistEntryDocument & { _id: unknown };
  let alreadyJoined = false;

  try {
    entry = await WaitlistEntry.create({
      ...input,
      email,
      activeKey,
      status: "waiting"
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const existing = await WaitlistEntry.findOne({ activeKey });
    if (!existing) throw error;
    entry = existing;
    alreadyJoined = true;
  }

  const settings = await getBusinessSettings();
  await enqueueEmailJob({
    type: "waitlistJoined",
    idempotencyKey: `waitlist-joined:${entry._id}`,
    payload: {
      to: entry.email,
      name: entry.name,
      businessName: settings.businessName,
      serviceName: entry.serviceName,
      appointmentLabel: formatAppointment(entry.slotStartAt, settings.timezone)
    }
  });

  return { entry, alreadyJoined };
}

export async function expireWaitlistOffers(now = new Date()) {
  const result = await WaitlistEntry.updateMany(
    { status: "notified", offerExpiresAt: { $lte: now } },
    {
      $set: { status: "expired" },
      $unset: { activeKey: "", offerTokenHash: "" }
    }
  );

  return result.modifiedCount;
}

export async function notifyNextWaitlistEntry(slotStartAt: Date, now = new Date()) {
  const settings = await getBusinessSettings();

  if (!settings.emailAutomations.waitlistEnabled) {
    return null;
  }

  await expireWaitlistOffers(now);

  const firstWaiting = await WaitlistEntry.findOne({ slotStartAt, status: "waiting" })
    .sort({ createdAt: 1 })
    .lean<WaitlistEntryDocument & { _id: unknown }>();

  if (!firstWaiting) return null;

  try {
    await ensureSlotAvailable(
      firstWaiting.slotStartAt,
      settings,
      firstWaiting.serviceDurationHours
    );
  } catch (error) {
    if (
      error instanceof AppError &&
      ["SLOT_BUSY", "SLOT_BOOKED", "SLOT_IN_PAST"].includes(error.code)
    ) {
      return null;
    }

    throw error;
  }

  const activeOffer = await WaitlistEntry.exists({
    slotStartAt,
    status: "notified",
    offerExpiresAt: { $gt: now }
  });

  if (activeOffer) {
    return null;
  }

  const token = randomBytes(32).toString("hex");
  const offerTokenHash = hashToken(token);
  const offerExpiresAt = new Date(
    now.getTime() + settings.emailAutomations.waitlistOfferMinutes * 60_000
  );
  const entry = await WaitlistEntry.findOneAndUpdate(
    { _id: firstWaiting._id, status: "waiting" },
    {
      $set: {
        status: "notified",
        notifiedAt: now,
        offerExpiresAt,
        offerTokenHash
      }
    },
    { new: true }
  );

  if (!entry) {
    return null;
  }

  try {
    await enqueueEmailJob({
      type: "waitlistAvailable",
      idempotencyKey: `waitlist-available:${entry._id}:${entry.notifiedAt?.getTime()}`,
      payload: {
        to: entry.email,
        name: entry.name,
        businessName: settings.businessName,
        serviceName: entry.serviceName,
        appointmentLabel: formatAppointment(entry.slotStartAt, settings.timezone),
        bookingUrl: buildWaitlistBookingUrl(token),
        expiresAt: formatAppointment(offerExpiresAt, settings.timezone)
      }
    });
  } catch (error) {
    await WaitlistEntry.updateOne(
      { _id: entry._id, status: "notified", offerTokenHash },
      {
        $set: { status: "waiting" },
        $unset: { notifiedAt: "", offerExpiresAt: "", offerTokenHash: "" }
      }
    );
    throw error;
  }

  return entry;
}

export async function processAvailableWaitlists(now = new Date(), limit = 25) {
  await expireWaitlistOffers(now);
  const candidates = await WaitlistEntry.aggregate<{ slotStartAt: Date }>([
    { $match: { status: "waiting", slotStartAt: { $gt: now } } },
    { $sort: { createdAt: 1 } },
    { $group: { _id: "$slotStartAt", slotStartAt: { $first: "$slotStartAt" } } },
    { $limit: limit }
  ]);
  let notified = 0;

  for (const candidate of candidates) {
    if (await notifyNextWaitlistEntry(candidate.slotStartAt, now)) notified += 1;
  }

  return { notified };
}

export async function getWaitlistOffer(token: string) {
  const entry = await WaitlistEntry.findOne({
    offerTokenHash: hashToken(token),
    status: "notified",
    offerExpiresAt: { $gt: new Date() }
  }).lean<WaitlistEntryDocument & { _id: unknown }>();

  if (!entry) {
    throw createHttpError(400, "Waitlist offer is invalid or expired", "INVALID_WAITLIST_OFFER");
  }

  return entry;
}

export async function convertWaitlistOffer(
  token: string,
  bookingId: unknown,
  session?: ClientSession
) {
  const result = await WaitlistEntry.updateOne(
    {
      offerTokenHash: hashToken(token),
      status: "notified",
      offerExpiresAt: { $gt: new Date() }
    },
    {
      $set: {
        status: "converted",
        convertedAt: new Date(),
        convertedBookingId: bookingId
      },
      $unset: { activeKey: "", offerTokenHash: "" }
    },
    { session }
  );

  if (result.modifiedCount !== 1) {
    throw createHttpError(409, "Waitlist offer is no longer available", "WAITLIST_OFFER_CONSUMED");
  }
}
