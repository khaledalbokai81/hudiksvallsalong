import { expect, test, type Page } from "@playwright/test";

const services = [
  {
    id: "standard-home",
    name: "Standard Service Visit",
    duration: "2-3 hours",
    durationHours: 3,
    price: "From $120",
    description: "A focused service visit for routine customer requests and recurring appointments."
  },
  {
    id: "deep-clean",
    name: "Extended Service Visit",
    duration: "4-6 hours",
    durationHours: 6,
    price: "From $240",
    description: "A longer appointment for detailed work, larger jobs, or more involved requests."
  }
];

const operationalStatus = {
  operationalControls: {
    bookingsPaused: false,
    bookingPauseMessage: "Online booking is temporarily paused.",
    maintenanceBannerEnabled: false,
    maintenanceBannerMessage: ""
  }
};

const availability = {
  days: [
    {
      date: "2026-06-15T00:00:00.000Z",
      dateLabel: "Mon, Jun 15",
      timezone: "America/New_York",
      slots: [
        {
          slotStartAt: "2026-06-15T13:00:00.000Z",
          slotEndAt: "2026-06-15T16:00:00.000Z",
          timeLabel: "9:00 AM - 12:00 PM",
          status: "open",
          isAvailable: true
        },
        {
          slotStartAt: "2026-06-15T17:00:00.000Z",
          slotEndAt: "2026-06-15T20:00:00.000Z",
          timeLabel: "1:00 PM - 4:00 PM",
          status: "busy",
          isAvailable: false
        }
      ]
    }
  ]
};

async function mockPublicApi(page: Page, status = operationalStatus) {
  await page.route("**/api/services", async (route) => {
    await route.fulfill({ json: { services } });
  });
  await page.route("**/api/operational-status", async (route) => {
    await route.fulfill({ json: status });
  });
  await page.route("**/api/availability**", async (route) => {
    await route.fulfill({ json: availability });
  });
  await page.route("**/api/bookings", async (route) => {
    await route.fulfill({
      status: 201,
      json: {
        booking: {
          _id: "smoke-booking",
          name: "Smoke Test Customer",
          email: "smoke@example.com",
          phone: "+1 555 0100",
          serviceId: "standard-home",
          serviceName: "Standard Service Visit",
          serviceDurationHours: 3,
          appointmentAt: "2026-06-15T13:00:00.000Z",
          appointmentEndAt: "2026-06-15T16:00:00.000Z",
          status: "open",
          emailVerified: false,
          createdAt: "2026-06-13T10:00:00.000Z",
          updatedAt: "2026-06-13T10:00:00.000Z"
        },
        message: "Booking sent. You can verify your email from the message we send."
      }
    });
  });
  await page.route("**/api/waitlist", async (route) => {
    await route.fulfill({
      status: 201,
      json: {
        alreadyJoined: false,
        message: "You joined the waitlist. We will email you if the time opens."
      }
    });
  });
  await page.route("**/api/waitlist/offer**", async (route) => {
    await route.fulfill({
      json: {
        offer: {
          name: "Waitlist Smoke Customer",
          email: "waitlist-smoke@example.com",
          phone: "+1 555 0199",
          serviceId: "standard-home",
          serviceName: "Standard Service Visit",
          slotStartAt: "2026-06-15T13:00:00.000Z",
          offerExpiresAt: "2026-06-15T12:30:00.000Z"
        }
      }
    });
  });
  await page.route("**/api/telemetry/frontend", async (route) => {
    await route.fulfill({ status: 204 });
  });
}

test.beforeEach(async ({ page }) => {
  await mockPublicApi(page);
});

test("public pages render and navigation works", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "ServiceCo" })).toBeVisible();
  await page.getByRole("link", { name: /view services/i }).click();
  await expect(page).toHaveURL(/\/services$/);
  await expect(page.getByRole("heading", { name: /choose the service queue/i })).toBeVisible();

  await page.getByRole("link", { name: /select service/i }).first().click();
  await expect(page).toHaveURL(/\/booking\?service=standard-home$/);
  await expect(page.getByRole("heading", { name: /request an appointment/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /9:00 AM - 12:00 PM/i })).toBeVisible();

  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy notice" })).toBeVisible();

  await page.getByRole("link", { name: "Cookies" }).click();
  await expect(page).toHaveURL(/\/cookies$/);
  await expect(page.getByRole("heading", { name: "Cookie notice" })).toBeVisible();
});

test("booking form can be completed with mocked API data", async ({ page }) => {
  await page.goto("/booking?service=standard-home");

  await page.getByLabel("Name").fill("Smoke Test Customer");
  await page.getByLabel("Email").fill("smoke@example.com");
  await page.getByLabel("Phone").fill("+1 555 0100");
  await page.getByRole("button", { name: /9:00 AM - 12:00 PM/i }).click();
  await page.getByLabel("Notes").fill("Smoke test booking");
  await page.getByRole("button", { name: /send booking request/i }).click();

  await expect(page.getByText(/Booking sent/i)).toBeVisible();
});

test("maintenance and pause controls are visible on public booking flow", async ({ page }) => {
  await mockPublicApi(page, {
    operationalControls: {
      bookingsPaused: true,
      bookingPauseMessage: "Online booking is paused for smoke testing.",
      maintenanceBannerEnabled: true,
      maintenanceBannerMessage: "Smoke test maintenance banner."
    }
  });

  await page.goto("/booking");

  await expect(page.getByText("Smoke test maintenance banner.")).toBeVisible();
  await expect(page.getByText("Online booking is paused for smoke testing.")).toBeVisible();
  await expect(page.getByRole("button", { name: /booking paused/i })).toBeDisabled();
});

test("customer can join an unavailable slot waitlist", async ({ page }) => {
  await page.goto("/booking?service=standard-home");
  await page.getByLabel("Name").fill("Waitlist Smoke Customer");
  await page.getByLabel("Email").fill("waitlist-smoke@example.com");
  await page.getByLabel("Phone").fill("+1 555 0199");

  const waitlistRequest = page.waitForRequest((request) =>
    request.url().endsWith("/api/waitlist") && request.method() === "POST"
  );
  await page.getByRole("button", { name: /1:00 PM - 4:00 PM.*join waitlist/i }).click();
  const body = (await waitlistRequest).postDataJSON();

  expect(body).toMatchObject({
    email: "waitlist-smoke@example.com",
    serviceId: "standard-home",
    slotStartAt: "2026-06-15T17:00:00.000Z"
  });
  await expect(page.getByText(/You joined the waitlist/i)).toBeVisible();
});

test("waitlist offer prefills and submits the secured booking token", async ({ page }) => {
  await page.goto("/booking?waitlist=smoke-waitlist-token-0123456789abcdef");

  await expect(page.getByLabel("Name")).toHaveValue("Waitlist Smoke Customer");
  await expect(page.getByLabel("Email")).toHaveValue("waitlist-smoke@example.com");
  await expect(page.getByLabel("Phone")).toHaveValue("+1 555 0199");

  const bookingRequest = page.waitForRequest((request) =>
    request.url().endsWith("/api/bookings") && request.method() === "POST"
  );
  await page.getByRole("button", { name: /send booking request/i }).click();
  const body = (await bookingRequest).postDataJSON();

  expect(body.waitlistToken).toBe("smoke-waitlist-token-0123456789abcdef");
  expect(body.appointmentAt).toBe("2026-06-15T13:00:00.000Z");
});
