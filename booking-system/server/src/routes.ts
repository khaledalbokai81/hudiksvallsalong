import { Router, type Request } from "express";
import { DateTime } from "luxon";
import mongoose from "mongoose";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  buildActiveAppointmentWindowFilter,
  buildAvailabilityDays,
  buildOccupiedSlotStarts,
  ensureSlotAvailable,
  ensureSupportedSlot,
  formatBusinessAppointment,
  getBookingInterval,
  getServiceDurationHours,
  getSlotEnd,
  intervalsOverlap,
  normalizeSlotStart,
  parseBusinessDate,
  startOfBusinessDay
} from "./bookingAvailability.js";
import { config } from "./config.js";
import { sendMonitorLoginCodeEmail, sendMonitorTestEmail } from "./email.js";
import { enqueueEmailJob } from "./emailJobs.js";
import { logger } from "./logger.js";
import {
  assertLoginAllowed,
  clearAdminSession,
  clearMonitorSession,
  clearLoginFailures,
  createAdminSession,
  createMonitorSession,
  getAdminCsrfToken,
  getMonitorCsrfToken,
  isAdminAuthenticated,
  isMonitorAuthenticated,
  recordLoginFailure,
  requireAdminCsrf,
  requireAdminAuth,
  requireMonitorAuth,
  requireMonitorCsrf,
  verifyAdminPassword,
  verifyMonitorPassword
} from "./middleware/auth.js";
import { asyncHandler, createHttpError } from "./middleware/errorHandling.js";
import {
  adminLoginLimiter,
  adminMutationLimiter,
  bookingCreateLimiter,
  frontendTelemetryLimiter,
  magicLinkLimiter
} from "./middleware/security.js";
import { getMetricsSnapshot } from "./metrics.js";
import { clearPublicApiMicrocache } from "./middleware/publicCache.js";
import { buildMonitoringDashboard } from "./routes/monitoringDashboard.js";
import { AdminAuditLog, type AdminAuditAction } from "./models/AdminAuditLog.js";
import { buildActiveBookingFilter } from "./bookingLifecycle.js";
import { AlertState } from "./models/AlertState.js";
import { AvailabilityOverride } from "./models/AvailabilityOverride.js";
import { BrowserEvent, type BrowserEventDocument } from "./models/BrowserEvent.js";
import { Booking } from "./models/Booking.js";
import { EmailJob, type EmailJobDocument, type EmailJobStatus } from "./models/EmailJob.js";
import { HttpRequestLog, type HttpRequestLogDocument } from "./models/HttpRequestLog.js";
import { MonitorLoginChallenge } from "./models/MonitorLoginChallenge.js";
import { SystemEvent, type SystemEventDocument } from "./models/SystemEvent.js";
import { WaitlistEntry, type WaitlistEntryDocument } from "./models/WaitlistEntry.js";
import { sanitizeLoggedPath } from "./sanitizePath.js";
import {
  getBusinessSettings,
  getServiceById,
  updateBusinessSettings,
  type BusinessSettingsValue
} from "./services.js";
import {
  convertWaitlistOffer,
  getWaitlistOffer,
  joinWaitlist,
  notifyNextWaitlistEntry
} from "./waitlist.js";

type LeanBooking = {
  _id: unknown;
  name?: string;
  email?: string;
  phone?: string;
  serviceId: string;
  serviceName: string;
  serviceDurationHours?: number;
  appointmentAt?: Date | string;
  appointmentEndAt?: Date | string;
  occupiedSlotStarts?: Date[] | string[];
  status?: "open" | "resolved" | "canceled";
  notes?: string;
  emailVerified?: boolean;
  emailVerifiedAt?: Date | string;
  emailVerificationExpiresAt?: Date | string;
  createdAt: Date | string;
  updatedAt?: Date | string;
  resolvedAt?: Date | string;
  canceledAt?: Date | string;
};

type BookingResponse = Omit<
  LeanBooking,
  "verificationTokenHash" | "reminderEmailSentAt" | "reviewEmailSentAt" | "occupiedSlotStarts"
> & {
  _id: unknown;
};

const bookingInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  email: z.string().trim().email("A valid email is required").max(120),
  phone: z.string().trim().max(30).optional().default(""),
  serviceId: z.string().trim().min(1, "Choose a service"),
  appointmentAt: z
    .string()
    .trim()
    .min(1, "Choose an available appointment time")
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "Choose a valid appointment time"
    }),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  waitlistToken: z.string().trim().min(32).max(256).optional()
});
const waitlistJoinSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().max(30).optional().default(""),
  serviceId: z.string().trim().min(1).max(80),
  slotStartAt: z.string().trim().min(1)
});
const waitlistOfferQuerySchema = z.object({
  token: z.string().trim().min(32).max(256)
});

const bookingStatusQuerySchema = z
  .object({
    status: z.enum(["open", "resolved", "canceled", "all"]).optional(),
    quickFilter: z
      .enum(["all", "new", "today", "upcoming", "unverified", "needs-follow-up"])
      .default("all"),
    query: z.string().trim().max(120).default(""),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50)
  })
  .passthrough();
const bookingParamsSchema = z.object({
  bookingId: z.string().min(1)
});
const verifyBookingSchema = z.object({
  token: z.string().trim().min(32, "Verification token is required").max(256)
});
const manageTokenSchema = z.object({
  token: z.string().trim().min(32, "Magic link token is required").max(256)
});
const manageBookingInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  phone: z.string().trim().max(30).optional().default(""),
  serviceId: z.string().trim().min(1, "Choose a service"),
  appointmentAt: z
    .string()
    .trim()
    .min(1, "Choose an available appointment time")
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "Choose a valid appointment time"
    }),
  notes: z.string().trim().max(500).optional().or(z.literal(""))
});
const availabilityQuerySchema = z
  .object({
    start: z.string().trim().optional(),
    days: z.coerce.number().int().min(1).max(90).optional(),
    serviceId: z.string().trim().optional()
  })
  .passthrough();
const availabilityUpdateSchema = z.object({
  slotStartAt: z.string().trim().min(1),
  status: z.enum(["open", "busy"])
});
const availabilityBulkUpdateSchema = z.object({
  slotStartAts: z.array(z.string().trim().min(1)).min(1).max(100),
  status: z.enum(["open", "busy"])
});
const serviceSettingsSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  duration: z.string().trim().min(1).max(80),
  durationHours: z.number().min(0.25).max(12).default(0.5),
  price: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500)
});
const timeValueSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/, "Use HH:MM time format");
const timeRangeSchema = z.object({
  start: timeValueSchema,
  end: timeValueSchema
}).refine((range) => range.start < range.end, { message: "End time must be after start time" });
const weeklyScheduleDaySchema = z.object({
  weekday: z.number().int().min(1).max(7),
  enabled: z.boolean(),
  openings: z.array(timeRangeSchema).max(4),
  breaks: z.array(timeRangeSchema).max(6)
});
const blackoutDateSchema = z.object({
  id: z.string().trim().min(1).max(80),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(160).optional().or(z.literal(""))
}).refine((value) => value.startDate <= value.endDate, { message: "Blackout end date must not be before its start date" });
const bookingRulesSchema = z.object({
  minimumNoticeHours: z.number().int().min(0).max(8760),
  bookingWindowDays: z.number().int().min(1).max(90),
  cancellationNoticeHours: z.number().int().min(0).max(8760),
  rescheduleNoticeHours: z.number().int().min(0).max(8760),
  requirePhone: z.boolean(),
  requireNotes: z.boolean(),
  confirmationMode: z.enum(["request", "instant"])
});
const optionalEmailSchema = z.union([z.string().trim().email().max(120), z.literal("")]).optional();
const optionalHttpUrlSchema = z.union([
  z.string().trim().url().refine((value) => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS URL"),
  z.literal("")
]).optional();
const businessSettingsUpdateSchema = z.object({
  businessName: z.string().trim().min(1).max(120).optional(),
  ownerEmail: z.string().trim().email().max(120).optional(),
  notificationEmailFromName: z.string().trim().min(1).max(120).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  ownerNotificationEmails: z.array(z.string().trim().email().max(120)).min(1).max(10).optional(),
  publicContact: z.object({
    email: optionalEmailSchema,
    phone: z.string().trim().max(30).optional(),
    address: z.string().trim().max(500).optional(),
    facebookUrl: optionalHttpUrlSchema,
    instagramUrl: optionalHttpUrlSchema,
    linkedinUrl: optionalHttpUrlSchema,
    emergencyMessage: z.string().trim().max(500).optional()
  }).optional(),
  legal: z.object({
    privacyContactEmail: optionalEmailSchema,
    cancellationPolicy: z.string().trim().max(4000).optional()
  }).optional(),
  operatingWeekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
  slotStartHours: z.array(z.number().int().min(0).max(23)).min(1).max(12).optional(),
  slotDurationHours: z.number().min(0.25).max(12).optional(),
  slotIntervalMinutes: z.number().int().min(15).max(720).optional(),
  weeklySchedule: z.array(weeklyScheduleDaySchema).length(7).optional(),
  blackoutDates: z.array(blackoutDateSchema).max(100).optional(),
  bookingRules: bookingRulesSchema.optional(),
  services: z.array(serviceSettingsSchema).min(1).max(24).optional()
});
const optionalUrlSchema = z
  .union([z.string().trim().url(), z.literal("")])
  .optional()
  .transform((value) => value || undefined);
const emailAutomationSettingsUpdateSchema = z.object({
  ownerBookingNoticeEnabled: z.boolean().optional(),
  bookingReminderEnabled: z.boolean().optional(),
  reviewRequestEnabled: z.boolean().optional(),
  reminderLeadHours: z
    .array(z.number().int().min(1).max(168))
    .min(1)
    .max(6)
    .transform((values) => [...new Set(values)].sort((left, right) => right - left))
    .optional(),
  reviewRequestDelayHours: z.number().int().min(0).max(720).optional(),
  reviewUrl: optionalUrlSchema,
  waitlistEnabled: z.boolean().optional(),
  waitlistOfferMinutes: z.number().int().min(5).max(1440).optional()
});
const operationalControlsUpdateSchema = z.object({
  bookingsPaused: z.boolean().optional(),
  bookingPauseMessage: z.string().trim().max(240).optional().or(z.literal("")),
  maintenanceBannerEnabled: z.boolean().optional(),
  maintenanceBannerMessage: z.string().trim().max(240).optional().or(z.literal(""))
});
const adminLoginSchema = z.object({
  password: z.string().min(1, "Password is required")
});
const monitorLoginVerifySchema = z.object({
  challengeId: z.string().trim().min(32, "Login challenge is required").max(128),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6 digit code")
});
const emailJobParamsSchema = z.object({
  jobId: z.string().min(1)
});
const monitorTestEmailSchema = z.object({
  to: z.string().trim().email().optional()
});
const browserTelemetrySchema = z.object({
  type: z.enum(["javascript_error", "unhandled_rejection", "web_vitals", "page_load"]),
  path: z.string().trim().min(1).max(2000),
  message: z.string().trim().max(1000).optional(),
  source: z.string().trim().max(500).optional(),
  stack: z.string().trim().max(5000).optional(),
  metricName: z.string().trim().max(80).optional(),
  metricValue: z.number().finite().nonnegative().optional(),
  rating: z.enum(["good", "needs-improvement", "poor"]).optional()
});

export const router = Router();

const DEFAULT_AVAILABILITY_DAYS = 21;

async function recordAdminAudit({
  req,
  action,
  targetType,
  targetId,
  details
}: {
  req: Request;
  action: AdminAuditAction;
  targetType:
    | "businessSettings"
    | "operationalControls"
    | "availability"
    | "booking"
    | "emailJob"
    | "monitor";
  targetId?: string;
  details?: Record<string, unknown>;
}) {
  await AdminAuditLog.create({
    action,
    targetType,
    targetId,
    details,
    requestId: resLocalRequestId(req),
    ip: req.ip,
    userAgent: req.header("user-agent")
  });
}

function clearPublicBookingCaches() {
  clearPublicApiMicrocache("/availability");
  clearPublicApiMicrocache("/services");
  clearPublicApiMicrocache("/operational-status");
  clearPublicApiMicrocache("/public-settings");
}

async function notifyReleasedWaitlistSlot(slotStartAt?: Date) {
  if (!slotStartAt) return;

  try {
    await notifyNextWaitlistEntry(slotStartAt);
  } catch (error) {
    logger.error("Failed to notify waitlist after slot release", {
      error,
      slotStartAt: slotStartAt.toISOString()
    });
  }
}

function resLocalRequestId(req: Request) {
  return typeof req.res?.locals?.requestId === "string" ? req.res.locals.requestId : undefined;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isTransactionUnsupported(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;

  return (
    code === 20 ||
    /Transaction numbers are only allowed|replica set member or mongos|Transaction.*not supported/i.test(
      message
    )
  );
}

async function runWithOptionalTransaction<T>(
  task: (session?: mongoose.ClientSession) => Promise<T>
) {
  const session = await mongoose.startSession();

  try {
    let result: T | undefined;

    try {
      await session.withTransaction(async () => {
        result = await task(session);
      });

      return result as T;
    } catch (error) {
      if (isTransactionUnsupported(error)) {
        return await task();
      }

      throw error;
    }
  } finally {
    await session.endSession();
  }
}

function getMonitorMfaRecipient() {
  return config.ALERT_EMAIL_TO || config.BUSINESS_OWNER_EMAIL;
}

function buildMonitoringUrl() {
  return new URL("/monitoring", config.APP_BASE_URL).toString();
}

function hashMonitorLoginCode(challengeId: string, code: string) {
  const secret = config.MONITOR_SESSION_SECRET || config.ADMIN_SESSION_SECRET;

  return createHash("sha256").update(`${challengeId}:${code}:${secret}`).digest("hex");
}

function isMatchingHash(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function buildManageUrl(token: string) {
  const manageUrl = new URL("/manage-booking", config.APP_BASE_URL);
  manageUrl.searchParams.set("token", token);

  return manageUrl.toString();
}

function buildAdminUrl() {
  return new URL("/admin", config.APP_BASE_URL).toString();
}

function ensureBookingsNotPaused(settings: BusinessSettingsValue) {
  if (settings.operationalControls.bookingsPaused) {
    throw createHttpError(
      503,
      settings.operationalControls.bookingPauseMessage ||
        "Online booking is temporarily paused. Please contact us directly.",
      "BOOKINGS_PAUSED"
    );
  }
}

function ensureObjectId(bookingId: string) {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw createHttpError(400, "Invalid booking id", "INVALID_BOOKING_ID", { bookingId });
  }
}

async function findBookingOrThrow(bookingId: string) {
  ensureObjectId(bookingId);
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw createHttpError(404, "Booking was not found", "BOOKING_NOT_FOUND", { bookingId });
  }

  return booking;
}

function buildBookingStatusFilter(status: "open" | "resolved" | "canceled" | "all" | undefined) {
  if (status === "resolved") {
    return { status: "resolved" };
  }

  if (status === "canceled") {
    return { status: "canceled" };
  }

  if (status === "all") {
    return {};
  }

  return buildActiveBookingFilter();
}

function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildBookingListFilter({
  status,
  quickFilter,
  query,
  timezone
}: {
  status: "open" | "resolved" | "canceled" | "all" | undefined;
  quickFilter: "all" | "new" | "today" | "upcoming" | "unverified" | "needs-follow-up";
  query: string;
  timezone: string;
}) {
  const filters: Record<string, unknown>[] = [buildBookingStatusFilter(status)];
  const now = DateTime.now().setZone(timezone);

  if (query) {
    const search = new RegExp(escapeRegularExpression(query), "i");
    filters.push({
      $or: ["name", "email", "phone", "serviceName", "notes"].map((field) => ({ [field]: search }))
    });
  }

  if (quickFilter === "new") {
    filters.push({ createdAt: { $gte: now.minus({ hours: 24 }).toJSDate() } });
  } else if (quickFilter === "today") {
    filters.push({
      appointmentAt: { $gte: now.startOf("day").toJSDate(), $lt: now.plus({ days: 1 }).startOf("day").toJSDate() }
    });
  } else if (quickFilter === "upcoming") {
    filters.push({ appointmentAt: { $gte: now.toJSDate(), $lte: now.plus({ days: 7 }).toJSDate() } });
  } else if (quickFilter === "unverified") {
    filters.push({ emailVerified: { $ne: true } });
  } else if (quickFilter === "needs-follow-up") {
    filters.push({
      $or: [{ emailVerified: { $ne: true } }, { appointmentAt: { $lt: now.toJSDate() } }]
    });
  }

  return filters.length === 1 ? filters[0] : { $and: filters };
}

function normalizeBookingStatus<T extends { status?: string }>(booking: T) {
  return {
    ...booking,
    status: (booking.status || "open") as "open" | "resolved" | "canceled"
  };
}

function serializeBooking(booking: unknown): BookingResponse {
  const rawBooking =
    booking && typeof booking === "object" && "toObject" in booking
      ? (booking as { toObject: () => Record<string, unknown> }).toObject()
      : (booking as Record<string, unknown>);
  const {
    verificationTokenHash: _verificationTokenHash,
    reminderEmailSentAt: _reminderEmailSentAt,
    reviewEmailSentAt: _reviewEmailSentAt,
    occupiedSlotStarts: _occupiedSlotStarts,
    __v: _version,
    ...safeBooking
  } = rawBooking;

  return normalizeBookingStatus(safeBooking as LeanBooking);
}

function getPayloadEmail(job: Pick<EmailJobDocument, "payload">) {
  const to = job.payload?.to;

  return typeof to === "string" ? to : undefined;
}

function serializeEmailJob(job: EmailJobDocument & { _id: unknown }) {
  return {
    _id: String(job._id),
    type: job.type,
    status: job.status,
    to: getPayloadEmail(job),
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    runAt: job.runAt?.toISOString(),
    lockedUntil: job.lockedUntil?.toISOString(),
    lastError: job.lastError,
    sentAt: job.sentAt?.toISOString(),
    createdAt: job.createdAt?.toISOString(),
    updatedAt: job.updatedAt?.toISOString()
  };
}

function serializeWaitlistEntry(entry: WaitlistEntryDocument & { _id: unknown }) {
  return {
    _id: String(entry._id),
    name: entry.name,
    email: entry.email,
    phone: entry.phone,
    serviceId: entry.serviceId,
    serviceName: entry.serviceName,
    slotStartAt: entry.slotStartAt.toISOString(),
    status: entry.status,
    offerExpiresAt: entry.offerExpiresAt?.toISOString(),
    notifiedAt: entry.notifiedAt?.toISOString(),
    convertedAt: entry.convertedAt?.toISOString(),
    createdAt: entry.createdAt.toISOString()
  };
}

function serializeSystemEvent(event: SystemEventDocument & { _id: unknown }) {
  return {
    _id: String(event._id),
    severity: event.severity,
    type: event.type,
    message: event.message,
    code: event.code,
    requestId: event.requestId,
    method: event.method,
    path: event.path,
    statusCode: event.statusCode,
    details: event.details,
    createdAt: event.createdAt?.toISOString()
  };
}

function serializeBrowserEvent(event: BrowserEventDocument & { _id: unknown }) {
  return {
    _id: String(event._id),
    type: event.type,
    path: event.path,
    message: event.message,
    source: event.source,
    stack: event.stack,
    metricName: event.metricName,
    metricValue: event.metricValue,
    rating: event.rating,
    userAgent: event.userAgent,
    createdAt: event.createdAt?.toISOString()
  };
}

function serializeRequestLog(log: HttpRequestLogDocument & { _id: unknown }) {
  return {
    _id: String(log._id),
    requestId: log.requestId,
    method: log.method,
    path: log.path,
    statusCode: log.statusCode,
    durationMs: log.durationMs,
    userAgent: log.userAgent,
    createdAt: log.createdAt?.toISOString()
  };
}

function summarizeCounts<T extends string>(items: { _id: T; count: number }[]) {
  return Object.fromEntries(items.map((item) => [item._id, item.count]));
}

async function getManageableBookingByToken(token: string) {
  const tokenHash = hashToken(token);
  const booking = await Booking.findOne({ verificationTokenHash: tokenHash });

  if (!booking) {
    throw createHttpError(
      400,
      "Booking magic link is invalid or expired",
      "INVALID_BOOKING_MAGIC_LINK"
    );
  }

  if (
    booking.emailVerificationExpiresAt &&
    booking.emailVerificationExpiresAt.getTime() <= Date.now()
  ) {
    throw createHttpError(
      400,
      "Booking magic link is invalid or expired",
      "INVALID_BOOKING_MAGIC_LINK"
    );
  }

  if (!booking.emailVerified) {
    booking.emailVerified = true;
    booking.emailVerifiedAt = new Date();
    await booking.save();
  }

  return booking;
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number, errorFactory: () => Error) {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      task,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(errorFactory()), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.get(
  "/ready",
  asyncHandler(async (_req, res) => {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      throw createHttpError(503, "Database connection is not ready", "DATABASE_NOT_READY");
    }

    await withTimeout(
      mongoose.connection.db.admin().ping(),
      1_500,
      () => createHttpError(503, "Database readiness check timed out", "DATABASE_READY_TIMEOUT")
    );
    res.json({ status: "ready", database: "ok" });
  })
);

router.get("/admin/metrics", requireAdminAuth, (_req, res) => {
  res.json({ metrics: getMetricsSnapshot() });
});

router.get(
  "/monitor/me",
  asyncHandler(async (req, res) => {
    res.json({ authenticated: await isMonitorAuthenticated(req) });
  })
);

router.get(
  "/monitor/csrf",
  requireMonitorAuth,
  asyncHandler(async (req, res) => {
    res.json({ csrfToken: await getMonitorCsrfToken(req) });
  })
);

router.post(
  "/monitor/login",
  adminLoginLimiter,
  asyncHandler(async (req, res) => {
    const { password } = adminLoginSchema.parse(req.body);
    await assertLoginAllowed("monitor", req);
    const isValidPassword = await verifyMonitorPassword(password);

    if (!isValidPassword) {
      await recordLoginFailure("monitor", req);
      throw createHttpError(401, "Invalid login credentials", "INVALID_LOGIN_CREDENTIALS");
    }

    if (config.MONITOR_MFA_ENABLED) {
      const challengeId = randomBytes(24).toString("hex");
      const code = String(randomInt(100_000, 1_000_000));
      const expiresAt = new Date(Date.now() + config.MONITOR_MFA_CODE_TTL_MINUTES * 60 * 1000);

      await MonitorLoginChallenge.create({
        challengeId,
        codeHash: hashMonitorLoginCode(challengeId, code),
        expiresAt,
        attempts: 0,
        ip: req.ip,
        userAgent: req.header("user-agent")
      });

      try {
        await sendMonitorLoginCodeEmail({
          to: getMonitorMfaRecipient(),
          code,
          expiresAt: expiresAt.toISOString(),
          ip: req.ip,
          userAgent: req.header("user-agent"),
          monitoringUrl: buildMonitoringUrl()
        });
      } catch (error) {
        await MonitorLoginChallenge.deleteOne({ challengeId });
        logger.warn("Monitor MFA email failed", {
          error,
          challengeId,
          recipient: getMonitorMfaRecipient()
        });

        throw createHttpError(
          503,
          "Could not send monitor verification email",
          "MONITOR_MFA_EMAIL_FAILED"
        );
      }

      res.json({
        authenticated: false,
        mfaRequired: true,
        challengeId,
        expiresAt: expiresAt.toISOString(),
        emailDelivery: "sent"
      });
      return;
    }

    await clearLoginFailures("monitor", req);
    await createMonitorSession(req, res);
    res.json({ authenticated: true, mfaRequired: false });
  })
);

router.post(
  "/monitor/login/verify",
  adminLoginLimiter,
  asyncHandler(async (req, res) => {
    const { challengeId, code } = monitorLoginVerifySchema.parse(req.body);
    const challenge = await MonitorLoginChallenge.findOne({ challengeId });

    if (!challenge || challenge.usedAt || challenge.expiresAt.getTime() <= Date.now()) {
      throw createHttpError(401, "Monitor login code is invalid or expired", "INVALID_MONITOR_MFA_CODE");
    }

    if (challenge.attempts >= config.MONITOR_MFA_MAX_ATTEMPTS) {
      throw createHttpError(429, "Too many monitor code attempts", "MONITOR_MFA_LOCKED");
    }

    const expectedHash = hashMonitorLoginCode(challengeId, code);

    if (!isMatchingHash(challenge.codeHash, expectedHash)) {
      challenge.attempts += 1;
      await challenge.save();
      throw createHttpError(401, "Monitor login code is invalid or expired", "INVALID_MONITOR_MFA_CODE");
    }

    challenge.usedAt = new Date();
    await challenge.save();

    await clearLoginFailures("monitor", req);
    await createMonitorSession(req, res);
    res.json({ authenticated: true });
  })
);

router.post(
  "/monitor/logout",
  requireMonitorAuth,
  requireMonitorCsrf,
  asyncHandler(async (req, res) => {
    await clearMonitorSession(req, res);
    res.status(204).send();
  })
);

router.get(
  "/monitor/dashboard",
  requireMonitorAuth,
  asyncHandler(async (_req, res) => {
    res.json(
      await buildMonitoringDashboard({
        buildAvailabilityDays,
        startOfBusinessDay
      })
    );
  })
);

router.patch(
  "/monitor/operational-controls",
  requireMonitorAuth,
  requireMonitorCsrf,
  adminMutationLimiter,
  asyncHandler(async (req, res) => {
    const input = operationalControlsUpdateSchema.parse(req.body);
    const currentSettings = await getBusinessSettings();
    const settings = await updateBusinessSettings({
      operationalControls: {
        ...currentSettings.operationalControls,
        ...input,
        bookingPauseMessage:
          input.bookingPauseMessage === ""
            ? undefined
            : input.bookingPauseMessage ?? currentSettings.operationalControls.bookingPauseMessage,
        maintenanceBannerMessage:
          input.maintenanceBannerMessage === ""
            ? undefined
            : input.maintenanceBannerMessage ??
              currentSettings.operationalControls.maintenanceBannerMessage
      }
    });

    await recordAdminAudit({
      req,
      action: "operational_controls.update",
      targetType: "operationalControls",
      targetId: "default",
      details: { changedFields: Object.keys(input) }
    });
    clearPublicApiMicrocache("/operational-status");

    res.json({ operationalControls: settings.operationalControls });
  })
);

router.post(
  "/monitor/test-email",
  requireMonitorAuth,
  requireMonitorCsrf,
  adminMutationLimiter,
  asyncHandler(async (req, res) => {
    const input = monitorTestEmailSchema.parse(req.body);
    const to = input.to || config.BUSINESS_OWNER_EMAIL;
    const generatedAt = new Date().toISOString();

    await sendMonitorTestEmail({
      to,
      generatedAt,
      appBaseUrl: config.APP_BASE_URL
    });

    await recordAdminAudit({
      req,
      action: "monitor.test_email",
      targetType: "monitor",
      targetId: to,
      details: { generatedAt }
    });

    res.json({ sent: true, to, generatedAt });
  })
);

router.post(
  "/telemetry/frontend",
  frontendTelemetryLimiter,
  asyncHandler(async (req, res) => {
    const input = browserTelemetrySchema.parse(req.body);

    await BrowserEvent.create({
      ...input,
      path: sanitizeLoggedPath(input.path),
      userAgent: req.header("user-agent")
    });

    res.status(204).send();
  })
);

router.get(
  "/admin/email-automations",
  requireAdminAuth,
  asyncHandler(async (_req, res) => {
    const settings = await getBusinessSettings();
    const [
      statusCounts,
      typeCounts,
      recentJobs,
      failedJobs,
      waitlistStatusCounts,
      recentWaitlistEntries
    ] = await Promise.all([
      EmailJob.aggregate<{ _id: EmailJobStatus; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      EmailJob.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$type", count: { $sum: 1 } } }
      ]),
      EmailJob.find().sort({ createdAt: -1 }).limit(30).lean<(EmailJobDocument & { _id: unknown })[]>(),
      EmailJob.find({ status: "failed" })
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean<(EmailJobDocument & { _id: unknown })[]>(),
      WaitlistEntry.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      WaitlistEntry.find()
        .sort({ createdAt: -1 })
        .limit(30)
        .lean<(WaitlistEntryDocument & { _id: unknown })[]>()
    ]);

    res.json({
      settings: {
        customerVerificationEnabled: true,
        ...settings.emailAutomations
      },
      runtime: {
        automatedSchedulerEnabled: config.AUTOMATED_EMAILS_ENABLED,
        emailJobWorkerEnabled: config.EMAIL_JOB_WORKER_ENABLED,
        smtpHost: config.SMTP_HOST,
        mailFrom: config.MAIL_FROM,
        maxAttempts: config.EMAIL_JOB_MAX_ATTEMPTS
      },
      summary: {
        byStatus: summarizeCounts(statusCounts),
        byType: summarizeCounts(typeCounts)
      },
      recentJobs: recentJobs.map(serializeEmailJob),
      failedJobs: failedJobs.map(serializeEmailJob),
      waitlist: {
        byStatus: summarizeCounts(waitlistStatusCounts),
        recentEntries: recentWaitlistEntries.map(serializeWaitlistEntry)
      }
    });
  })
);

router.patch(
  "/admin/email-automations",
  requireAdminAuth,
  requireAdminCsrf,
  adminMutationLimiter,
  asyncHandler(async (req, res) => {
    const input = emailAutomationSettingsUpdateSchema.parse(req.body);
    const currentSettings = await getBusinessSettings();
    const settings = await updateBusinessSettings({
      emailAutomations: {
        ...currentSettings.emailAutomations,
        ...input
      }
    });

    await recordAdminAudit({
      req,
      action: "email_automations.update",
      targetType: "businessSettings",
      targetId: "default",
      details: { changedFields: Object.keys(input) }
    });

    res.json({
      settings: {
        customerVerificationEnabled: true,
        ...settings.emailAutomations
      }
    });
  })
);

router.post(
  "/admin/email-jobs/:jobId/retry",
  requireAdminAuth,
  requireAdminCsrf,
  adminMutationLimiter,
  asyncHandler(async (req, res) => {
    const { jobId } = emailJobParamsSchema.parse(req.params);

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      throw createHttpError(400, "Invalid email job id", "INVALID_EMAIL_JOB_ID", { jobId });
    }

    const job = await EmailJob.findById(jobId);

    if (!job) {
      throw createHttpError(404, "Email job was not found", "EMAIL_JOB_NOT_FOUND", { jobId });
    }

    if (job.status === "processing") {
      throw createHttpError(409, "Email job is already processing", "EMAIL_JOB_PROCESSING");
    }

    job.status = "pending";
    job.attempts = 0;
    job.runAt = new Date();
    job.lockedUntil = undefined;
    job.lastError = undefined;
    await job.save();

    await recordAdminAudit({
      req,
      action: "email_job.retry",
      targetType: "emailJob",
      targetId: jobId,
      details: { type: job.type }
    });

    res.json({ job: serializeEmailJob(job as EmailJobDocument & { _id: unknown }) });
  })
);

router.post(
  "/monitor/email-jobs/:jobId/retry",
  requireMonitorAuth,
  requireMonitorCsrf,
  adminMutationLimiter,
  asyncHandler(async (req, res) => {
    const { jobId } = emailJobParamsSchema.parse(req.params);

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      throw createHttpError(400, "Invalid email job id", "INVALID_EMAIL_JOB_ID", { jobId });
    }

    const job = await EmailJob.findById(jobId);

    if (!job) {
      throw createHttpError(404, "Email job was not found", "EMAIL_JOB_NOT_FOUND", { jobId });
    }

    if (job.status === "processing") {
      throw createHttpError(409, "Email job is already processing", "EMAIL_JOB_PROCESSING");
    }

    job.status = "pending";
    job.attempts = 0;
    job.runAt = new Date();
    job.lockedUntil = undefined;
    job.lastError = undefined;
    await job.save();

    await recordAdminAudit({
      req,
      action: "email_job.retry",
      targetType: "emailJob",
      targetId: jobId,
      details: { type: job.type, source: "monitor" }
    });

    res.json({ job: serializeEmailJob(job as EmailJobDocument & { _id: unknown }) });
  })
);

router.post(
  "/monitor/email-jobs/:jobId/unlock",
  requireMonitorAuth,
  requireMonitorCsrf,
  adminMutationLimiter,
  asyncHandler(async (req, res) => {
    const { jobId } = emailJobParamsSchema.parse(req.params);

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      throw createHttpError(400, "Invalid email job id", "INVALID_EMAIL_JOB_ID", { jobId });
    }

    const job = await EmailJob.findById(jobId);

    if (!job) {
      throw createHttpError(404, "Email job was not found", "EMAIL_JOB_NOT_FOUND", { jobId });
    }

    if (job.status !== "processing") {
      throw createHttpError(409, "Only processing email jobs can be unlocked", "EMAIL_JOB_NOT_PROCESSING");
    }

    if (job.lockedUntil && job.lockedUntil.getTime() > Date.now()) {
      throw createHttpError(
        409,
        "Email job lock has not expired yet",
        "EMAIL_JOB_LOCK_ACTIVE",
        { lockedUntil: job.lockedUntil.toISOString() }
      );
    }

    job.status = job.attempts >= job.maxAttempts ? "failed" : "pending";
    job.runAt = new Date();
    job.lockedUntil = undefined;
    job.lastError = job.status === "failed" ? "Unlocked from stale processing state after max attempts" : undefined;
    await job.save();

    await recordAdminAudit({
      req,
      action: "email_job.unlock",
      targetType: "emailJob",
      targetId: jobId,
      details: { type: job.type, status: job.status, source: "monitor" }
    });

    res.json({ job: serializeEmailJob(job as EmailJobDocument & { _id: unknown }) });
  })
);

router.get(
  "/services",
  asyncHandler(async (_req, res) => {
    const settings = await getBusinessSettings();

    res.json({ services: settings.services });
  })
);

router.get(
  "/public-settings",
  asyncHandler(async (_req, res) => {
    const settings = await getBusinessSettings();

    res.json({
      settings: {
        businessName: settings.businessName,
        timezone: settings.timezone,
        publicContact: settings.publicContact,
        legal: settings.legal,
        bookingRules: settings.bookingRules
      }
    });
  })
);

router.get(
  "/operational-status",
  asyncHandler(async (_req, res) => {
    const settings = await getBusinessSettings();

    res.json({ operationalControls: settings.operationalControls });
  })
);

router.get(
  "/admin/me",
  asyncHandler(async (req, res) => {
    res.json({ authenticated: await isAdminAuthenticated(req) });
  })
);

router.get(
  "/admin/csrf",
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    res.json({ csrfToken: await getAdminCsrfToken(req) });
  })
);

router.post(
  "/admin/login",
  adminLoginLimiter,
  asyncHandler(async (req, res) => {
    const { password } = adminLoginSchema.parse(req.body);
    await assertLoginAllowed("admin", req);
    const isValidPassword = await verifyAdminPassword(password);

    if (!isValidPassword) {
      await recordLoginFailure("admin", req);
      throw createHttpError(401, "Invalid login credentials", "INVALID_LOGIN_CREDENTIALS");
    }

    await clearLoginFailures("admin", req);
    await createAdminSession(req, res);
    res.json({ authenticated: true });
  })
);

router.post(
  "/admin/logout",
  requireAdminAuth,
  requireAdminCsrf,
  asyncHandler(async (req, res) => {
    await clearAdminSession(req, res);
    res.status(204).send();
  })
);

router.get(
  "/business-settings",
  requireAdminAuth,
  asyncHandler(async (_req, res) => {
    const settings = await getBusinessSettings();

    res.json({ settings });
  })
);

router.patch(
  "/business-settings",
  requireAdminAuth,
  requireAdminCsrf,
  adminMutationLimiter,
  asyncHandler(async (req, res) => {
    const input = businessSettingsUpdateSchema.parse(req.body);

    if (input.timezone && !DateTime.now().setZone(input.timezone).isValid) {
      throw createHttpError(400, "Choose a valid IANA timezone", "INVALID_TIMEZONE");
    }

    if (input.services) {
      const ids = new Set(input.services.map((service) => service.id));

      if (ids.size !== input.services.length) {
        throw createHttpError(400, "Service ids must be unique", "DUPLICATE_SERVICE_IDS");
      }
    }

    if (input.operatingWeekdays) {
      input.operatingWeekdays = [...new Set(input.operatingWeekdays)].sort((left, right) => left - right);
    }

    if (input.weeklySchedule) {
      const weekdays = new Set(input.weeklySchedule.map((day) => day.weekday));
      if (weekdays.size !== 7) {
        throw createHttpError(400, "Weekly schedule must contain each weekday once", "INVALID_WEEKLY_SCHEDULE");
      }
      for (const day of input.weeklySchedule) {
        if (day.enabled && day.openings.length === 0) {
          throw createHttpError(400, "Enabled schedule days need opening hours", "INVALID_WEEKLY_SCHEDULE");
        }
        const breaksAreInsideOpening = day.breaks.every((breakRange) =>
          day.openings.some((opening) => breakRange.start >= opening.start && breakRange.end <= opening.end)
        );
        if (!breaksAreInsideOpening) {
          throw createHttpError(400, "Breaks must be inside opening hours", "INVALID_WEEKLY_SCHEDULE");
        }
      }
      input.operatingWeekdays = input.weeklySchedule
        .filter((day) => day.enabled)
        .map((day) => day.weekday);
      if (input.operatingWeekdays.length === 0) {
        throw createHttpError(400, "At least one weekday must be open", "INVALID_WEEKLY_SCHEDULE");
      }
    }

    if (input.ownerNotificationEmails) {
      input.ownerNotificationEmails = [...new Set(input.ownerNotificationEmails.map((email) => email.toLowerCase()))];
    }

    if (input.slotStartHours) {
      input.slotStartHours = [...new Set(input.slotStartHours)].sort((left, right) => left - right);
    }

    const settings = await updateBusinessSettings(input);
    await recordAdminAudit({
      req,
      action: "business_settings.update",
      targetType: "businessSettings",
      targetId: "default",
      details: { changedFields: Object.keys(input) }
    });
    clearPublicBookingCaches();

    res.json({ settings });
  })
);

router.get(
  "/availability",
  asyncHandler(async (req, res) => {
    const settings = await getBusinessSettings();
    const { start, days = DEFAULT_AVAILABILITY_DAYS, serviceId } = availabilityQuerySchema.parse(req.query);

    if (serviceId && !getServiceById(serviceId, settings)) {
      throw createHttpError(400, "Unknown service selected", "UNKNOWN_SERVICE", { serviceId });
    }

    const availabilityDays = await buildAvailabilityDays(
      parseBusinessDate(start, settings.timezone),
      days,
      settings,
      serviceId,
      await isAdminAuthenticated(req)
    );

    res.json({ days: availabilityDays, timezone: settings.timezone });
  })
);

router.post(
  "/waitlist",
  bookingCreateLimiter,
  asyncHandler(async (req, res) => {
    const settings = await getBusinessSettings();

    if (!settings.emailAutomations.waitlistEnabled) {
      throw createHttpError(503, "The waitlist is currently disabled", "WAITLIST_DISABLED");
    }

    const input = waitlistJoinSchema.parse(req.body);
    if (settings.bookingRules.requirePhone && input.phone.length < 7) {
      throw createHttpError(400, "Phone number is required", "PHONE_REQUIRED");
    }
    const service = getServiceById(input.serviceId, settings);

    if (!service) {
      throw createHttpError(400, "Unknown service selected", "UNKNOWN_SERVICE");
    }

    const slotStartAt = normalizeSlotStart(input.slotStartAt, settings.timezone);
    const serviceDurationHours = service.durationHours || settings.slotDurationHours;
    const slotEndAt = getSlotEnd(slotStartAt, settings, serviceDurationHours);
    const availability = await buildAvailabilityDays(
      startOfBusinessDay(settings.timezone, slotStartAt),
      1,
      settings,
      service.id
    );
    const slot = availability
      .flatMap((day) => day.slots)
      .find((candidate) => candidate.slotStartAt === slotStartAt.toISOString());

    if (!slot || slot.status === "past") {
      throw createHttpError(400, "Choose a valid future appointment time", "INVALID_WAITLIST_SLOT");
    }

    if (slot.isAvailable) {
      throw createHttpError(409, "This time is available to book now", "SLOT_AVAILABLE");
    }

    const result = await joinWaitlist({
      name: input.name,
      email: input.email,
      phone: input.phone,
      serviceId: service.id,
      serviceName: service.name,
      serviceDurationHours,
      slotStartAt,
      slotEndAt
    });

    res.status(result.alreadyJoined ? 200 : 201).json({
      alreadyJoined: result.alreadyJoined,
      message: result.alreadyJoined
        ? "You are already on the waitlist for this time."
        : "You joined the waitlist. We will email you if the time opens."
    });
  })
);

router.get(
  "/waitlist/offer",
  magicLinkLimiter,
  asyncHandler(async (req, res) => {
    const { token } = waitlistOfferQuerySchema.parse(req.query);
    const entry = await getWaitlistOffer(token);

    res.json({
      offer: {
        name: entry.name,
        email: entry.email,
        phone: entry.phone,
        serviceId: entry.serviceId,
        serviceName: entry.serviceName,
        slotStartAt: entry.slotStartAt.toISOString(),
        offerExpiresAt: entry.offerExpiresAt?.toISOString()
      }
    });
  })
);

router.patch(
  "/availability",
  requireAdminAuth,
  requireAdminCsrf,
  adminMutationLimiter,
  asyncHandler(async (req, res) => {
    const settings = await getBusinessSettings();
    const input = availabilityUpdateSchema.parse(req.body);
    const slotStartAt = normalizeSlotStart(input.slotStartAt, settings.timezone);
    ensureSupportedSlot(slotStartAt, settings);

    const slotEndAt = getSlotEnd(slotStartAt, settings, settings.slotDurationHours);
    const overlappingBookings = await Booking.find(
      buildActiveAppointmentWindowFilter(slotStartAt, slotEndAt)
    )
      .select("_id serviceId serviceDurationHours appointmentAt appointmentEndAt")
      .lean<LeanBooking[]>();
    const existingBooking = overlappingBookings.find((booking) => {
      const interval = getBookingInterval(booking, settings);

      return interval && intervalsOverlap(slotStartAt, slotEndAt, interval.start, interval.end);
    });

    if (existingBooking && input.status === "busy") {
      throw createHttpError(409, "A booking already uses this slot", "SLOT_ALREADY_BOOKED");
    }

    if (input.status === "open") {
      await AvailabilityOverride.deleteOne({ slotStartAt });
      await notifyReleasedWaitlistSlot(slotStartAt);
    } else {
      await AvailabilityOverride.findOneAndUpdate(
        { slotStartAt },
        { $set: { slotStartAt, status: "busy" } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    await recordAdminAudit({
      req,
      action: "availability.update",
      targetType: "availability",
      targetId: slotStartAt.toISOString(),
      details: { status: input.status }
    });
    clearPublicApiMicrocache("/availability");

    const availabilityDays = await buildAvailabilityDays(
      startOfBusinessDay(settings.timezone, slotStartAt),
      1,
      settings
    );

    res.json({ days: availabilityDays, timezone: settings.timezone });
  })
);

router.patch(
  "/availability/bulk",
  requireAdminAuth,
  requireAdminCsrf,
  adminMutationLimiter,
  asyncHandler(async (req, res) => {
    const settings = await getBusinessSettings();
    const input = availabilityBulkUpdateSchema.parse(req.body);
    const slotStartAts = [...new Set(input.slotStartAts)].map((value) =>
      normalizeSlotStart(value, settings.timezone)
    );

    slotStartAts.forEach((slotStartAt) => ensureSupportedSlot(slotStartAt, settings));

    if (input.status === "busy") {
      for (const slotStartAt of slotStartAts) {
        const slotEndAt = getSlotEnd(slotStartAt, settings, settings.slotDurationHours);
        const overlappingBookings = await Booking.find(
          buildActiveAppointmentWindowFilter(slotStartAt, slotEndAt)
        )
          .select("_id serviceId serviceDurationHours appointmentAt appointmentEndAt")
          .lean<LeanBooking[]>();
        const existingBooking = overlappingBookings.find((booking) => {
          const interval = getBookingInterval(booking, settings);
          return interval && intervalsOverlap(slotStartAt, slotEndAt, interval.start, interval.end);
        });

        if (existingBooking) {
          throw createHttpError(409, "A booking already uses one of these slots", "SLOT_ALREADY_BOOKED");
        }
      }
    }

    if (input.status === "open") {
      await AvailabilityOverride.deleteMany({ slotStartAt: { $in: slotStartAts } });
      await Promise.all(slotStartAts.map((slotStartAt) => notifyReleasedWaitlistSlot(slotStartAt)));
    } else {
      await AvailabilityOverride.bulkWrite(
        slotStartAts.map((slotStartAt) => ({
          updateOne: {
            filter: { slotStartAt },
            update: { $set: { slotStartAt, status: "busy" } },
            upsert: true
          }
        }))
      );
    }

    await recordAdminAudit({
      req,
      action: "availability.update",
      targetType: "availability",
      targetId: "bulk",
      details: {
        status: input.status,
        count: slotStartAts.length,
        slotStartAts: slotStartAts.map((value) => value.toISOString())
      }
    });
    clearPublicApiMicrocache("/availability");

    res.json({ updated: slotStartAts.length });
  })
);

router.get(
  "/bookings",
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const { status, quickFilter, query, page, limit } = bookingStatusQuerySchema.parse(req.query);
    const settings = await getBusinessSettings();
    const filter = buildBookingListFilter({
      status,
      quickFilter,
      query,
      timezone: settings.timezone
    });
    const [bookings, total] = await Promise.all([
      Booking.find(filter)
      .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeanBooking[]>(),
      Booking.countDocuments(filter)
    ]);

    res.json({
      bookings: bookings.map(serializeBooking),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  })
);

router.get(
  "/leads/summary",
  requireAdminAuth,
  asyncHandler(async (_req, res) => {
    const settings = await getBusinessSettings();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = DateTime.now().setZone(settings.timezone);
    const activeFilter = buildActiveBookingFilter();
    const [
      statusCounts,
      serviceCounts,
      newestLead,
      newLeadsLast7Days,
      newOpenLast24Hours,
      todayOpen,
      upcomingOpen,
      unverifiedOpen,
      needsFollowUp
    ] = await Promise.all([
      Booking.aggregate<{ _id: "open" | "resolved" | "canceled"; count: number }>([
        { $group: { _id: { $ifNull: ["$status", "open"] }, count: { $sum: 1 } } }
      ]),
      Booking.aggregate<{
        _id: { serviceId: string; status: "open" | "resolved" | "canceled" };
        count: number;
      }>([
        {
          $group: {
            _id: {
              serviceId: "$serviceId",
              status: { $ifNull: ["$status", "open"] }
            },
            count: { $sum: 1 }
          }
        }
      ]),
      Booking.findOne().sort({ createdAt: -1 }).select("serviceName").lean<LeanBooking>(),
      Booking.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Booking.countDocuments({ $and: [activeFilter, { createdAt: { $gte: now.minus({ hours: 24 }).toJSDate() } }] }),
      Booking.countDocuments({
        $and: [activeFilter, { appointmentAt: { $gte: now.startOf("day").toJSDate(), $lt: now.plus({ days: 1 }).startOf("day").toJSDate() } }]
      }),
      Booking.countDocuments({
        $and: [activeFilter, { appointmentAt: { $gte: now.toJSDate(), $lte: now.plus({ days: 7 }).toJSDate() } }]
      }),
      Booking.countDocuments({ $and: [activeFilter, { emailVerified: { $ne: true } }] }),
      Booking.countDocuments({
        $and: [activeFilter, { $or: [{ emailVerified: { $ne: true } }, { appointmentAt: { $lt: now.toJSDate() } }] }]
      })
    ]);
    const totalsByStatus = new Map(statusCounts.map((item) => [item._id, item.count]));
    const totalLeads = statusCounts.reduce((total, item) => total + item.count, 0);
    const resolvedLeads = totalsByStatus.get("resolved") || 0;
    const serviceStatusCounts = new Map(
      serviceCounts.map((item) => [
        `${item._id.serviceId}:${item._id.status}`,
        item.count
      ])
    );
    const leadsByService = settings.services.map((service) => {
      const open = serviceStatusCounts.get(`${service.id}:open`) || 0;
      const resolved = serviceStatusCounts.get(`${service.id}:resolved`) || 0;
      const canceled = serviceStatusCounts.get(`${service.id}:canceled`) || 0;

      return {
        serviceId: service.id,
        serviceName: service.name,
        total: open + resolved + canceled,
        open,
        resolved,
        canceled
      };
    });

    res.json({
      summary: {
        totalLeads,
        openLeads: totalsByStatus.get("open") || 0,
        resolvedLeads,
        canceledLeads: totalsByStatus.get("canceled") || 0,
        newLeadsLast7Days,
        newOpenLast24Hours,
        todayOpen,
        upcomingOpen,
        unverifiedOpen,
        needsFollowUp,
        resolutionRate: totalLeads === 0 ? 0 : Math.round((resolvedLeads / totalLeads) * 100),
        newestLeadService: newestLead?.serviceName || null,
        leadsByService
      }
    });
  })
);

router.post(
  "/bookings",
  bookingCreateLimiter,
  asyncHandler(async (req, res) => {
    const settings = await getBusinessSettings();
    ensureBookingsNotPaused(settings);
    const input = bookingInputSchema.parse(req.body);
    if (settings.bookingRules.requirePhone && input.phone.length < 7) {
      throw createHttpError(400, "Phone number is required", "PHONE_REQUIRED");
    }
    if (settings.bookingRules.requireNotes && !input.notes?.trim()) {
      throw createHttpError(400, "Booking notes are required", "NOTES_REQUIRED");
    }
    const service = getServiceById(input.serviceId, settings);

    if (!service) {
      throw createHttpError(400, "Unknown service selected", "UNKNOWN_SERVICE", {
        serviceId: input.serviceId
      });
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const emailVerificationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const email = input.email.toLowerCase();
    const appointmentAt = normalizeSlotStart(input.appointmentAt, settings.timezone);
    const serviceDurationHours = service.durationHours || settings.slotDurationHours;
    const appointmentEndAt = getSlotEnd(appointmentAt, settings, serviceDurationHours);
    const occupiedSlotStarts = buildOccupiedSlotStarts(appointmentAt, appointmentEndAt);
    const waitlistOffer = input.waitlistToken
      ? await getWaitlistOffer(input.waitlistToken)
      : undefined;

    if (
      waitlistOffer &&
      (waitlistOffer.email !== email ||
        waitlistOffer.serviceId !== service.id ||
        waitlistOffer.slotStartAt.getTime() !== appointmentAt.getTime())
    ) {
      throw createHttpError(
        403,
        "Waitlist offer does not match this booking",
        "WAITLIST_OFFER_MISMATCH"
      );
    }

    await ensureSlotAvailable(appointmentAt, settings, serviceDurationHours);

    const booking = await runWithOptionalTransaction(async (session) => {
      const [createdBooking] = await Booking.create(
        [
          {
            name: input.name,
            email,
            phone: input.phone,
            serviceId: service.id,
            serviceName: service.name,
            serviceDurationHours,
            appointmentAt,
            appointmentEndAt,
            occupiedSlotStarts,
            status: "open",
            emailVerified: false,
            verificationTokenHash: tokenHash,
            emailVerificationExpiresAt,
            notes: input.notes || undefined
          }
        ],
        { session }
      );

      const emailJobs: Promise<unknown>[] = [
        enqueueEmailJob({
          type: "bookingVerification",
          idempotencyKey: `booking-verification:${createdBooking._id}`,
          payload: {
            to: email,
            name: input.name,
            serviceName: service.name,
            manageUrl: buildManageUrl(token)
          },
          session
        })
      ];

      if (input.waitlistToken) {
        await convertWaitlistOffer(input.waitlistToken, createdBooking._id, session);
      }

      if (settings.emailAutomations.ownerBookingNoticeEnabled) {
        emailJobs.push(...settings.ownerNotificationEmails.map((recipient) =>
          enqueueEmailJob({
            type: "ownerBookingNotice",
            idempotencyKey: `owner-booking-notice:${createdBooking._id}:${recipient}`,
            payload: {
              to: recipient,
              businessName: settings.businessName,
              customerName: input.name,
              customerEmail: email,
              customerPhone: input.phone,
              serviceName: service.name,
              appointmentLabel: formatBusinessAppointment(appointmentAt, settings.timezone),
              notes: input.notes || undefined,
              adminUrl: buildAdminUrl()
            },
            session
          })
        ));
      }

      await Promise.all(emailJobs);

      return createdBooking;
    });
    clearPublicApiMicrocache("/availability");

    res.status(201).json({
      booking: serializeBooking(booking),
      message: settings.bookingRules.confirmationMode === "instant"
        ? "Booking confirmed. We sent a secure management link to your email."
        : "Booking request sent. You can verify your email from the message we send."
    });
  })
);

router.post(
  "/bookings/manage",
  magicLinkLimiter,
  asyncHandler(async (req, res) => {
    const { token } = manageTokenSchema.parse(req.body);
    const booking = await getManageableBookingByToken(token);

    res.json({ booking: serializeBooking(booking) });
  })
);

router.patch(
  "/bookings/manage",
  magicLinkLimiter,
  asyncHandler(async (req, res) => {
    const { token, ...rawInput } = z
      .object({ token: z.string().trim().min(32).max(256) })
      .and(manageBookingInputSchema)
      .parse(req.body);
    const booking = await getManageableBookingByToken(token);

    if (booking.status !== "open") {
      throw createHttpError(
        409,
        "Only active bookings can be edited",
        "BOOKING_NOT_EDITABLE"
      );
    }

    const settings = await getBusinessSettings();
    ensureBookingsNotPaused(settings);
    if (settings.bookingRules.requirePhone && rawInput.phone.length < 7) {
      throw createHttpError(400, "Phone number is required", "PHONE_REQUIRED");
    }
    if (settings.bookingRules.requireNotes && !rawInput.notes?.trim()) {
      throw createHttpError(400, "Booking notes are required", "NOTES_REQUIRED");
    }
    const service = getServiceById(rawInput.serviceId, settings);

    if (!service) {
      throw createHttpError(400, "Unknown service selected", "UNKNOWN_SERVICE", {
        serviceId: rawInput.serviceId
      });
    }

    const previousAppointmentAt = booking.appointmentAt;
    booking.name = rawInput.name;
    booking.phone = rawInput.phone;
    booking.serviceId = service.id;
    booking.serviceName = service.name;
    booking.serviceDurationHours = service.durationHours || settings.slotDurationHours;
    const appointmentAt = normalizeSlotStart(rawInput.appointmentAt, settings.timezone);
    if (
      previousAppointmentAt?.getTime() !== appointmentAt.getTime() &&
      previousAppointmentAt &&
      previousAppointmentAt.getTime() - Date.now() < settings.bookingRules.rescheduleNoticeHours * 60 * 60 * 1000
    ) {
      throw createHttpError(409, "This booking is too close to reschedule online", "RESCHEDULE_CUTOFF_REACHED");
    }
    await ensureSlotAvailable(
      appointmentAt,
      settings,
      booking.serviceDurationHours,
      String(booking._id)
    );
    booking.appointmentAt = appointmentAt;
    booking.appointmentEndAt = getSlotEnd(appointmentAt, settings, booking.serviceDurationHours);
    booking.occupiedSlotStarts = buildOccupiedSlotStarts(
      booking.appointmentAt,
      booking.appointmentEndAt
    );
    booking.notes = rawInput.notes || undefined;
    await booking.save();
    clearPublicApiMicrocache("/availability");
    if (previousAppointmentAt?.getTime() !== booking.appointmentAt?.getTime()) {
      await notifyReleasedWaitlistSlot(previousAppointmentAt);
    }

    res.json({ booking: serializeBooking(booking) });
  })
);

router.patch(
  "/bookings/manage/cancel",
  magicLinkLimiter,
  asyncHandler(async (req, res) => {
    const { token } = manageTokenSchema.parse(req.body);
    const booking = await getManageableBookingByToken(token);

    if (booking.status !== "open") {
      throw createHttpError(
        409,
        "Only active bookings can be canceled",
        "BOOKING_NOT_CANCELABLE"
      );
    }

    const settings = await getBusinessSettings();
    if (
      booking.appointmentAt &&
      booking.appointmentAt.getTime() - Date.now() < settings.bookingRules.cancellationNoticeHours * 60 * 60 * 1000
    ) {
      throw createHttpError(409, "This booking is too close to cancel online", "CANCELLATION_CUTOFF_REACHED");
    }

    booking.status = "canceled";
    booking.canceledAt = new Date();
    booking.resolvedAt = undefined;
    await booking.save();
    clearPublicApiMicrocache("/availability");
    await notifyReleasedWaitlistSlot(booking.appointmentAt);

    res.json({ booking: serializeBooking(booking) });
  })
);

router.post(
  "/bookings/verify",
  magicLinkLimiter,
  asyncHandler(async (req, res) => {
    const { token } = verifyBookingSchema.parse(req.body);
    const tokenHash = hashToken(token);
    const existingBooking = await Booking.findOne({ verificationTokenHash: tokenHash });

    if (existingBooking) {
      if (existingBooking.emailVerified) {
        res.json({ booking: serializeBooking(existingBooking) });
        return;
      }

      if (
        existingBooking.emailVerificationExpiresAt &&
        existingBooking.emailVerificationExpiresAt.getTime() <= Date.now()
      ) {
        throw createHttpError(
          400,
          "Verification link is invalid or expired",
          "INVALID_VERIFICATION_TOKEN"
        );
      }

      existingBooking.emailVerified = true;
      existingBooking.emailVerifiedAt = new Date();
      await existingBooking.save();

      res.json({ booking: serializeBooking(existingBooking) });
      return;
    }

    throw createHttpError(
      400,
      "Verification link is invalid or expired",
      "INVALID_VERIFICATION_TOKEN"
    );
  })
);

router.patch(
  "/bookings/:bookingId/resolve",
  requireAdminAuth,
  requireAdminCsrf,
  adminMutationLimiter,
  asyncHandler(async (req, res) => {
    const { bookingId } = bookingParamsSchema.parse(req.params);
    const booking = await findBookingOrThrow(bookingId);
    booking.status = "resolved";
    booking.resolvedAt = new Date();
    booking.canceledAt = undefined;
    await booking.save();
    clearPublicApiMicrocache("/availability");
    await notifyReleasedWaitlistSlot(booking.appointmentAt);
    await recordAdminAudit({
      req,
      action: "booking.resolve",
      targetType: "booking",
      targetId: bookingId
    });

    res.json({ booking: serializeBooking(booking) });
  })
);

router.patch(
  "/bookings/:bookingId/reopen",
  requireAdminAuth,
  requireAdminCsrf,
  adminMutationLimiter,
  asyncHandler(async (req, res) => {
    const { bookingId } = bookingParamsSchema.parse(req.params);
    const booking = await findBookingOrThrow(bookingId);
    const settings = await getBusinessSettings();

    if (booking.appointmentAt) {
      const serviceDurationHours =
        booking.serviceDurationHours || getServiceDurationHours(booking.serviceId, settings);

      await ensureSlotAvailable(booking.appointmentAt, settings, serviceDurationHours, bookingId);
      booking.serviceDurationHours = serviceDurationHours;
      booking.appointmentEndAt =
        booking.appointmentEndAt || getSlotEnd(booking.appointmentAt, settings, serviceDurationHours);
      booking.occupiedSlotStarts = buildOccupiedSlotStarts(
        booking.appointmentAt,
        booking.appointmentEndAt
      );
    }

    booking.status = "open";
    booking.resolvedAt = undefined;
    booking.canceledAt = undefined;
    await booking.save();
    clearPublicApiMicrocache("/availability");
    await recordAdminAudit({
      req,
      action: "booking.reopen",
      targetType: "booking",
      targetId: bookingId
    });

    res.json({ booking: serializeBooking(booking) });
  })
);

router.delete(
  "/bookings/:bookingId",
  requireAdminAuth,
  requireAdminCsrf,
  adminMutationLimiter,
  asyncHandler(async (req, res) => {
    const { bookingId } = bookingParamsSchema.parse(req.params);
    const booking = await findBookingOrThrow(bookingId);
    await Booking.deleteOne({ _id: bookingId });
    clearPublicApiMicrocache("/availability");
    await notifyReleasedWaitlistSlot(booking.appointmentAt);
    await recordAdminAudit({
      req,
      action: "booking.delete",
      targetType: "booking",
      targetId: bookingId
    });

    res.status(204).send();
  })
);
