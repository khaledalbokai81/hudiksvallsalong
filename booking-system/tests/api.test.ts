import mongoose from "mongoose";
import dotenv from "dotenv";
import { createHash } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

dotenv.config();

let app: Awaited<ReturnType<typeof import("../server/src/app.js").createApp>>;
let memoryServer: MongoMemoryServer | undefined;
const sendMailMock = vi.fn().mockResolvedValue({});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: sendMailMock
    })
  }
}));

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "4101";
  if (process.env.TEST_MONGODB_URL) {
    process.env.MONGODB_URL = process.env.TEST_MONGODB_URL;
  } else if (process.env.CI === "true") {
    process.env.MONGODB_URL = "mongodb://127.0.0.1:27017/booking_api_test";
  } else {
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: `booking_api_test_${Date.now()}`
      }
    });
    process.env.MONGODB_URL = memoryServer.getUri();
  }
  process.env.MONGODB_DB_NAME = `booking_api_test_${Date.now()}`;
  process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS = "30000";
  process.env.MONGODB_CONNECT_TIMEOUT_MS = "30000";
  process.env.APP_BASE_URL = "http://localhost:5173";
  process.env.CLIENT_ORIGIN = "http://localhost:5173";
  process.env.BUSINESS_TIMEZONE = "Europe/Helsinki";
  process.env.BUSINESS_OWNER_EMAIL = "owner@localhost.test";
  process.env.ALERTING_ENABLED = "true";
  process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-minimum-32-characters";
  process.env.ADMIN_SESSION_VERSION = "1";
  process.env.ADMIN_PASSWORD_HASH =
    "$2b$12$ZS3Qird.jdD13D/0Y.7KPe/DeFEpD/pRdODc9eapK7vciB1/u3rvG";
  process.env.MONITOR_SESSION_SECRET = "test-monitor-session-secret-minimum-32-characters";
  process.env.MONITOR_SESSION_VERSION = "1";
  process.env.MONITOR_PASSWORD_HASH =
    "$2b$12$ZS3Qird.jdD13D/0Y.7KPe/DeFEpD/pRdODc9eapK7vciB1/u3rvG";
  process.env.MONITOR_MFA_ENABLED = "false";
  process.env.MONITOR_MFA_CODE_TTL_MINUTES = "10";
  process.env.MONITOR_MFA_MAX_ATTEMPTS = "5";
  process.env.API_RATE_LIMIT_MAX = "10000";
  process.env.BOOKING_RATE_LIMIT_MAX = "10000";
  process.env.MAGIC_LINK_RATE_LIMIT_MAX = "10000";
  process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = "10000";
  process.env.ADMIN_MUTATION_RATE_LIMIT_MAX = "10000";

  const [{ createApp }, { connectDatabase }] = await Promise.all([
    import("../server/src/app.js"),
    import("../server/src/db.js")
  ]);

  await connectDatabase();
  app = createApp();
}, 60_000);

afterAll(async () => {
  if (mongoose.connection.db) {
    const { dropSafeTestDatabase } = await import("../server/src/db.js");
    await dropSafeTestDatabase();
  }

  await mongoose.disconnect();
  await memoryServer?.stop();
}, 60_000);

async function getAdminCsrf(agent: ReturnType<typeof request.agent>) {
  const response = await agent.get("/api/admin/csrf").expect(200);

  return response.body.csrfToken as string;
}

async function getMonitorCsrf(agent: ReturnType<typeof request.agent>) {
  const response = await agent.get("/api/monitor/csrf").expect(200);

  return response.body.csrfToken as string;
}

function futureBusinessDate(operatingDayOffset: number) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 30);

  let remainingOperatingDays = operatingDayOffset;

  while (true) {
    const weekday = date.getUTCDay();

    if (weekday >= 1 && weekday <= 5) {
      if (remainingOperatingDays === 0) {
        return date.toISOString().slice(0, 10);
      }

      remainingOperatingDays -= 1;
    }

    date.setUTCDate(date.getUTCDate() + 1);
  }
}

describe("API", () => {
  it("returns health status", async () => {
    await request(app).get("/api/health").expect(200, { status: "ok" });
    await request(app).get("/api/ready").expect(200, { status: "ready", database: "ok" });
  });

  it("runs the Mongo-backed global API rate limiter only for mutating requests", async () => {
    const { RateLimitCounter } = await import("../server/src/models/RateLimitCounter.js");

    await RateLimitCounter.deleteMany({});
    await request(app).get("/api/health").expect(200);
    await request(app).get("/api/ready").expect(200);
    await request(app).get("/api/services").expect(200);
    await expect(RateLimitCounter.countDocuments()).resolves.toBe(0);

    await request(app)
      .post("/api/telemetry/frontend")
      .send({
        type: "page_load",
        path: "/speed-test"
      })
      .expect(204);
    await expect(RateLimitCounter.countDocuments()).resolves.toBeGreaterThan(0);
  });

  it("redacts query strings from stored frontend telemetry paths", async () => {
    const { BrowserEvent } = await import("../server/src/models/BrowserEvent.js");
    const token = "secret-manage-token-0123456789abcdef".repeat(20);

    await BrowserEvent.deleteMany({});

    await request(app)
      .post("/api/telemetry/frontend")
      .send({
        type: "javascript_error",
        path: `/manage-booking?token=${token}&utm_source=customer-email#token=${token}`,
        message: "Synthetic telemetry redaction check"
      })
      .expect(204);

    const storedEvent = await BrowserEvent.findOne({ message: "Synthetic telemetry redaction check" })
      .select("path")
      .lean<{ path: string }>();

    expect(storedEvent?.path).toBe("/manage-booking");
    expect(storedEvent?.path).not.toContain("token");
    expect(storedEvent?.path).not.toContain("utm_source");
    expect(storedEvent?.path).not.toContain("secret-manage-token");
  });

  it("redacts query strings from API error responses and request logs", async () => {
    const { HttpRequestLog } = await import("../server/src/models/HttpRequestLog.js");

    await HttpRequestLog.deleteMany({});

    await request(app)
      .post("/api/not-real?token=secret-manage-token-0123456789abcdef&code=123456")
      .send({})
      .expect(404)
      .expect((response) => {
        expect(response.body.message).toBe("API route POST /api/not-real was not found");
        expect(JSON.stringify(response.body)).not.toContain("secret-manage-token");
        expect(JSON.stringify(response.body)).not.toContain("123456");
      });

    let storedLog: { path: string } | null = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      storedLog = await HttpRequestLog.findOne({ method: "POST", statusCode: 404 })
        .select("path")
        .lean<{ path: string }>();

      if (storedLog) {
        break;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });
    }

    expect(storedLog?.path).toBe("/api/not-real");
  });

  it("microcaches anonymous public API reads and bypasses cache for cookie requests", async () => {
    const { clearPublicApiMicrocache } = await import("../server/src/middleware/publicCache.js");

    clearPublicApiMicrocache("/services");

    const firstResponse = await request(app)
      .get("/api/services")
      .expect(200);

    expect(firstResponse.header["x-cache"]).toBe("MISS");
    expect(firstResponse.header["cache-control"]).toContain("public");

    const secondResponse = await request(app)
      .get("/api/services")
      .expect(200);

    expect(secondResponse.header["x-cache"]).toBe("HIT");

    const cookieResponse = await request(app)
      .get("/api/services")
      .set("Cookie", "admin_session=not-a-real-session")
      .expect(200);

    expect(cookieResponse.header["x-cache"]).toBeUndefined();
    expect(cookieResponse.header["cache-control"]).toBe("no-store");
  });

  it("starts and stops background schedulers through a separate worker manager", async () => {
    const stopAutomatedEmailScheduler = vi.fn();
    const stopEmailJobWorker = vi.fn();
    const stopMonitorAlertScheduler = vi.fn();
    const stopReliabilityCleanupScheduler = vi.fn();
    const loggerInfo = vi.fn();

    vi.resetModules();
    vi.doMock("../server/src/automatedEmails.js", () => ({
      startAutomatedEmailScheduler: () => stopAutomatedEmailScheduler
    }));
    vi.doMock("../server/src/emailJobs.js", () => ({
      startEmailJobWorker: () => stopEmailJobWorker
    }));
    vi.doMock("../server/src/alerting.js", () => ({
      startMonitorAlertScheduler: () => stopMonitorAlertScheduler
    }));
    vi.doMock("../server/src/reliabilityJobs.js", () => ({
      startReliabilityCleanupScheduler: () => stopReliabilityCleanupScheduler
    }));
    vi.doMock("../server/src/logger.js", () => ({
      logger: { info: loggerInfo }
    }));

    try {
      const { startBackgroundWorkers } = await import("../server/src/backgroundWorkers.js");
      const workers = startBackgroundWorkers();

      expect(loggerInfo).toHaveBeenCalledWith("Background workers started");

      workers.stop();

      expect(stopAutomatedEmailScheduler).toHaveBeenCalledTimes(1);
      expect(stopEmailJobWorker).toHaveBeenCalledTimes(1);
      expect(stopMonitorAlertScheduler).toHaveBeenCalledTimes(1);
      expect(stopReliabilityCleanupScheduler).toHaveBeenCalledTimes(1);
      expect(loggerInfo).toHaveBeenCalledWith("Background workers stopped");
    } finally {
      vi.doUnmock("../server/src/automatedEmails.js");
      vi.doUnmock("../server/src/emailJobs.js");
      vi.doUnmock("../server/src/alerting.js");
      vi.doUnmock("../server/src/reliabilityJobs.js");
      vi.doUnmock("../server/src/logger.js");
      vi.resetModules();
    }
  });

  it("creates default business settings and returns services", async () => {
    const response = await request(app).get("/api/services").expect(200);

    expect(response.body.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "standard-home",
          name: "Standard Service Visit"
        })
      ])
    );

    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "admin1234" }).expect(200);
    const settingsResponse = await agent.get("/api/business-settings").expect(200);

    expect(settingsResponse.body.settings.ownerEmail).toBe("owner@localhost.test");
  });

  it("protects admin booking data until login", async () => {
    await request(app).get("/api/bookings?status=all").expect(401);
    await request(app).get("/api/admin/metrics").expect(401);

    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "admin1234" }).expect(200);
    await agent.get("/api/bookings?status=all").expect(200);
    await agent.get("/api/admin/metrics").expect(200);
    await agent.get("/api/monitor/dashboard").expect(401);
    await agent.post("/api/admin/logout").expect(403);
    await agent
      .post("/api/admin/logout")
      .set("x-csrf-token", await getAdminCsrf(agent))
      .expect(204);
    await agent.get("/api/bookings?status=all").expect(401);
  });

  it("keeps monitoring separate from business owner admin access", async () => {
    await request(app).get("/api/monitor/dashboard").expect(401);

    const adminAgent = request.agent(app);
    await adminAgent.post("/api/admin/login").send({ password: "admin1234" }).expect(200);
    await adminAgent.get("/api/monitor/dashboard").expect(401);

    const monitorAgent = request.agent(app);
    await monitorAgent.post("/api/monitor/login").send({ password: "admin1234" }).expect(200);
    await monitorAgent.get("/api/bookings?status=all").expect(401);
    await monitorAgent
      .get("/api/monitor/dashboard")
      .expect(200)
      .expect((response) => {
        expect(response.body.status.api).toBe("online");
        expect(response.body.status.database).toBe("ready");
        expect(response.body.bookings).toEqual(
          expect.objectContaining({
            total: expect.any(Number),
            recent: expect.any(Array)
          })
        );
        expect(response.body.emails).toEqual(
          expect.objectContaining({
            queued: expect.any(Number),
            failed: expect.any(Number),
            staleJobs: expect.any(Array)
          })
        );
        expect(response.body.release).toEqual(
          expect.objectContaining({
            version: expect.any(String),
            nodeVersion: expect.any(String)
          })
        );
        expect(response.body.database).toEqual(
          expect.objectContaining({
            available: expect.any(Boolean),
            collections: expect.any(Number)
          })
        );
        expect(response.body.frontend).toEqual(
          expect.objectContaining({
            recentEvents: expect.any(Array)
          })
        );
        expect(response.body.syntheticChecks).toEqual(expect.any(Array));
        expect(response.body.trends.requests).toEqual(expect.any(Array));
        expect(response.body.recentErrors).toEqual(expect.any(Array));
      });

    await monitorAgent.post("/api/monitor/logout").expect(403);
    await monitorAgent
      .post("/api/monitor/logout")
      .set("x-csrf-token", await getMonitorCsrf(monitorAgent))
      .expect(204);
    await monitorAgent.get("/api/monitor/dashboard").expect(401);
  });

  it("requires an emailed code before creating a monitor session when MFA is enabled", async () => {
    try {
      process.env.MONITOR_MFA_ENABLED = "true";
      process.env.ALERT_EMAIL_TO = "operator@localhost.test";
      sendMailMock.mockClear();
      vi.resetModules();
      const { createApp } = await import("../server/src/app.js");
      const mfaApp = createApp();
      const monitorAgent = request.agent(mfaApp);
      const loginResponse = await monitorAgent
        .post("/api/monitor/login")
        .send({ password: "admin1234" })
        .expect(200);

      expect(loginResponse.body).toEqual(
        expect.objectContaining({
          authenticated: false,
          mfaRequired: true,
          challengeId: expect.any(String)
        })
      );
      await monitorAgent.get("/api/monitor/dashboard").expect(401);
      expect(sendMailMock).toHaveBeenCalledTimes(1);

      const sentText = String(sendMailMock.mock.calls[0]?.[0]?.text || "");
      const code = sentText.match(/Code: (\d{6})/)?.[1];

      expect(code).toMatch(/^\d{6}$/);

      await monitorAgent
        .post("/api/monitor/login/verify")
        .send({ challengeId: loginResponse.body.challengeId, code })
        .expect(200, { authenticated: true });
      await monitorAgent.get("/api/monitor/dashboard").expect(200);

      await request(mfaApp)
        .post("/api/monitor/login/verify")
        .send({ challengeId: loginResponse.body.challengeId, code })
        .expect(401);
    } finally {
      process.env.MONITOR_MFA_ENABLED = "false";
      process.env.ALERT_EMAIL_TO = "owner@localhost.test";
    }
  });

  it("does not expose monitor MFA codes when email delivery fails", async () => {
    try {
      process.env.MONITOR_MFA_ENABLED = "true";
      process.env.ALERT_EMAIL_TO = "operator@localhost.test";
      sendMailMock.mockRejectedValueOnce(new Error("SMTP unavailable"));
      vi.resetModules();
      const [{ createApp }, { MonitorLoginChallenge }] = await Promise.all([
        import("../server/src/app.js"),
        import("../server/src/models/MonitorLoginChallenge.js")
      ]);
      const mfaApp = createApp();
      const challengeCountBefore = await MonitorLoginChallenge.countDocuments();
      const response = await request(mfaApp)
        .post("/api/monitor/login")
        .send({ password: "admin1234" })
        .expect(503);

      expect(response.body).not.toHaveProperty("devCode");
      expect(response.body.error.code).toBe("MONITOR_MFA_EMAIL_FAILED");
      await expect(MonitorLoginChallenge.countDocuments()).resolves.toBe(challengeCountBefore);
    } finally {
      process.env.MONITOR_MFA_ENABLED = "false";
      process.env.ALERT_EMAIL_TO = "owner@localhost.test";
      sendMailMock.mockReset();
      sendMailMock.mockResolvedValue({});
    }
  });

  it("keeps admin authentication valid after app modules reload", async () => {
    const loginResponse = await request(app)
      .post("/api/admin/login")
      .send({ password: "admin1234" })
      .expect(200);
    const cookies = loginResponse.headers["set-cookie"];

    vi.resetModules();
    const { createApp } = await import("../server/src/app.js");
    const reloadedApp = createApp();

    await request(reloadedApp)
      .get("/api/admin/me")
      .set("Cookie", cookies)
      .expect(200, { authenticated: true });
  });

  it("revokes existing admin cookies when session version changes", async () => {
    const loginResponse = await request(app)
      .post("/api/admin/login")
      .send({ password: "admin1234" })
      .expect(200);
    const cookies = loginResponse.headers["set-cookie"];

    try {
      process.env.ADMIN_SESSION_VERSION = "2";
      vi.resetModules();
      const { createApp } = await import("../server/src/app.js");
      const reloadedApp = createApp();

      await request(reloadedApp)
        .get("/api/admin/me")
        .set("Cookie", cookies)
        .expect(200, { authenticated: false });
    } finally {
      process.env.ADMIN_SESSION_VERSION = "1";
      vi.resetModules();
    }
  });

  it("rejects a captured admin cookie after logout revokes the server session", async () => {
    const agent = request.agent(app);
    const loginResponse = await agent
      .post("/api/admin/login")
      .send({ password: "admin1234" })
      .expect(200);
    const capturedCookies = loginResponse.headers["set-cookie"];

    await agent
      .post("/api/admin/logout")
      .set("x-csrf-token", await getAdminCsrf(agent))
      .expect(204);

    await request(app)
      .get("/api/admin/me")
      .set("Cookie", capturedCookies)
      .expect(200, { authenticated: false });
  });

  it("applies an escalating backend cooldown after repeated admin login failures", async () => {
    const { LoginAttempt } = await import("../server/src/models/LoginAttempt.js");

    try {
      for (let index = 0; index < 5; index += 1) {
        await request(app)
          .post("/api/admin/login")
          .send({ password: "wrong-password" })
          .expect(401);
      }

      await request(app)
        .post("/api/admin/login")
        .send({ password: "admin1234" })
        .expect(429)
        .expect((response) => {
          expect(response.body.error.code).toBe("LOGIN_COOLDOWN_ACTIVE");
        });
    } finally {
      await LoginAttempt.deleteMany({});
    }
  }, 15_000);

  it("returns Helsinki availability labels and UTC slot values", async () => {
    const response = await request(app)
      .get("/api/availability?start=2026-06-08&days=1")
      .expect(200);
    const firstSlot = response.body.days[0].slots[0];

    expect(response.body.timezone).toBe("Europe/Helsinki");
    expect(response.body.days[0].dateLabel).toMatch(/(Jun.*8|8.*Jun)/);
    expect(firstSlot.timeLabel).toMatch(/8[:.]00.*10[:.]00/);
    expect(firstSlot.slotStartAt).toBe("2026-06-08T05:00:00.000Z");
  });

  it("advertises only non-overlapping service windows for a single local business", async () => {
    const response = await request(app)
      .get("/api/availability?start=2026-06-08&days=1&serviceId=standard-home")
      .expect(200);

    const labels = response.body.days[0].slots.map((slot: { timeLabel: string }) => slot.timeLabel);

    expect(labels).toHaveLength(2);
    expect(labels[0]).toMatch(/8[:.]00.*11[:.]00/);
    expect(labels[1]).toMatch(/12[:.]00.*(?:15|3)[:.]00/);
    expect(labels.some((label: string) => /^10[:.]00/.test(label))).toBe(false);
    expect(labels.some((label: string) => /^(?:14|2)[:.]00/.test(label))).toBe(false);

    await request(app)
      .post("/api/bookings")
      .send({
        name: "Hidden Overlap Customer",
        email: "hidden-overlap@example.com",
        phone: "+358401234588",
        serviceId: "standard-home",
        appointmentAt: "2026-06-08T07:00:00.000Z"
      })
      .expect(400)
      .expect((bookingResponse) => {
        expect(bookingResponse.body.error.code).toBe("UNSUPPORTED_APPOINTMENT_SLOT");
      });
  });

  it("creates a booking for an available slot and blocks admin-only availability changes without login", async () => {
    const date = futureBusinessDate(0);
    const availabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1`)
      .expect(200);
    const slotStartAt = availabilityResponse.body.days[0].slots[0].slotStartAt;

    await request(app)
      .patch("/api/availability")
      .send({ slotStartAt, status: "busy" })
      .expect(401);

    const bookingResponse = await request(app)
      .post("/api/bookings")
      .send({
        name: "API Test Customer",
        email: "api-test@example.com",
        phone: "+358401234567",
        serviceId: "standard-home",
        appointmentAt: slotStartAt,
        notes: "Created by automated API test"
      })
      .expect(201);

    expect(bookingResponse.body.booking.appointmentAt).toBe(slotStartAt);
    expect(bookingResponse.body.booking.emailVerified).toBe(false);
    expect(bookingResponse.body.booking).not.toHaveProperty("verificationTokenHash");

    const nextAvailabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1`)
      .expect(200);
    const bookedSlot = nextAvailabilityResponse.body.days[0].slots[0];

    expect(bookedSlot.status).toBe("booked");
    expect(bookedSlot.bookingId).toBe(bookingResponse.body.booking._id);
  });

  it("lets admin update business settings", async () => {
    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "admin1234" }).expect(200);
    const csrfToken = await getAdminCsrf(agent);

    const response = await agent
      .patch("/api/business-settings")
      .set("x-csrf-token", csrfToken)
      .send({
        businessName: "Helsinki Booking Co",
        ownerEmail: "owner@example.com",
        notificationEmailFromName: "Helsinki Leads",
        slotStartHours: [8, 10, 12, 14],
        slotDurationHours: 2
      })
      .expect(200);

    expect(response.body.settings.businessName).toBe("Helsinki Booking Co");
    expect(response.body.settings.ownerEmail).toBe("owner@example.com");
    expect(response.body.settings.notificationEmailFromName).toBe("Helsinki Leads");
    expect(response.body.settings.slotStartHours).toEqual([8, 10, 12, 14]);
  });

  it("backfills missing business settings fields", async () => {
    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "admin1234" }).expect(200);

    await mongoose.connection.db?.collection("businesssettings").updateOne(
      { key: "default" },
      {
        $unset: {
          ownerEmail: "",
          notificationEmailFromName: ""
        }
      }
    );

    const response = await agent.get("/api/business-settings").expect(200);

    expect(response.body.settings.ownerEmail).toBe("owner@localhost.test");
    expect(response.body.settings.notificationEmailFromName).toBe("Booking Notifications");
  });

  it("updates operational business settings and exposes only safe public fields", async () => {
    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "admin1234" }).expect(200);
    const csrfToken = await getAdminCsrf(agent);
    const original = (await agent.get("/api/business-settings").expect(200)).body.settings;
    const weeklySchedule = Array.from({ length: 7 }, (_, index) => ({
      weekday: index + 1,
      enabled: index < 5,
      openings: index < 5 ? [{ start: "09:00", end: "17:00" }] : [],
      breaks: index < 5 ? [{ start: "12:00", end: "13:00" }] : []
    }));

    try {
      const response = await agent
        .patch("/api/business-settings")
        .set("x-csrf-token", csrfToken)
        .send({
          ownerNotificationEmails: ["alerts@example.com", "manager@example.com"],
          publicContact: { email: "hello@example.com", phone: "+49 30 123456", address: "Example Street 1" },
          legal: { privacyContactEmail: "privacy@example.com", cancellationPolicy: "Give 24 hours notice." },
          weeklySchedule,
          blackoutDates: [{ id: "summer-break", startDate: "2026-08-01", endDate: "2026-08-07", reason: "Holiday" }],
          bookingRules: { minimumNoticeHours: 2, bookingWindowDays: 60, cancellationNoticeHours: 24, rescheduleNoticeHours: 12, requirePhone: true, requireNotes: false, confirmationMode: "request" }
        })
        .expect(200);

      expect(response.body.settings.weeklySchedule[0].breaks[0]).toEqual({ start: "12:00", end: "13:00" });
      expect(response.body.settings.ownerNotificationEmails).toHaveLength(2);

      const publicResponse = await request(app).get("/api/public-settings").expect(200);
      expect(publicResponse.body.settings.publicContact.email).toBe("hello@example.com");
      expect(publicResponse.body.settings.bookingRules.minimumNoticeHours).toBe(2);
      expect(publicResponse.body.settings).not.toHaveProperty("ownerNotificationEmails");
      expect(publicResponse.body.settings).not.toHaveProperty("ownerEmail");
      expect(publicResponse.body.settings).not.toHaveProperty("services");
    } finally {
      await agent
        .patch("/api/business-settings")
        .set("x-csrf-token", csrfToken)
        .send({
          ownerNotificationEmails: original.ownerNotificationEmails,
          publicContact: original.publicContact,
          legal: original.legal,
          weeklySchedule: original.weeklySchedule,
          blackoutDates: original.blackoutDates,
          bookingRules: original.bookingRules
        })
        .expect(200);
    }
  });

  it("enforces an admin-configured minimum booking notice", async () => {
    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "admin1234" }).expect(200);
    const csrfToken = await getAdminCsrf(agent);
    const original = (await agent.get("/api/business-settings").expect(200)).body.settings;
    const date = futureBusinessDate(0);
    const availability = await request(app).get(`/api/availability?start=${date}&days=1`).expect(200);
    const slotStartAt = availability.body.days[0].slots[0].slotStartAt;

    try {
      await agent
        .patch("/api/business-settings")
        .set("x-csrf-token", csrfToken)
        .send({ bookingRules: { ...original.bookingRules, minimumNoticeHours: 8760 } })
        .expect(200);

      await request(app)
        .post("/api/bookings")
        .send({ name: "Notice Test", email: "notice@example.com", phone: "+49 30 123456", serviceId: original.services[0].id, appointmentAt: slotStartAt })
        .expect(409)
        .expect((response) => expect(response.body.error.code).toBe("BOOKING_NOTICE_REQUIRED"));
    } finally {
      await agent
        .patch("/api/business-settings")
        .set("x-csrf-token", csrfToken)
        .send({ bookingRules: original.bookingRules })
        .expect(200);
    }
  });

  it("prevents duplicate active bookings for the same slot", async () => {
    const date = futureBusinessDate(1);
    const availabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1`)
      .expect(200);
    const slotStartAt = availabilityResponse.body.days[0].slots[0].slotStartAt;

    await request(app)
      .post("/api/bookings")
      .send({
        name: "First Slot Customer",
        email: "first-slot@example.com",
        phone: "+358401234568",
        serviceId: "standard-home",
        appointmentAt: slotStartAt,
        notes: "First duplicate slot test"
      })
      .expect(201);

    await request(app)
      .post("/api/bookings")
      .send({
        name: "Second Slot Customer",
        email: "second-slot@example.com",
        phone: "+358401234569",
        serviceId: "standard-home",
        appointmentAt: slotStartAt,
        notes: "Second duplicate slot test"
      })
      .expect(409);
  });

  it("releases expired unverified bookings before checking slot conflicts", async () => {
    const [{ Booking }, { getBusinessSettings }] = await Promise.all([
      import("../server/src/models/Booking.js"),
      import("../server/src/services.js")
    ]);
    const settings = await getBusinessSettings();
    const date = futureBusinessDate(11);
    const availabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1`)
      .expect(200);
    const slotStartAt = availabilityResponse.body.days[0].slots[0].slotStartAt;
    const appointmentAt = new Date(slotStartAt);
    const appointmentEndAt = new Date(
      appointmentAt.getTime() + settings.services[0].durationHours * 60 * 60 * 1000
    );
    const expiredBooking = await Booking.create({
      name: "Expired Unverified Customer",
      email: "expired-unverified@example.com",
      phone: "+358401234583",
      serviceId: settings.services[0].id,
      serviceName: settings.services[0].name,
      serviceDurationHours: settings.services[0].durationHours,
      appointmentAt,
      appointmentEndAt,
      occupiedSlotStarts: [appointmentAt],
      status: "open",
      emailVerified: false,
      verificationTokenHash: `expired-token-${Date.now()}`,
      emailVerificationExpiresAt: new Date(Date.now() - 60 * 1000)
    });

    await request(app)
      .get(`/api/availability?start=${date}&days=1`)
      .expect(200)
      .expect((response) => {
        expect(response.body.days[0].slots[0].status).toBe("open");
      });

    await request(app)
      .post("/api/bookings")
      .send({
        name: "Replacement Customer",
        email: "replacement@example.com",
        phone: "+358401234584",
        serviceId: settings.services[0].id,
        appointmentAt: slotStartAt
      })
      .expect(201);

    const releasedBooking = await Booking.findById(expiredBooking._id).lean();

    expect(releasedBooking?.status).toBe("canceled");
    expect(releasedBooking?.canceledAt).toBeDefined();
  });

  it("allows only one concurrent replacement for an expired unverified booking", async () => {
    const [{ Booking }, { getBusinessSettings }] = await Promise.all([
      import("../server/src/models/Booking.js"),
      import("../server/src/services.js")
    ]);
    const settings = await getBusinessSettings();
    const date = futureBusinessDate(12);
    const availabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1`)
      .expect(200);
    const slotStartAt = availabilityResponse.body.days[0].slots[0].slotStartAt;
    const appointmentAt = new Date(slotStartAt);
    const appointmentEndAt = new Date(
      appointmentAt.getTime() + settings.services[0].durationHours * 60 * 60 * 1000
    );

    await Booking.create({
      name: "Expired Race Customer",
      email: "expired-race@example.com",
      phone: "+358401234585",
      serviceId: settings.services[0].id,
      serviceName: settings.services[0].name,
      serviceDurationHours: settings.services[0].durationHours,
      appointmentAt,
      appointmentEndAt,
      occupiedSlotStarts: [appointmentAt],
      status: "open",
      emailVerified: false,
      verificationTokenHash: `expired-race-token-${Date.now()}`,
      emailVerificationExpiresAt: new Date(Date.now() - 60 * 1000)
    });

    const responses = await Promise.all([
      request(app)
        .post("/api/bookings")
        .send({
          name: "Replacement Race One",
          email: "replacement-race-one@example.com",
          phone: "+358401234586",
          serviceId: settings.services[0].id,
          appointmentAt: slotStartAt
        }),
      request(app)
        .post("/api/bookings")
        .send({
          name: "Replacement Race Two",
          email: "replacement-race-two@example.com",
          phone: "+358401234587",
          serviceId: settings.services[0].id,
          appointmentAt: slotStartAt
        })
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await Booking.countDocuments({ appointmentAt, status: "open" })).toBe(1);
  });

  it("paginates admin booking lists", async () => {
    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "admin1234" }).expect(200);

    const response = await agent.get("/api/bookings?status=all&page=1&limit=1").expect(200);

    expect(response.body.bookings).toHaveLength(1);
    expect(response.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 1
      })
    );
    expect(response.body.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it("rejects appointment times that are not exact advertised slots", async () => {
    const date = futureBusinessDate(2);
    const availabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1`)
      .expect(200);
    const slotStartAt = availabilityResponse.body.days[0].slots[0].slotStartAt;
    const shiftedSlotStartAt = new Date(
      new Date(slotStartAt).getTime() + 30 * 60 * 1000
    ).toISOString();

    await request(app)
      .post("/api/bookings")
      .send({
        name: "Shifted Slot Customer",
        email: "shifted-slot@example.com",
        phone: "+358401234572",
        serviceId: "standard-home",
        appointmentAt: shiftedSlotStartAt,
        notes: "Non-exact slot test"
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVALID_APPOINTMENT_TIME");
      });
  });

  it("blocks bookings that overlap a longer service duration", async () => {
    const date = futureBusinessDate(3);
    const availabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1&serviceId=deep-clean`)
      .expect(200);
    const overlappingAvailabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1&serviceId=standard-home`)
      .expect(200);
    const firstSlot = availabilityResponse.body.days[0].slots[0].slotStartAt;
    const overlappingSlot = overlappingAvailabilityResponse.body.days[0].slots[1].slotStartAt;

    const bookingResponse = await request(app)
      .post("/api/bookings")
      .send({
        name: "Long Service Customer",
        email: "long-service@example.com",
        phone: "+358401234573",
        serviceId: "deep-clean",
        appointmentAt: firstSlot,
        notes: "Long service overlap test"
      })
      .expect(201);

    expect(bookingResponse.body.booking.serviceDurationHours).toBe(6);
    expect(bookingResponse.body.booking.appointmentEndAt).toBeDefined();

    await request(app)
      .post("/api/bookings")
      .send({
        name: "Overlap Customer",
        email: "overlap@example.com",
        phone: "+358401234574",
        serviceId: "standard-home",
        appointmentAt: overlappingSlot,
        notes: "Should overlap the long service"
      })
      .expect(409);

    const standardAvailabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1&serviceId=standard-home`)
      .expect(200);

    expect(standardAvailabilityResponse.body.days[0].slots[1].status).toBe("booked");
  });

  it("prevents concurrent overlapping bookings with different start times", async () => {
    const date = futureBusinessDate(4);
    const availabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1&serviceId=deep-clean`)
      .expect(200);
    const overlappingAvailabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1&serviceId=standard-home`)
      .expect(200);
    const firstSlot = availabilityResponse.body.days[0].slots[0].slotStartAt;
    const overlappingSlot = overlappingAvailabilityResponse.body.days[0].slots[1].slotStartAt;

    const responses = await Promise.all([
      request(app)
        .post("/api/bookings")
        .send({
          name: "Concurrent Long Customer",
          email: "concurrent-long@example.com",
          phone: "+358401234577",
          serviceId: "deep-clean",
          appointmentAt: firstSlot,
          notes: "Concurrent long service"
        }),
      request(app)
        .post("/api/bookings")
        .send({
          name: "Concurrent Overlap Customer",
          email: "concurrent-overlap@example.com",
          phone: "+358401234578",
          serviceId: "standard-home",
          appointmentAt: overlappingSlot,
          notes: "Concurrent overlapping service"
        })
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(
      responses.find((response) => response.status === 409)?.body.error.code
    ).toBe("SLOT_BOOKED");
  });

  it("blocks long bookings that overlap admin busy slots", async () => {
    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "admin1234" }).expect(200);
    const csrfToken = await getAdminCsrf(agent);

    const date = futureBusinessDate(5);
    const availabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1&serviceId=deep-clean`)
      .expect(200);
    const overlappingAvailabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1&serviceId=standard-home`)
      .expect(200);
    const firstSlot = availabilityResponse.body.days[0].slots[0].slotStartAt;
    const blockedInsideLongService = overlappingAvailabilityResponse.body.days[0].slots[1].slotStartAt;

    await agent
      .patch("/api/availability")
      .set("x-csrf-token", csrfToken)
      .send({ slotStartAt: blockedInsideLongService, status: "busy" })
      .expect(200);

    const updatedAvailabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1&serviceId=deep-clean`)
      .expect(200);

    expect(updatedAvailabilityResponse.body.days[0].slots[0].status).toBe("busy");

    await request(app)
      .post("/api/bookings")
      .send({
        name: "Busy Overlap Customer",
        email: "busy-overlap@example.com",
        phone: "+358401234579",
        serviceId: "deep-clean",
        appointmentAt: firstSlot,
        notes: "Should overlap an admin busy slot"
      })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("SLOT_BUSY");
      });
  });

  it("treats legacy bookings without status as active for slot availability", async () => {
    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "admin1234" }).expect(200);
    const csrfToken = await getAdminCsrf(agent);
    const date = futureBusinessDate(6);
    const availabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1`)
      .set("Cookie", "cache_bypass=1")
      .expect(200);
    const slotStartAt = availabilityResponse.body.days[0].slots[0].slotStartAt;

    await mongoose.connection.db?.collection("bookings").insertOne({
      name: "Legacy Slot Customer",
      email: "legacy-slot@example.com",
      phone: "+358401234570",
      serviceId: "standard-home",
      serviceName: "Standard Appointment",
      appointmentAt: new Date(slotStartAt),
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const bookedAvailabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1`)
      .set("Cookie", "cache_bypass=1")
      .expect(200);
    const bookedSlot = bookedAvailabilityResponse.body.days
      .flatMap((day: { slots: Array<{ slotStartAt: string; status: string }> }) => day.slots)
      .find((slot: { slotStartAt: string }) => slot.slotStartAt === slotStartAt);

    expect(bookedSlot?.status).toBe("booked");

    await request(app)
      .post("/api/bookings")
      .send({
        name: "Blocked Legacy Slot Customer",
        email: "blocked-legacy-slot@example.com",
        phone: "+358401234571",
        serviceId: "standard-home",
        appointmentAt: slotStartAt,
        notes: "Legacy slot duplicate test"
      })
      .expect(409);

    await agent
      .patch("/api/availability")
      .set("x-csrf-token", csrfToken)
      .send({ slotStartAt, status: "busy" })
      .expect(409);
  });

  it("lets admin mark open availability busy after login", async () => {
    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "admin1234" }).expect(200);
    const csrfToken = await getAdminCsrf(agent);
    const date = futureBusinessDate(7);
    const availabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1`)
      .expect(200);
    const slotStartAt = availabilityResponse.body.days[0].slots[0].slotStartAt;

    const response = await agent
      .patch("/api/availability")
      .set("x-csrf-token", csrfToken)
      .send({ slotStartAt, status: "busy" })
      .expect(200);

    expect(response.body.days[0].slots[0].status).toBe("busy");
  });

  it("updates a day of availability in one validated bulk request", async () => {
    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "admin1234" }).expect(200);
    const csrfToken = await getAdminCsrf(agent);
    const date = futureBusinessDate(8);
    const availabilityResponse = await request(app)
      .get(`/api/availability?start=${date}&days=1`)
      .expect(200);
    const slotStartAts = availabilityResponse.body.days[0].slots
      .slice(0, 2)
      .map((slot: { slotStartAt: string }) => slot.slotStartAt);

    await agent
      .patch("/api/availability/bulk")
      .set("x-csrf-token", csrfToken)
      .send({ slotStartAts, status: "busy" })
      .expect(200)
      .expect((response) => expect(response.body.updated).toBe(slotStartAts.length));

    const updated = await request(app).get(`/api/availability?start=${date}&days=1`).expect(200);
    expect(updated.body.days[0].slots.slice(0, 2).every((slot: { status: string }) => slot.status === "busy")).toBe(true);
  });

  it("lets monitor pause bookings, show operational status, and collect frontend telemetry", async () => {
    const monitorAgent = request.agent(app);
    await monitorAgent.post("/api/monitor/login").send({ password: "admin1234" }).expect(200);
    const csrfToken = await getMonitorCsrf(monitorAgent);

    await request(app)
      .post("/api/telemetry/frontend")
      .send({
        type: "javascript_error",
        path: "/booking",
        message: "Synthetic browser error"
      })
      .expect(204);

    await monitorAgent
      .patch("/api/monitor/operational-controls")
      .set("x-csrf-token", csrfToken)
      .send({
        bookingsPaused: true,
        bookingPauseMessage: "Booking pause test",
        maintenanceBannerEnabled: true,
        maintenanceBannerMessage: "Maintenance banner test"
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.operationalControls.bookingsPaused).toBe(true);
      });

    await request(app)
      .get("/api/operational-status")
      .expect(200)
      .expect((response) => {
        expect(response.body.operationalControls.bookingsPaused).toBe(true);
        expect(response.body.operationalControls.maintenanceBannerEnabled).toBe(true);
      });

    const availabilityResponse = await request(app)
      .get(`/api/availability?start=${futureBusinessDate(8)}&days=1`)
      .expect(200);

    await request(app)
      .post("/api/bookings")
      .send({
        name: "Paused Booking Customer",
        email: "paused-booking@example.com",
        phone: "+358401234581",
        serviceId: "standard-home",
        appointmentAt: availabilityResponse.body.days[0].slots[0].slotStartAt
      })
      .expect(503)
      .expect((response) => {
        expect(response.body.error.code).toBe("BOOKINGS_PAUSED");
      });

    await monitorAgent
      .get("/api/monitor/dashboard")
      .expect(200)
      .expect((response) => {
        expect(response.body.frontend.eventsLast24Hours.javascript_error).toBeGreaterThanOrEqual(1);
        expect(response.body.operationalControls.bookingsPaused).toBe(true);
      });

    await monitorAgent
      .patch("/api/monitor/operational-controls")
      .set("x-csrf-token", csrfToken)
      .send({
        bookingsPaused: false,
        maintenanceBannerEnabled: false
      })
      .expect(200);
  });

  it("sends monitor alert emails for active incidents with cooldown", async () => {
    sendMailMock.mockClear();
    const [{ EmailJob }, { processMonitorAlerts }] = await Promise.all([
      import("../server/src/models/EmailJob.js"),
      import("../server/src/alerting.js")
    ]);

    await EmailJob.create({
      type: "ownerBookingNotice",
      status: "failed",
      idempotencyKey: `alert-failed-email:${Date.now()}`,
      payload: {
        to: "owner@localhost.test",
        businessName: "Service Booking Business",
        customerName: "Alert Customer",
        customerEmail: "alert@example.com",
        customerPhone: "+358401234582",
        serviceName: "Standard Service Visit",
        appointmentLabel: "Test appointment",
        adminUrl: "http://localhost:5173/admin"
      },
      runAt: new Date(),
      attempts: 5,
      maxAttempts: 5,
      lastError: "Alert test failure"
    });

    const firstSentAlerts = await processMonitorAlerts(new Date("2026-06-21T08:00:00.000Z"));
    const firstAlertSubjects = sendMailMock.mock.calls.map((call) => call[0]?.subject);

    expect(firstSentAlerts).toContain("failed-email-jobs");
    expect(firstAlertSubjects).toContain("[CRITICAL] Failed email jobs detected");

    sendMailMock.mockClear();
    const secondSentAlerts = await processMonitorAlerts(new Date("2026-06-21T08:05:00.000Z"));

    expect(secondSentAlerts).not.toContain("failed-email-jobs");
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("uses scheduler leases so another active owner cannot run the same scheduler", async () => {
    const [{ SchedulerLease }, { runWithSchedulerLease }] = await Promise.all([
      import("../server/src/models/SchedulerLease.js"),
      import("../server/src/schedulerLease.js")
    ]);
    const key = `test-lease-${Date.now()}`;
    let runs = 0;

    await SchedulerLease.create({
      key,
      ownerId: "other-process",
      expiresAt: new Date(Date.now() + 60_000),
      heartbeatAt: new Date()
    });

    const blocked = await runWithSchedulerLease(key, 60_000, async () => {
      runs += 1;
    });

    expect(blocked.ran).toBe(false);
    expect(runs).toBe(0);

    await SchedulerLease.updateOne(
      { key },
      { $set: { expiresAt: new Date(Date.now() - 60_000) } }
    );

    const acquired = await runWithSchedulerLease(key, 60_000, async () => {
      runs += 1;
    });

    expect(acquired.ran).toBe(true);
    expect(runs).toBe(1);
  });

  it("supports magic-link manage, edit, and cancel", async () => {
    const token = "test-manage-token-0123456789abcdef";
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const [{ Booking }, { getBusinessSettings }] = await Promise.all([
      import("../server/src/models/Booking.js"),
      import("../server/src/services.js")
    ]);
    const settings = await getBusinessSettings();
    const firstDate = futureBusinessDate(9);
    const secondDate = futureBusinessDate(13);
    const availabilityResponse = await request(app)
      .get(`/api/availability?start=${firstDate}&days=1&serviceId=${settings.services[0].id}`)
      .expect(200);
    const deepCleanAvailabilityResponse = await request(app)
      .get(`/api/availability?start=${secondDate}&days=1&serviceId=${settings.services[1].id}`)
      .expect(200);
    const firstSlot = availabilityResponse.body.days[0].slots[0].slotStartAt;
    const secondSlot = deepCleanAvailabilityResponse.body.days[0].slots[0].slotStartAt;

    const booking = await Booking.create({
      name: "Magic Test",
      email: "magic-test@example.com",
      phone: "+358401234570",
      serviceId: settings.services[0].id,
      serviceName: settings.services[0].name,
      appointmentAt: new Date(firstSlot),
      status: "open",
      emailVerified: false,
      verificationTokenHash: tokenHash,
      emailVerificationExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      notes: "Magic link test"
    });

    const manageResponse = await request(app)
      .post("/api/bookings/manage")
      .send({ token })
      .expect(200);

    expect(manageResponse.body.booking._id).toBe(String(booking._id));
    expect(manageResponse.body.booking.emailVerified).toBe(true);
    expect(manageResponse.body.booking).not.toHaveProperty("verificationTokenHash");

    const editResponse = await request(app)
      .patch("/api/bookings/manage")
      .send({
        token,
        name: "Magic Test Updated",
        phone: "+358401234571",
        serviceId: settings.services[1].id,
        appointmentAt: secondSlot,
        notes: "Updated by magic link"
      })
      .expect(200);

    expect(editResponse.body.booking.name).toBe("Magic Test Updated");
    expect(editResponse.body.booking.appointmentAt).toBe(secondSlot);
    expect(editResponse.body.booking).not.toHaveProperty("verificationTokenHash");

    const cancelResponse = await request(app)
      .patch("/api/bookings/manage/cancel")
      .send({ token })
      .expect(200);

    expect(cancelResponse.body.booking.status).toBe("canceled");
  });

  it("uses a generic public error for invalid magic links", async () => {
    await request(app)
      .post("/api/bookings/manage")
      .send({ token: "missing-manage-token-0123456789abcdef" })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVALID_BOOKING_MAGIC_LINK");
      });
  });

  it("sends customer and owner emails when a booking is created", async () => {
    sendMailMock.mockClear();
    const [{ EmailJob }, { processDueEmailJobs }] = await Promise.all([
      import("../server/src/models/EmailJob.js"),
      import("../server/src/emailJobs.js")
    ]);
    const availabilityResponse = await request(app)
      .get(`/api/availability?start=${futureBusinessDate(10)}&days=1`)
      .expect(200);
    const slotStartAt = availabilityResponse.body.days[0].slots[0].slotStartAt;

    await request(app)
      .post("/api/bookings")
      .send({
        name: "Email Notice Customer",
        email: "email-notice@example.com",
        phone: "+358401234572",
        serviceId: "standard-home",
        appointmentAt: slotStartAt,
        notes: "Email notice test"
      })
      .expect(201);

    await expect(EmailJob.countDocuments({ status: "pending" })).resolves.toBeGreaterThanOrEqual(2);
    await processDueEmailJobs();

    const subjects = sendMailMock.mock.calls.map((call) => call[0]?.subject);

    expect(subjects).toContain("Manage your booking request");
    expect(subjects).toContain("New booking request from Email Notice Customer");
  });

  it("lets monitor retry failed email jobs, unlock stale jobs, and send a test email", async () => {
    sendMailMock.mockClear();
    const { EmailJob } = await import("../server/src/models/EmailJob.js");
    const monitorAgent = request.agent(app);
    await monitorAgent.post("/api/monitor/login").send({ password: "admin1234" }).expect(200);
    const csrfToken = await getMonitorCsrf(monitorAgent);

    const failedJob = await EmailJob.create({
      type: "ownerBookingNotice",
      status: "failed",
      idempotencyKey: `failed-monitor-test:${Date.now()}`,
      payload: {
        to: "owner@localhost.test",
        businessName: "Service Booking Business",
        customerName: "Failed Email Customer",
        customerEmail: "failed-email@example.com",
        customerPhone: "+358401234580",
        serviceName: "Standard Service Visit",
        appointmentLabel: "Test appointment",
        adminUrl: "http://localhost:5173/admin"
      },
      runAt: new Date(),
      attempts: 2,
      maxAttempts: 5,
      lastError: "SMTP test failure"
    });
    const staleJob = await EmailJob.create({
      type: "bookingVerification",
      status: "processing",
      idempotencyKey: `stale-monitor-test:${Date.now()}`,
      payload: {
        to: "stale@example.com",
        name: "Stale Customer",
        serviceName: "Standard Service Visit",
        manageUrl: "http://localhost:5173/manage-booking?token=test"
      },
      runAt: new Date(Date.now() - 60 * 60 * 1000),
      lockedUntil: new Date(Date.now() - 60 * 1000),
      attempts: 1,
      maxAttempts: 5
    });

    await monitorAgent
      .post(`/api/monitor/email-jobs/${failedJob._id}/retry`)
      .set("x-csrf-token", csrfToken)
      .expect(200)
      .expect((response) => {
        expect(response.body.job.status).toBe("pending");
        expect(response.body.job.attempts).toBe(0);
      });

    await monitorAgent
      .post(`/api/monitor/email-jobs/${staleJob._id}/unlock`)
      .set("x-csrf-token", csrfToken)
      .expect(200)
      .expect((response) => {
        expect(response.body.job.status).toBe("pending");
        expect(response.body.job.lockedUntil).toBeUndefined();
      });

    await monitorAgent
      .post("/api/monitor/test-email")
      .set("x-csrf-token", csrfToken)
      .send({ to: "monitor@example.com" })
      .expect(200)
      .expect((response) => {
        expect(response.body.sent).toBe(true);
        expect(response.body.to).toBe("monitor@example.com");
      });

    expect(sendMailMock.mock.calls.at(-1)?.[0]?.subject).toBe("Monitoring test email");
  });

  it("repairs stale processing email jobs during reliability cleanup", async () => {
    const [{ EmailJob }, { processReliabilityCleanup }] = await Promise.all([
      import("../server/src/models/EmailJob.js"),
      import("../server/src/reliabilityJobs.js")
    ]);
    const now = new Date();
    const retryableJob = await EmailJob.create({
      type: "bookingVerification",
      status: "processing",
      idempotencyKey: `stale-retryable:${Date.now()}`,
      payload: {
        to: "retryable@example.com",
        name: "Retryable Customer",
        serviceName: "Standard Service Visit",
        manageUrl: "http://localhost:5173/manage-booking?token=test"
      },
      runAt: now,
      lockedUntil: new Date(now.getTime() - 60 * 1000),
      attempts: 1,
      maxAttempts: 5
    });
    const maxedJob = await EmailJob.create({
      type: "bookingVerification",
      status: "processing",
      idempotencyKey: `stale-maxed:${Date.now()}`,
      payload: {
        to: "maxed@example.com",
        name: "Maxed Customer",
        serviceName: "Standard Service Visit",
        manageUrl: "http://localhost:5173/manage-booking?token=test"
      },
      runAt: now,
      lockedUntil: new Date(now.getTime() - 60 * 1000),
      attempts: 5,
      maxAttempts: 5
    });
    const alreadySentJob = await EmailJob.create({
      type: "bookingVerification",
      status: "sent",
      idempotencyKey: `stale-already-sent:${Date.now()}`,
      payload: {
        to: "already-sent@example.com",
        name: "Already Sent Customer",
        serviceName: "Standard Service Visit",
        manageUrl: "http://localhost:5173/manage-booking?token=test"
      },
      runAt: now,
      lockedUntil: new Date(now.getTime() - 60 * 1000),
      attempts: 5,
      maxAttempts: 5,
      sentAt: now
    });

    const result = await processReliabilityCleanup(now);

    expect(result.staleEmailJobs.retryable).toBeGreaterThanOrEqual(1);
    expect(result.staleEmailJobs.failed).toBeGreaterThanOrEqual(1);

    const repairedRetryableJob = await EmailJob.findById(retryableJob._id).lean();
    const repairedMaxedJob = await EmailJob.findById(maxedJob._id).lean();
    const untouchedSentJob = await EmailJob.findById(alreadySentJob._id).lean();

    expect(repairedRetryableJob?.status).toBe("pending");
    expect(repairedRetryableJob?.lockedUntil).toBeUndefined();
    expect(repairedMaxedJob?.status).toBe("failed");
    expect(repairedMaxedJob?.lockedUntil).toBeUndefined();
    expect(untouchedSentJob?.status).toBe("sent");
    expect(untouchedSentJob?.sentAt).toBeDefined();
  });

  it("sends due reminder and review emails once", async () => {
    sendMailMock.mockClear();
    const [{ Booking }, { getBusinessSettings }, { processDueAutomatedBookingEmails }] =
      await Promise.all([
        import("../server/src/models/Booking.js"),
        import("../server/src/services.js"),
        import("../server/src/automatedEmails.js")
      ]);
    const settings = await getBusinessSettings();
    const now = new Date();
    const reminderAppointmentAt = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const reviewAppointmentAt = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const reviewAppointmentEndAt = new Date(now.getTime() - 3 * 60 * 60 * 1000);

    const reminderBooking = await Booking.create({
      name: "Reminder Customer",
      email: "reminder@example.com",
      phone: "+358401234575",
      serviceId: settings.services[0].id,
      serviceName: settings.services[0].name,
      serviceDurationHours: settings.services[0].durationHours,
      appointmentAt: reminderAppointmentAt,
      appointmentEndAt: new Date(
        reminderAppointmentAt.getTime() + settings.services[0].durationHours * 60 * 60 * 1000
      ),
      status: "open",
      emailVerified: true,
      emailVerifiedAt: now
    });
    const reviewBooking = await Booking.create({
      name: "Review Customer",
      email: "review@example.com",
      phone: "+358401234576",
      serviceId: settings.services[0].id,
      serviceName: settings.services[0].name,
      serviceDurationHours: settings.services[0].durationHours,
      appointmentAt: reviewAppointmentAt,
      appointmentEndAt: reviewAppointmentEndAt,
      status: "resolved",
      emailVerified: true,
      emailVerifiedAt: now,
      resolvedAt: reviewAppointmentEndAt
    });

    await processDueAutomatedBookingEmails(now);

    const subjects = sendMailMock.mock.calls.map((call) => call[0]?.subject);

    expect(subjects).toContain(
      `Reminder: your ${settings.services[0].name} appointment is coming up`
    );
    expect(subjects).toContain(`How was your ${settings.services[0].name}?`);

    const updatedReminderBooking = await Booking.findById(reminderBooking._id).lean();
    const updatedReviewBooking = await Booking.findById(reviewBooking._id).lean();

    expect(updatedReminderBooking?.reminderEmailSentAt).toBeDefined();
    expect(updatedReviewBooking?.reviewEmailSentAt).toBeDefined();

    sendMailMock.mockClear();
    await processDueAutomatedBookingEmails(now);

    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("sends each configured reminder stage exactly once", async () => {
    const [{ Booking }, { updateBusinessSettings }, { processDueAutomatedBookingEmails }] =
      await Promise.all([
        import("../server/src/models/Booking.js"),
        import("../server/src/services.js"),
        import("../server/src/automatedEmails.js")
      ]);
    const settings = await updateBusinessSettings({
      emailAutomations: {
        ...(await import("../server/src/services.js")).defaultBusinessSettings.emailAutomations,
        reminderLeadHours: [48, 24, 2]
      }
    });
    const now = new Date();
    const appointmentAt = new Date(now.getTime() + 47 * 60 * 60 * 1000);
    const email = `staged-reminder-${Date.now()}@example.com`;
    const booking = await Booking.create({
      name: "Staged Reminder Customer",
      email,
      phone: "+358401234590",
      serviceId: settings.services[0].id,
      serviceName: settings.services[0].name,
      serviceDurationHours: settings.services[0].durationHours,
      appointmentAt,
      appointmentEndAt: new Date(
        appointmentAt.getTime() + settings.services[0].durationHours * 60 * 60 * 1000
      ),
      occupiedSlotStarts: [appointmentAt],
      status: "open",
      emailVerified: true,
      emailVerifiedAt: now
    });

    for (const offsetHours of [0, 25, 46]) {
      sendMailMock.mockClear();
      const runAt = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);
      await processDueAutomatedBookingEmails(runAt);
      expect(sendMailMock.mock.calls.filter((call) => call[0]?.to === email)).toHaveLength(1);
      await processDueAutomatedBookingEmails(runAt);
      expect(sendMailMock.mock.calls.filter((call) => call[0]?.to === email)).toHaveLength(1);
    }

    const updated = await Booking.findById(booking._id).lean();
    expect(updated?.reminderEmailStagesSent?.sort((a, b) => b - a)).toEqual([48, 24, 2]);
  });

  it("deduplicates waitlist joins and securely converts the first notified customer", async () => {
    sendMailMock.mockClear();
    const [{ WaitlistEntry }, { processDueEmailJobs }] = await Promise.all([
      import("../server/src/models/WaitlistEntry.js"),
      import("../server/src/emailJobs.js")
    ]);
    const availabilityResponse = await request(app)
      .get(`/api/availability?start=${futureBusinessDate(14)}&days=1&serviceId=standard-home`)
      .expect(200);
    const slotStartAt = availabilityResponse.body.days[0].slots[0].slotStartAt as string;
    const occupied = await request(app)
      .post("/api/bookings")
      .send({
        name: "Waitlist Slot Owner",
        email: `slot-owner-${Date.now()}@example.com`,
        phone: "+358401234591",
        serviceId: "standard-home",
        appointmentAt: slotStartAt
      })
      .expect(201);
    const waitlistInput = {
      name: "Waitlist Customer",
      email: `waitlist-${Date.now()}@example.com`,
      phone: "+358401234592",
      serviceId: "standard-home",
      slotStartAt
    };
    const joins = await Promise.all([
      request(app).post("/api/waitlist").send(waitlistInput),
      request(app).post("/api/waitlist").send(waitlistInput)
    ]);

    expect(joins.map((response) => response.status).sort()).toEqual([200, 201]);
    await expect(
      WaitlistEntry.countDocuments({ email: waitlistInput.email, slotStartAt })
    ).resolves.toBe(1);
    await request(app)
      .get("/api/waitlist/offer?token=invalid-waitlist-token-0123456789abcdef")
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVALID_WAITLIST_OFFER");
      });

    const adminAgent = request.agent(app);
    await adminAgent.post("/api/admin/login").send({ password: "admin1234" }).expect(200);
    await adminAgent
      .patch(`/api/bookings/${occupied.body.booking._id}/resolve`)
      .set("x-csrf-token", await getAdminCsrf(adminAgent))
      .expect(200);
    await processDueEmailJobs();

    const availableMessage = sendMailMock.mock.calls
      .map((call) => call[0])
      .find((message) => message?.subject?.startsWith("A waitlisted time is available"));
    const bookingUrl = String(availableMessage?.text)
      .split(/\s+/)
      .find((value) => value.startsWith("http://localhost:5173/booking?waitlist="));
    expect(bookingUrl).toBeDefined();
    const token = new URL(bookingUrl as string).searchParams.get("waitlist") as string;

    await request(app)
      .get(`/api/waitlist/offer?token=${encodeURIComponent(token)}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.offer.email).toBe(waitlistInput.email);
        expect(response.body.offer.slotStartAt).toBe(slotStartAt);
      });
    await request(app)
      .post("/api/bookings")
      .send({ ...waitlistInput, email: "wrong-customer@example.com", appointmentAt: slotStartAt, waitlistToken: token })
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe("WAITLIST_OFFER_MISMATCH");
      });
    await request(app)
      .post("/api/bookings")
      .send({ ...waitlistInput, appointmentAt: slotStartAt, waitlistToken: token })
      .expect(201);

    const converted = await WaitlistEntry.findOne({ email: waitlistInput.email }).lean();
    expect(converted?.status).toBe("converted");
    expect(converted?.offerTokenHash).toBeUndefined();
    expect(converted?.activeKey).toBeUndefined();
  });

  it("expires a missed waitlist offer and advances to the next customer", async () => {
    const [{ WaitlistEntry }, { notifyNextWaitlistEntry }] = await Promise.all([
      import("../server/src/models/WaitlistEntry.js"),
      import("../server/src/waitlist.js")
    ]);
    const availabilityResponse = await request(app)
      .get(`/api/availability?start=${futureBusinessDate(18)}&days=1&serviceId=standard-home`)
      .expect(200);
    const slot = availabilityResponse.body.days[0].slots.find(
      (candidate: { status: string }) => candidate.status === "open"
    );
    const now = new Date();
    const shared = {
      phone: "+358401234593",
      serviceId: "standard-home",
      serviceName: "Standard Service Visit",
      serviceDurationHours: 3,
      slotStartAt: new Date(slot.slotStartAt),
      slotEndAt: new Date(slot.slotEndAt)
    };
    const first = await WaitlistEntry.create({
      ...shared,
      name: "Expired Waitlist Customer",
      email: `expired-waitlist-${Date.now()}@example.com`,
      status: "notified",
      activeKey: `expired-active-${Date.now()}`,
      offerTokenHash: createHash("sha256").update(`expired-${Date.now()}`).digest("hex"),
      offerExpiresAt: new Date(now.getTime() - 60_000),
      notifiedAt: new Date(now.getTime() - 120_000)
    });
    const second = await WaitlistEntry.create({
      ...shared,
      name: "Next Waitlist Customer",
      email: `next-waitlist-${Date.now()}@example.com`,
      status: "waiting",
      activeKey: `next-active-${Date.now()}`
    });

    const results = await Promise.all([
      notifyNextWaitlistEntry(new Date(slot.slotStartAt), now),
      notifyNextWaitlistEntry(new Date(slot.slotStartAt), now)
    ]);
    const [expired, notified] = await Promise.all([
      WaitlistEntry.findById(first._id).lean(),
      WaitlistEntry.findById(second._id).lean()
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(expired?.status).toBe("expired");
    expect(expired?.offerTokenHash).toBeUndefined();
    expect(notified?.status).toBe("notified");
    expect(notified?.offerTokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
