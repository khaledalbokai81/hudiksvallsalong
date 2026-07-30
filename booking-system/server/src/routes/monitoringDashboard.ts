import { DateTime } from "luxon";
import mongoose from "mongoose";
import { buildActiveBookingFilter } from "../bookingLifecycle.js";
import { config } from "../config.js";
import { getMetricsSnapshot } from "../metrics.js";
import { AdminAuditLog, type AdminAuditAction } from "../models/AdminAuditLog.js";
import { AlertState } from "../models/AlertState.js";
import { BrowserEvent, type BrowserEventDocument } from "../models/BrowserEvent.js";
import { Booking } from "../models/Booking.js";
import { EmailJob, type EmailJobDocument, type EmailJobStatus } from "../models/EmailJob.js";
import { HttpRequestLog, type HttpRequestLogDocument } from "../models/HttpRequestLog.js";
import { SystemEvent, type SystemEventDocument } from "../models/SystemEvent.js";
import { getBusinessSettings, type BusinessSettingsValue } from "../services.js";

type LeanBooking = {
  _id: unknown;
  name?: string;
  serviceId: string;
  serviceName: string;
  serviceDurationHours?: number;
  appointmentAt?: Date | string;
  appointmentEndAt?: Date | string;
  status?: "open" | "resolved" | "canceled";
  emailVerified?: boolean;
  createdAt: Date | string;
};

type MonitoringDashboardDependencies = {
  buildAvailabilityDays: (
    start: DateTime,
    days: number,
    settings: BusinessSettingsValue,
    serviceId?: string
  ) => Promise<Array<{ slots: Array<{ status: string }> }>>;
  startOfBusinessDay: (timezone: string, value?: Date) => DateTime;
};

function getBookingDate(value: Date | string | undefined) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value : new Date(value);
}

function getPayloadEmail(job: Pick<EmailJobDocument, "payload">) {
  const payload = job.payload as { to?: unknown };

  return typeof payload.to === "string" ? payload.to : undefined;
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
    sentAt: job.sentAt?.toISOString(),
    lastError: job.lastError,
    createdAt: job.createdAt?.toISOString(),
    updatedAt: job.updatedAt?.toISOString()
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
    metricName: event.metricName,
    metricValue: event.metricValue,
    rating: event.rating,
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
    createdAt: log.createdAt?.toISOString()
  };
}

function getHourlyBucketExpression(field = "$createdAt") {
  return {
    $dateToString: {
      format: "%Y-%m-%dT%H:00:00.000Z",
      date: field,
      timezone: "UTC"
    }
  };
}

async function getDatabaseStats() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return {
      available: false,
      collections: 0,
      objects: 0,
      dataSizeMb: 0,
      storageSizeMb: 0,
      indexSizeMb: 0
    };
  }

  try {
    const stats = await mongoose.connection.db.stats();
    let connections: number | undefined;

    try {
      const serverStatus = await mongoose.connection.db.admin().serverStatus();
      connections = serverStatus.connections?.current;
    } catch {
      connections = undefined;
    }

    return {
      available: true,
      collections: stats.collections || 0,
      objects: stats.objects || 0,
      dataSizeMb: Math.round((stats.dataSize || 0) / 1024 / 1024),
      storageSizeMb: Math.round((stats.storageSize || 0) / 1024 / 1024),
      indexSizeMb: Math.round((stats.indexSize || 0) / 1024 / 1024),
      connections
    };
  } catch {
    return {
      available: false,
      collections: 0,
      objects: 0,
      dataSizeMb: 0,
      storageSizeMb: 0,
      indexSizeMb: 0
    };
  }
}

async function runSyntheticChecks(settings: BusinessSettingsValue, deps: MonitoringDashboardDependencies) {
  const checks: Array<{
    name: string;
    status: "pass" | "fail" | "warn";
    durationMs: number;
    message: string;
  }> = [];

  async function check(name: string, task: () => Promise<string>) {
    const startedAt = Date.now();

    try {
      const message = await task();
      checks.push({ name, status: "pass", durationMs: Date.now() - startedAt, message });
    } catch (error) {
      checks.push({
        name,
        status: "fail",
        durationMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : "Synthetic check failed"
      });
    }
  }

  await check("Services load", async () => {
    if (settings.services.length === 0) {
      throw new Error("No services configured");
    }

    return `${settings.services.length} services configured`;
  });

  await check("Availability opens", async () => {
    const availabilityDays = await deps.buildAvailabilityDays(
      deps.startOfBusinessDay(settings.timezone),
      7,
      settings,
      settings.services[0]?.id
    );
    const openSlots = availabilityDays.flatMap((day) => day.slots).filter((slot) => slot.status === "open");

    if (openSlots.length === 0) {
      throw new Error("No open customer slots in the next 7 operating days");
    }

    return `${openSlots.length} open slots available`;
  });

  await check("Booking form operational", async () => {
    if (settings.operationalControls.bookingsPaused) {
      return "Bookings are intentionally paused";
    }

    if (!settings.services[0]) {
      throw new Error("No service available for booking form");
    }

    return "Booking form can accept requests";
  });

  return checks;
}

function summarizeCounts<T extends string>(items: { _id: T; count: number }[]) {
  return Object.fromEntries(items.map((item) => [item._id, item.count]));
}

function serializeMonitoringBooking(booking: LeanBooking) {
  return {
    _id: String(booking._id),
    name: booking.name,
    serviceName: booking.serviceName,
    appointmentAt: getBookingDate(booking.appointmentAt)?.toISOString(),
    status: booking.status || "open",
    emailVerified: Boolean(booking.emailVerified),
    createdAt: getBookingDate(booking.createdAt)?.toISOString()
  };
}

export async function buildMonitoringDashboard(deps: MonitoringDashboardDependencies) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const staleEmailLockCutoff = new Date(now.getTime() - config.EMAIL_JOB_LOCK_MS);
  const pendingEmailAgeCutoff = new Date(now.getTime() - 15 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const metrics = getMetricsSnapshot();
  const databaseReady = mongoose.connection.readyState === 1 && Boolean(mongoose.connection.db);
  const settings = await getBusinessSettings();

  const [
    bookingStatusCounts,
    bookingsToday,
    upcomingBookings24Hours,
    pastOpenBookings,
    bookingsLast7Days,
    unverifiedOpenBookings,
    recentBookings,
    emailStatusCounts,
    staleProcessingEmailJobs,
    oldPendingEmailJobs,
    oldestPendingEmailJob,
    lastSentEmailJob,
    recentEmailJobs,
    failedEmailJobs,
    recentAuditLogs,
    recentAlertStates,
    recentSystemEvents,
    recentBrowserEvents,
    browserEventCounts,
    poorWebVitals,
    recentRequestLogs,
    requestTrend,
    bookingTrend,
    emailFailureTrend,
    databaseStats,
    syntheticChecks
  ] = await Promise.all([
    Booking.aggregate<{ _id: "open" | "resolved" | "canceled"; count: number }>([
      { $group: { _id: { $ifNull: ["$status", "open"] }, count: { $sum: 1 } } }
    ]),
    Booking.countDocuments({ createdAt: { $gte: dayStart } }),
    Booking.countDocuments({
      ...buildActiveBookingFilter({ appointmentAt: { $gte: now, $lte: next24Hours } }, now)
    }),
    Booking.countDocuments({
      ...buildActiveBookingFilter({ appointmentAt: { $lt: now } }, now)
    }),
    Booking.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    Booking.countDocuments({
      ...buildActiveBookingFilter({ emailVerified: false }, now)
    }),
    Booking.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .select("_id name serviceName appointmentAt status emailVerified createdAt")
      .lean<LeanBooking[]>(),
    EmailJob.aggregate<{ _id: EmailJobStatus; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    EmailJob.find({
      status: "processing",
      $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lte: now } }, { updatedAt: { $lte: staleEmailLockCutoff } }]
    })
      .sort({ updatedAt: 1 })
      .limit(8)
      .lean<(EmailJobDocument & { _id: unknown })[]>(),
    EmailJob.countDocuments({
      status: "pending",
      runAt: { $lte: pendingEmailAgeCutoff }
    }),
    EmailJob.findOne({ status: "pending" })
      .sort({ runAt: 1, createdAt: 1 })
      .select("runAt createdAt")
      .lean<(EmailJobDocument & { _id: unknown }) | null>(),
    EmailJob.findOne({ status: "sent" })
      .sort({ sentAt: -1, updatedAt: -1 })
      .select("sentAt updatedAt")
      .lean<(EmailJobDocument & { _id: unknown }) | null>(),
    EmailJob.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .lean<(EmailJobDocument & { _id: unknown })[]>(),
    EmailJob.find({ status: "failed" })
      .sort({ updatedAt: -1 })
      .limit(8)
      .lean<(EmailJobDocument & { _id: unknown })[]>(),
    AdminAuditLog.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .select("_id action targetType targetId createdAt")
      .lean<
        {
          _id: unknown;
          action: AdminAuditAction;
          targetType: "businessSettings" | "availability" | "booking" | "emailJob" | "monitor";
          targetId?: string;
          createdAt: Date;
        }[]
      >(),
    AlertState.find()
      .sort({ updatedAt: -1 })
      .limit(12)
      .select("key status lastSentAt lastResolvedAt lastMessage updatedAt")
      .lean<
        {
          _id: unknown;
          key: string;
          status: "active" | "resolved";
          lastSentAt?: Date;
          lastResolvedAt?: Date;
          lastMessage?: string;
          updatedAt: Date;
        }[]
      >(),
    SystemEvent.find({ severity: { $in: ["warning", "error"] } })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean<(SystemEventDocument & { _id: unknown })[]>(),
    BrowserEvent.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean<(BrowserEventDocument & { _id: unknown })[]>(),
    BrowserEvent.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: dayAgo } } },
      { $group: { _id: "$type", count: { $sum: 1 } } }
    ]),
    BrowserEvent.countDocuments({
      createdAt: { $gte: dayAgo },
      type: "web_vitals",
      rating: "poor"
    }),
    HttpRequestLog.find()
      .sort({ createdAt: -1 })
      .limit(30)
      .lean<(HttpRequestLogDocument & { _id: unknown })[]>(),
    HttpRequestLog.aggregate<{
      _id: string;
      requests: number;
      errors: number;
      averageDurationMs: number;
    }>([
      { $match: { createdAt: { $gte: dayAgo } } },
      {
        $group: {
          _id: getHourlyBucketExpression(),
          requests: { $sum: 1 },
          errors: { $sum: { $cond: [{ $gte: ["$statusCode", 500] }, 1, 0] } },
          averageDurationMs: { $avg: "$durationMs" }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    Booking.aggregate<{ _id: string; created: number }>([
      { $match: { createdAt: { $gte: dayAgo } } },
      { $group: { _id: getHourlyBucketExpression(), created: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    EmailJob.aggregate<{ _id: string; failed: number }>([
      { $match: { updatedAt: { $gte: dayAgo }, status: "failed" } },
      { $group: { _id: getHourlyBucketExpression("$updatedAt"), failed: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    getDatabaseStats(),
    runSyntheticChecks(settings, deps)
  ]);

  const bookingsByStatus = summarizeCounts(bookingStatusCounts);
  const emailsByStatus = summarizeCounts(emailStatusCounts);
  const totalBookings = bookingStatusCounts.reduce((total, item) => total + item.count, 0);
  const queuedEmails = (emailsByStatus.pending || 0) + (emailsByStatus.processing || 0);
  const oldestPendingRunAt = oldestPendingEmailJob?.runAt || oldestPendingEmailJob?.createdAt;
  const oldestPendingAgeMinutes = oldestPendingRunAt
    ? Math.max(0, Math.round((now.getTime() - oldestPendingRunAt.getTime()) / 60_000))
    : 0;
  const errorRate =
    metrics.httpRequestsTotal === 0
      ? 0
      : Math.round((metrics.httpErrorsTotal / metrics.httpRequestsTotal) * 100);
  const browserCounts = summarizeCounts(browserEventCounts);
  const failedSyntheticChecks = syntheticChecks.filter((check) => check.status === "fail");
  const incidents = [
    ...(databaseReady
      ? []
      : [{ severity: "critical", message: "Database connection is not ready", action: "Check MongoDB connection and credentials" }]),
    ...(staleProcessingEmailJobs.length > 0
      ? [
          {
            severity: "critical",
            message: `${staleProcessingEmailJobs.length} email job${staleProcessingEmailJobs.length === 1 ? "" : "s"} stuck in processing`,
            action: "Unlock stale jobs and confirm the worker is running"
          }
        ]
      : []),
    ...(emailsByStatus.failed
      ? [
          {
            severity: "warning",
            message: `${emailsByStatus.failed} failed email job${emailsByStatus.failed === 1 ? "" : "s"}`,
            action: "Review the last error and retry after fixing SMTP or payload issues"
          }
        ]
      : []),
    ...(oldPendingEmailJobs > 0
      ? [
          {
            severity: "warning",
            message: `${oldPendingEmailJobs} pending email job${oldPendingEmailJobs === 1 ? "" : "s"} older than 15 minutes`,
            action: "Confirm the email worker is enabled and processing"
          }
        ]
      : []),
    ...(pastOpenBookings > 0
      ? [
          {
            severity: "warning",
            message: `${pastOpenBookings} open booking${pastOpenBookings === 1 ? "" : "s"} are in the past`,
            action: "Resolve, cancel, or follow up from the owner dashboard"
          }
        ]
      : []),
    ...(metrics.httpErrorsTotal > 0
      ? [
          {
            severity: "warning",
            message: `${metrics.httpErrorsTotal} server error${metrics.httpErrorsTotal === 1 ? "" : "s"} recorded since process start`,
            action: "Inspect recent system events"
          }
        ]
      : []),
    ...(browserCounts.javascript_error || browserCounts.unhandled_rejection
      ? [
          {
            severity: "warning",
            message: `${(browserCounts.javascript_error || 0) + (browserCounts.unhandled_rejection || 0)} frontend error${(browserCounts.javascript_error || 0) + (browserCounts.unhandled_rejection || 0) === 1 ? "" : "s"} in the last 24 hours`,
            action: "Review frontend health and recent browser events"
          }
        ]
      : []),
    ...(poorWebVitals > 0
      ? [
          {
            severity: "warning",
            message: `${poorWebVitals} poor web vital event${poorWebVitals === 1 ? "" : "s"} in the last 24 hours`,
            action: "Check affected pages and recent deploy changes"
          }
        ]
      : []),
    ...(failedSyntheticChecks.length > 0
      ? [
          {
            severity: "critical",
            message: `${failedSyntheticChecks.length} synthetic check${failedSyntheticChecks.length === 1 ? "" : "s"} failed`,
            action: "Open synthetic checks and repair the broken customer path"
          }
        ]
      : [])
  ];

  return {
    status: {
      generatedAt: now.toISOString(),
      api: "online",
      database: databaseReady ? "ready" : "not-ready",
      databaseName: mongoose.connection.db?.databaseName,
      environment: config.NODE_ENV,
      appBaseUrl: config.APP_BASE_URL,
      emailJobWorkerEnabled: config.EMAIL_JOB_WORKER_ENABLED,
      automatedSchedulerEnabled: config.AUTOMATED_EMAILS_ENABLED,
      uptimeSeconds: metrics.uptimeSeconds,
      averageRequestDurationMs: metrics.averageRequestDurationMs,
      memoryRssMb: Math.round(metrics.memory.rss / 1024 / 1024)
    },
    release: {
      version: config.RELEASE_VERSION || process.env.npm_package_version || "local",
      commit: config.BUILD_COMMIT || process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA,
      buildTime: config.BUILD_TIME,
      nodeVersion: process.version
    },
    alerting: {
      enabled: config.ALERTING_ENABLED,
      recipient: config.ALERT_EMAIL_TO || config.BUSINESS_OWNER_EMAIL,
      checkIntervalMs: config.ALERT_CHECK_INTERVAL_MS,
      cooldownMs: config.ALERT_COOLDOWN_MS,
      lookbackMinutes: config.ALERT_LOOKBACK_MINUTES,
      recentStates: recentAlertStates.map((state) => ({
        _id: String(state._id),
        key: state.key,
        status: state.status,
        lastSentAt: state.lastSentAt?.toISOString(),
        lastResolvedAt: state.lastResolvedAt?.toISOString(),
        lastMessage: state.lastMessage,
        updatedAt: state.updatedAt.toISOString()
      }))
    },
    operationalControls: settings.operationalControls,
    traffic: {
      httpRequestsTotal: metrics.httpRequestsTotal,
      httpErrorsTotal: metrics.httpErrorsTotal,
      errorRate,
      recentRequests: recentRequestLogs.map(serializeRequestLog)
    },
    database: databaseStats,
    frontend: {
      eventsLast24Hours: browserCounts,
      poorWebVitals,
      recentEvents: recentBrowserEvents.map(serializeBrowserEvent)
    },
    syntheticChecks,
    trends: {
      requests: requestTrend.map((item) => ({
        bucket: item._id,
        requests: item.requests,
        errors: item.errors,
        averageDurationMs: Math.round(item.averageDurationMs || 0)
      })),
      bookings: bookingTrend.map((item) => ({ bucket: item._id, created: item.created })),
      emailFailures: emailFailureTrend.map((item) => ({ bucket: item._id, failed: item.failed }))
    },
    bookings: {
      total: totalBookings,
      open: bookingsByStatus.open || 0,
      resolved: bookingsByStatus.resolved || 0,
      canceled: bookingsByStatus.canceled || 0,
      today: bookingsToday,
      next24Hours: upcomingBookings24Hours,
      pastOpen: pastOpenBookings,
      last7Days: bookingsLast7Days,
      unverifiedOpen: unverifiedOpenBookings,
      recent: recentBookings.map(serializeMonitoringBooking)
    },
    emails: {
      queued: queuedEmails,
      sent: emailsByStatus.sent || 0,
      failed: emailsByStatus.failed || 0,
      staleProcessing: staleProcessingEmailJobs.length,
      oldPending: oldPendingEmailJobs,
      oldestPendingAgeMinutes,
      lastSentAt: lastSentEmailJob?.sentAt?.toISOString() || lastSentEmailJob?.updatedAt?.toISOString(),
      byStatus: emailsByStatus,
      recentJobs: recentEmailJobs.map(serializeEmailJob),
      failedJobs: failedEmailJobs.map(serializeEmailJob),
      staleJobs: staleProcessingEmailJobs.map(serializeEmailJob)
    },
    auditLogs: recentAuditLogs.map((log) => ({
      _id: String(log._id),
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      createdAt: log.createdAt.toISOString()
    })),
    incidents,
    recentErrors: recentSystemEvents.map(serializeSystemEvent)
  };
}
