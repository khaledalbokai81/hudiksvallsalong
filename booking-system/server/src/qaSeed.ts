import { createHash } from "node:crypto";
import { DateTime } from "luxon";
import { buildOccupiedSlotStarts, getSlotEnd } from "./bookingAvailability.js";
import { config } from "./config.js";
import { AdminAuditLog } from "./models/AdminAuditLog.js";
import { AlertState } from "./models/AlertState.js";
import { AvailabilityOverride } from "./models/AvailabilityOverride.js";
import { Booking } from "./models/Booking.js";
import { BrowserEvent } from "./models/BrowserEvent.js";
import { EmailJob } from "./models/EmailJob.js";
import { HttpRequestLog } from "./models/HttpRequestLog.js";
import { SystemEvent } from "./models/SystemEvent.js";
import {
  defaultServices,
  getBusinessSettings,
  updateBusinessSettings,
  type BusinessSettingsValue,
  type Service
} from "./services.js";

type SeedQaDataOptions = {
  source?: "startup" | "script";
};

const qaServices: Service[] = defaultServices.map((service) => ({ ...service }));

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function businessSlot(day: DateTime, hour: number) {
  return day.set({ hour, minute: 0, second: 0, millisecond: 0 }).toUTC().toJSDate();
}

function nextOperatingDay(settings: Pick<BusinessSettingsValue, "timezone" | "operatingWeekdays">, offset: number) {
  let day = DateTime.now().setZone(settings.timezone).startOf("day");
  let remaining = offset;

  while (true) {
    day = day.plus({ days: 1 });

    if (settings.operatingWeekdays.includes(day.weekday)) {
      remaining -= 1;

      if (remaining <= 0) {
        return day;
      }
    }
  }
}

function previousOperatingDay(settings: Pick<BusinessSettingsValue, "timezone" | "operatingWeekdays">, offset: number) {
  let day = DateTime.now().setZone(settings.timezone).startOf("day");
  let remaining = offset;

  while (true) {
    day = day.minus({ days: 1 });

    if (settings.operatingWeekdays.includes(day.weekday)) {
      remaining -= 1;

      if (remaining <= 0) {
        return day;
      }
    }
  }
}

function buildBooking({
  settings,
  day,
  hour,
  service,
  name,
  email,
  phone,
  status,
  emailVerified,
  notes,
  token,
  verificationExpiresAt
}: {
  settings: BusinessSettingsValue;
  day: DateTime;
  hour: number;
  service: Service;
  name: string;
  email: string;
  phone: string;
  status: "open" | "resolved" | "canceled";
  emailVerified: boolean;
  notes: string;
  token?: string;
  verificationExpiresAt?: Date;
}) {
  const appointmentAt = businessSlot(day, hour);
  const appointmentEndAt = getSlotEnd(appointmentAt, settings, service.durationHours);
  const now = new Date();

  return {
    name,
    email,
    phone,
    serviceId: service.id,
    serviceName: service.name,
    serviceDurationHours: service.durationHours,
    appointmentAt,
    appointmentEndAt,
    occupiedSlotStarts: buildOccupiedSlotStarts(appointmentAt, appointmentEndAt),
    status,
    emailVerified,
    emailVerifiedAt: emailVerified ? now : undefined,
    emailVerificationExpiresAt: verificationExpiresAt,
    verificationTokenHash: token ? tokenHash(token) : undefined,
    notes,
    resolvedAt: status === "resolved" ? now : undefined,
    canceledAt: status === "canceled" ? now : undefined
  };
}

export async function seedQaData(options: SeedQaDataOptions = {}) {
  if (config.NODE_ENV === "production") {
    throw new Error("QA seed data is disabled in production");
  }

  const existingSettings = await getBusinessSettings();
  const settings = await updateBusinessSettings({
    businessName: "QA Local Services",
    ownerEmail: existingSettings.ownerEmail,
    notificationEmailFromName: "QA Booking Notifications",
    timezone: existingSettings.timezone,
    operatingWeekdays: [1, 2, 3, 4, 5],
    slotStartHours: [8, 10, 12, 14],
    slotDurationHours: 2,
    services: qaServices,
    emailAutomations: {
      ...existingSettings.emailAutomations,
      ownerBookingNoticeEnabled: true,
      bookingReminderEnabled: true,
      reviewRequestEnabled: true
    },
    operationalControls: {
      bookingsPaused: false,
      bookingPauseMessage: "QA pause message: online booking is temporarily paused.",
      maintenanceBannerEnabled: true,
      maintenanceBannerMessage: "QA maintenance banner: testing customer-facing status."
    }
  });

  const day1 = nextOperatingDay(settings, 1);
  const day2 = nextOperatingDay(settings, 2);
  const day3 = nextOperatingDay(settings, 3);
  const day4 = nextOperatingDay(settings, 4);
  const day5 = nextOperatingDay(settings, 5);
  const day6 = nextOperatingDay(settings, 6);
  const pastDay = previousOperatingDay(settings, 1);
  const now = new Date();
  const standard = qaServices[0];
  const deepClean = qaServices[1];
  const project = qaServices[2];
  const office = qaServices[3];

  await Promise.all([
    Booking.deleteMany({
      $or: [{ email: /@qa\.local\.test$/ }, { name: /^QA / }]
    }),
    AvailabilityOverride.deleteMany({
      slotStartAt: {
        $in: [businessSlot(day1, 12), businessSlot(day2, 8), businessSlot(day6, 10)]
      }
    }),
    EmailJob.deleteMany({ idempotencyKey: /^qa-/ }),
    BrowserEvent.deleteMany({
      $or: [{ source: "qa-seed" }, { path: /^\/qa/ }, { message: /^QA / }]
    }),
    SystemEvent.deleteMany({ requestId: /^qa-/ }),
    HttpRequestLog.deleteMany({ requestId: /^qa-/ }),
    AdminAuditLog.deleteMany({ requestId: /^qa-/ }),
    AlertState.deleteMany({ key: /^qa-/ })
  ]);

  const bookings = await Booking.insertMany([
    buildBooking({
      settings,
      day: day1,
      hour: 8,
      service: standard,
      name: "QA Open Verified Customer",
      email: "open.verified@qa.local.test",
      phone: "+1 555 0101",
      status: "open",
      emailVerified: true,
      notes: "QA: active booking, should occupy the first standard-service window."
    }),
    buildBooking({
      settings,
      day: day2,
      hour: 12,
      service: standard,
      name: "QA Pending Verification Customer",
      email: "pending.verification@qa.local.test",
      phone: "+1 555 0102",
      status: "open",
      emailVerified: false,
      token: "qa-pending-verification-token-0123456789abcdef",
      verificationExpiresAt: DateTime.now().plus({ days: 2 }).toJSDate(),
      notes: "QA: unverified booking with a live magic-link token hash."
    }),
    buildBooking({
      settings,
      day: day3,
      hour: 14,
      service: office,
      name: "QA Business Account Customer",
      email: "business.account@qa.local.test",
      phone: "+1 555 0103",
      status: "open",
      emailVerified: true,
      notes: "QA: short service near end of day."
    }),
    buildBooking({
      settings,
      day: day4,
      hour: 8,
      service: deepClean,
      name: "QA Canceled Deep Service",
      email: "canceled.deep@qa.local.test",
      phone: "+1 555 0104",
      status: "canceled",
      emailVerified: true,
      notes: "QA: canceled long-service booking for admin list filters."
    }),
    buildBooking({
      settings,
      day: day5,
      hour: 8,
      service: project,
      name: "QA Large Project Customer",
      email: "project.customer@qa.local.test",
      phone: "+1 555 0105",
      status: "open",
      emailVerified: true,
      notes: "QA: long project booking that should block most of the day."
    }),
    buildBooking({
      settings,
      day: pastDay,
      hour: 10,
      service: office,
      name: "QA Resolved Past Customer",
      email: "resolved.past@qa.local.test",
      phone: "+1 555 0106",
      status: "resolved",
      emailVerified: true,
      notes: "QA: resolved past booking for reports and automated email checks."
    })
  ]);

  await AvailabilityOverride.insertMany([
    { slotStartAt: businessSlot(day1, 12), status: "busy" },
    { slotStartAt: businessSlot(day2, 8), status: "busy" },
    { slotStartAt: businessSlot(day6, 10), status: "busy" }
  ]);

  await EmailJob.insertMany([
    {
      type: "bookingVerification",
      status: "pending",
      idempotencyKey: "qa-email-pending-verification",
      payload: {
        to: "pending.verification@qa.local.test",
        name: "QA Pending Verification Customer",
        serviceName: standard.name,
        manageUrl: `${config.APP_BASE_URL}/manage-booking?token=qa-redacted-token`
      },
      runAt: now,
      attempts: 0,
      maxAttempts: 5
    },
    {
      type: "ownerBookingNotice",
      status: "failed",
      idempotencyKey: "qa-email-failed-owner-notice",
      payload: {
        to: settings.ownerEmail,
        businessName: settings.businessName,
        customerName: "QA Failed Email Customer",
        customerEmail: "failed.email@qa.local.test",
        customerPhone: "+1 555 0199",
        serviceName: deepClean.name,
        appointmentLabel: "QA appointment",
        adminUrl: `${config.APP_BASE_URL}/admin`
      },
      runAt: DateTime.now().minus({ minutes: 30 }).toJSDate(),
      attempts: 5,
      maxAttempts: 5,
      lastError: "QA simulated SMTP failure"
    },
    {
      type: "bookingReminder",
      status: "processing",
      idempotencyKey: "qa-email-stale-processing-reminder",
      payload: {
        to: "stale.processing@qa.local.test",
        name: "QA Stale Processing Customer",
        serviceName: standard.name,
        appointmentLabel: "QA stale lock"
      },
      runAt: DateTime.now().minus({ hours: 2 }).toJSDate(),
      lockedUntil: DateTime.now().minus({ minutes: 20 }).toJSDate(),
      attempts: 2,
      maxAttempts: 5,
      lastError: "QA worker stopped while processing"
    },
    {
      type: "reviewRequest",
      status: "sent",
      idempotencyKey: "qa-email-sent-review",
      payload: {
        to: "resolved.past@qa.local.test",
        name: "QA Resolved Past Customer",
        serviceName: office.name,
        reviewUrl: settings.emailAutomations.reviewUrl || config.APP_BASE_URL
      },
      runAt: DateTime.now().minus({ hours: 1 }).toJSDate(),
      sentAt: DateTime.now().minus({ minutes: 50 }).toJSDate(),
      attempts: 1,
      maxAttempts: 5
    }
  ]);

  await BrowserEvent.insertMany([
    {
      type: "page_load",
      path: "/booking",
      source: "qa-seed",
      userAgent: "QA Seed Browser"
    },
    {
      type: "javascript_error",
      path: "/admin",
      message: "QA simulated admin widget error",
      source: "qa-seed",
      stack: "Error: QA simulated admin widget error\n    at qaSeed",
      userAgent: "QA Seed Browser"
    },
    {
      type: "web_vitals",
      path: "/booking",
      source: "qa-seed",
      metricName: "LCP",
      metricValue: 2840,
      rating: "needs-improvement",
      userAgent: "QA Seed Browser"
    }
  ]);

  await SystemEvent.insertMany([
    {
      severity: "warning",
      type: "qa.seed",
      message: "QA warning event for monitoring review",
      code: "QA_WARNING",
      requestId: "qa-system-warning",
      method: "GET",
      path: "/api/qa-seed",
      statusCode: 429,
      details: { source: options.source || "manual" }
    },
    {
      severity: "error",
      type: "email.delivery",
      message: "QA simulated email delivery incident",
      code: "QA_EMAIL_FAILURE",
      requestId: "qa-system-error",
      method: "POST",
      path: "/api/email-jobs",
      statusCode: 503,
      details: { provider: "resend", simulated: true }
    }
  ]);

  await HttpRequestLog.insertMany([
    {
      requestId: "qa-request-booking-success",
      method: "POST",
      path: "/api/bookings",
      statusCode: 201,
      durationMs: 182,
      ip: "127.0.0.1",
      userAgent: "QA Seed Browser"
    },
    {
      requestId: "qa-request-admin-auth",
      method: "GET",
      path: "/api/bookings",
      statusCode: 401,
      durationMs: 24,
      ip: "127.0.0.1",
      userAgent: "QA Seed Browser"
    },
    {
      requestId: "qa-request-slot-conflict",
      method: "POST",
      path: "/api/bookings",
      statusCode: 409,
      durationMs: 96,
      ip: "127.0.0.1",
      userAgent: "QA Seed Browser"
    }
  ]);

  await AdminAuditLog.insertMany([
    {
      action: "business_settings.update",
      targetType: "businessSettings",
      targetId: "default",
      requestId: "qa-audit-settings",
      ip: "127.0.0.1",
      userAgent: "QA Seed Browser",
      details: { changedFields: ["services", "slotStartHours"], source: "qa-seed" }
    },
    {
      action: "availability.update",
      targetType: "availability",
      targetId: businessSlot(day6, 10).toISOString(),
      requestId: "qa-audit-availability",
      ip: "127.0.0.1",
      userAgent: "QA Seed Browser",
      details: { status: "busy", source: "qa-seed" }
    },
    {
      action: "email_job.retry",
      targetType: "emailJob",
      targetId: "qa-email-failed-owner-notice",
      requestId: "qa-audit-email-retry",
      ip: "127.0.0.1",
      userAgent: "QA Seed Browser",
      details: { type: "ownerBookingNotice", source: "qa-seed" }
    }
  ]);

  await AlertState.insertMany([
    {
      key: "qa-failed-email-jobs",
      status: "active",
      lastSentAt: DateTime.now().minus({ minutes: 15 }).toJSDate(),
      lastMessage: "QA active alert for failed email jobs"
    },
    {
      key: "qa-recovered-database-latency",
      status: "resolved",
      lastSentAt: DateTime.now().minus({ hours: 3 }).toJSDate(),
      lastResolvedAt: DateTime.now().minus({ hours: 2 }).toJSDate(),
      lastMessage: "QA resolved database latency alert"
    }
  ]);

  return {
    bookings: bookings.length,
    availabilityOverrides: 3,
    emailJobs: 4,
    browserEvents: 3,
    systemEvents: 2,
    requestLogs: 3,
    auditLogs: 3,
    alertStates: 2
  };
}
