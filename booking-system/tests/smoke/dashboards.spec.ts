import { expect, test, type Page } from "@playwright/test";

const booking = {
  _id: "booking-001",
  name: "Ada Customer",
  email: "ada@example.com",
  phone: "+1 555 0100",
  serviceId: "standard",
  serviceName: "Standard Visit",
  appointmentAt: "2026-06-22T09:00:00.000Z",
  appointmentEndAt: "2026-06-22T10:00:00.000Z",
  status: "open",
  notes: "Customer prefers a morning callback.",
  emailVerified: true,
  createdAt: "2026-06-20T09:00:00.000Z",
  updatedAt: "2026-06-20T09:00:00.000Z"
};

const leadSummary = {
  totalLeads: 21,
  openLeads: 12,
  resolvedLeads: 7,
  canceledLeads: 2,
  newLeadsLast7Days: 4,
  newOpenLast24Hours: 1,
  todayOpen: 2,
  upcomingOpen: 5,
  unverifiedOpen: 1,
  needsFollowUp: 3,
  resolutionRate: 33,
  newestLeadService: "Standard Visit",
  leadsByService: []
};

const emailDashboard = {
  settings: {
    customerVerificationEnabled: true,
    ownerBookingNoticeEnabled: true,
    bookingReminderEnabled: true,
    reviewRequestEnabled: true,
    reminderLeadHours: [24],
    reviewRequestDelayHours: 2,
    reviewUrl: "https://example.com/review",
    waitlistEnabled: true,
    waitlistOfferMinutes: 30
  },
  runtime: {
    automatedSchedulerEnabled: true,
    emailJobWorkerEnabled: true,
    smtpHost: "smtp.example.com",
    mailFrom: "Bookings <bookings@example.com>",
    maxAttempts: 5
  },
  summary: { byStatus: { sent: 18, failed: 1, pending: 2 }, byType: {} },
  recentJobs: [],
  failedJobs: [
    {
      _id: "failed-email-1",
      type: "bookingReminder",
      status: "failed",
      to: "customer@example.com",
      attempts: 2,
      maxAttempts: 5,
      lastError: "Temporary delivery failure",
      updatedAt: new Date().toISOString()
    }
  ],
  waitlist: { byStatus: {}, recentEntries: [] }
};

const businessSettings = {
  businessName: "ServiceCo",
  ownerEmail: "owner@example.com",
  notificationEmailFromName: "Booking Notifications",
  timezone: "Europe/Berlin",
  ownerNotificationEmails: ["owner@example.com"],
  publicContact: { email: "hello@example.com", phone: "+49 30 123456" },
  legal: { privacyContactEmail: "privacy@example.com", cancellationPolicy: "Cancel at least 24 hours before the appointment." },
  operatingWeekdays: [1, 2, 3, 4, 5],
  slotStartHours: [8, 10, 12, 14],
  slotDurationHours: 2,
  slotIntervalMinutes: 120,
  weeklySchedule: Array.from({ length: 7 }, (_, index) => ({ weekday: index + 1, enabled: index < 5, openings: index < 5 ? [{ start: "08:00", end: "16:00" }] : [], breaks: [] })),
  blackoutDates: [],
  bookingRules: { minimumNoticeHours: 2, bookingWindowDays: 60, cancellationNoticeHours: 24, rescheduleNoticeHours: 24, requirePhone: true, requireNotes: false, confirmationMode: "request" },
  services: [],
  emailAutomations: emailDashboard.settings,
  operationalControls: { bookingsPaused: false, bookingPauseMessage: "", maintenanceBannerEnabled: false, maintenanceBannerMessage: "" }
};

const monitoringDashboard = {
  status: {
    generatedAt: new Date().toISOString(),
    api: "online",
    database: "ready",
    databaseName: "booking",
    environment: "test",
    appBaseUrl: "http://127.0.0.1:5173",
    emailJobWorkerEnabled: true,
    automatedSchedulerEnabled: true,
    uptimeSeconds: 3600,
    averageRequestDurationMs: 12,
    memoryRssMb: 80
  },
  release: { version: "test", nodeVersion: "22" },
  alerting: {
    enabled: true,
    recipient: "ops@example.com",
    checkIntervalMs: 60000,
    cooldownMs: 1800000,
    lookbackMinutes: 15,
    recentStates: []
  },
  operationalControls: {
    bookingsPaused: false,
    bookingPauseMessage: "",
    maintenanceBannerEnabled: false,
    maintenanceBannerMessage: ""
  },
  traffic: { httpRequestsTotal: 12, httpErrorsTotal: 0, errorRate: 0, recentRequests: [] },
  database: { available: true, collections: 8, objects: 21, dataSizeMb: 1, storageSizeMb: 2, indexSizeMb: 1 },
  frontend: { eventsLast24Hours: {}, poorWebVitals: 0, recentEvents: [] },
  syntheticChecks: [{ name: "Booking readiness", status: "pass", durationMs: 9, message: "Ready" }],
  trends: { requests: [], bookings: [], emailFailures: [] },
  bookings: {
    total: 21,
    open: 12,
    resolved: 7,
    canceled: 2,
    today: 2,
    next24Hours: 3,
    pastOpen: 0,
    last7Days: 4,
    unverifiedOpen: 1,
    recent: []
  },
  emails: {
    queued: 0,
    sent: 18,
    failed: 0,
    staleProcessing: 0,
    oldPending: 0,
    oldestPendingAgeMinutes: 0,
    byStatus: {},
    recentJobs: [],
    failedJobs: [],
    staleJobs: []
  },
  auditLogs: [],
  incidents: [],
  recentErrors: []
};

async function mockAuthenticatedDashboards(page: Page) {
  await page.route("**/api/admin/me", (route) => route.fulfill({ json: { authenticated: true } }));
  await page.route("**/api/monitor/me", (route) => route.fulfill({ json: { authenticated: true } }));
  await page.route("**/api/availability**", (route) =>
    route.fulfill({
      json: {
        days: [
          {
            date: "2026-06-22T00:00:00.000Z",
            dateLabel: "Mon, Jun 22",
            timezone: "UTC",
            slots: [
              {
                slotStartAt: booking.appointmentAt,
                slotEndAt: booking.appointmentEndAt,
                timeLabel: "9:00 AM - 10:00 AM",
                status: "booked",
                isAvailable: false,
                booking
              }
            ]
          }
        ]
      }
    })
  );
  await page.route("**/api/leads/summary", (route) => route.fulfill({ json: { summary: leadSummary } }));
  await page.route("**/api/admin/email-automations", (route) => route.fulfill({ json: emailDashboard }));
  await page.route("**/api/business-settings", async (route) => {
    if (route.request().method() === "PATCH") {
      const update = route.request().postDataJSON();
      await route.fulfill({ json: { settings: { ...businessSettings, ...update } } });
      return;
    }
    await route.fulfill({ json: { settings: businessSettings } });
  });
  await page.route("**/api/admin/csrf", (route) => route.fulfill({ json: { csrfToken: "smoke-csrf" } }));
  await page.route("**/api/bookings?**", (route) =>
    route.fulfill({
      json: { bookings: [booking], pagination: { page: 1, limit: 10, total: 21, totalPages: 3 } }
    })
  );
  await page.route("**/api/monitor/dashboard", (route) =>
    route.fulfill({ json: monitoringDashboard })
  );
  await page.route("**/api/telemetry/frontend", (route) => route.fulfill({ status: 204 }));
}

test.beforeEach(async ({ page }) => mockAuthenticatedDashboards(page));

test("admin calendar and booking dialog are keyboard accessible", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Booking calendar" })).toBeVisible();
  await page.getByRole("button", { name: /booked/i }).click();
  await expect(page.getByRole("dialog", { name: "Ada Customer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close booking details" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("admin leads use server pagination", async ({ page }) => {
  await page.goto("/admin/leads");
  await expect(page.getByText("1-1 of 21 matching")).toBeVisible();
  await expect(page.getByText("Page 1 of 3")).toBeVisible();
  await expect(page.getByRole("button", { name: /next/i })).toBeEnabled();
});

test("mobile leads stay compact until contact details are expanded", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/leads");

  await expect(page.getByText("Filter: All")).toBeVisible();
  await expect(page.getByText("Pipeline insights")).toBeVisible();
  await expect(page.getByRole("link", { name: "Call" })).toBeHidden();

  await page.getByRole("button", { name: "Show details for Ada Customer" }).click();
  await expect(page.getByRole("link", { name: "Call" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Email / })).toBeVisible();
  await expect(page.getByRole("article").getByText("Customer prefers a morning callback.")).toBeVisible();
});

test("mobile email settings prioritize issues and preserve unsaved changes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/emails");

  await expect(page.getByRole("heading", { name: "Email delivery needs attention" })).toBeVisible();
  await expect(page.getByRole("button", { name: /issues 1/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();

  const ownerNotice = page.getByRole("switch", { name: /owner booking notice/i });
  await expect(ownerNotice).toBeChecked();
  await ownerNotice.click();
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(ownerNotice).toBeChecked();
  await expect(page.getByText("Unsaved changes")).toBeHidden();
});

test("admin edits business settings without service controls", async ({ page }) => {
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Business settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Business information" })).toBeVisible();
  await expect(page.getByText(/services/i)).toBeHidden();

  await page.getByLabel("Business name").fill("Updated Service Co");
  const requestPromise = page.waitForRequest((request) => request.url().endsWith("/api/business-settings") && request.method() === "PATCH");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  const body = (await requestPromise).postDataJSON();
  expect(body.businessName).toBe("Updated Service Co");
  expect(body.services).toBeUndefined();
  await expect(page.getByText("Business saved.")).toBeVisible();
});

test("mobile business settings provide a live profile and timezone guidance", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: /Business.*ServiceCo/i }).click();

  await expect(page.getByText("Business profile")).toBeVisible();
  await page.getByLabel("Business name").fill("North Star Care");
  await expect(page.getByRole("heading", { name: "North Star Care" })).toBeVisible();

  await page.getByLabel("Timezone").fill("Not/A_Timezone");
  await expect(page.getByText("Choose a valid timezone such as Europe/Berlin.")).toBeVisible();
  await expect(page.getByLabel("Timezone")).toHaveAttribute("aria-invalid", "true");

  await page.getByRole("button", { name: /Use device timezone/i }).click();
  await expect(page.getByText("Valid timezone")).toBeVisible();
  await expect(page.getByText("Timezone needs attention")).toBeHidden();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
});

test("mobile settings use a focused hub and compact day editor", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/settings");

  await expect(page.getByRole("heading", { name: "Business settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Availability.*5 open days/i })).toBeVisible();
  await expect(page.getByLabel("Business name")).toBeHidden();

  await page.getByRole("button", { name: /Availability.*5 open days/i }).click();
  await expect(page.getByRole("heading", { name: "Opening schedule" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeHidden();
  await page.getByRole("button", { name: /Mon.*08:00 - 16:00/i }).click();
  await expect(page.getByRole("dialog", { name: "Monday" })).toBeVisible();
  await page.getByLabel("Opens").fill("07:30");
  await page.getByRole("button", { name: "Apply schedule" }).click();

  await expect(page.getByRole("button", { name: /Mon.*07:30 - 16:00/i })).toBeVisible();
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Back to settings" }).click();
  await expect(page.getByRole("dialog", { name: "Discard changes?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByRole("heading", { name: "Opening schedule" })).toBeVisible();
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByRole("button", { name: /Mon.*08:00 - 16:00/i })).toBeVisible();
  await expect(page.getByText("Unsaved changes")).toBeHidden();
});

test("mobile availability validates hours and keeps canceled time off out of the draft", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: /Availability.*5 open days/i }).click();
  await page.getByRole("button", { name: /Mon.*08:00 - 16:00/i }).click();

  await page.getByLabel("Closes").fill("07:00");
  await expect(page.getByText("Closing time must be after opening time.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply schedule" })).toBeDisabled();
  await page.getByLabel("Closes").fill("16:00");
  await page.getByText("Apply to other days").click();
  await page.getByRole("checkbox", { name: "Tuesday" }).check();
  await page.getByLabel("Opens").fill("07:30");
  await page.getByRole("button", { name: "Apply schedule" }).click();
  await expect(page.getByRole("button", { name: /Tue.*07:30 - 16:00/i })).toBeVisible();
  await page.getByRole("button", { name: "Discard" }).click();

  await page.getByRole("button", { name: "Time off" }).click();
  await expect(page.getByText("No upcoming closures")).toBeVisible();
  await page.getByRole("button", { name: "Add time off" }).click();
  await expect(page.getByRole("dialog", { name: "Add time off" })).toBeVisible();
  await page.getByRole("button", { name: "Close editor" }).click();
  await expect(page.getByText("No upcoming closures")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeHidden();
});

test("monitoring dashboard shows snapshot age and health", async ({ page }) => {
  await page.goto("/monitoring");
  await expect(page.getByRole("heading", { name: "Monitoring dashboard" })).toBeVisible();
  await expect(page.getByText(/auto-refreshes every 30s/i)).toBeVisible();
  await expect(page.getByText("Healthy", { exact: true }).first()).toBeVisible();
});
