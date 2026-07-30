import { config } from "./config.js";
import {
  BusinessSettings,
  type BusinessSettingsDocument,
  type BlackoutDate,
  type BookingRules,
  type EmailAutomationSettings,
  type LegalSettings,
  type OperationalControls,
  type PublicContactSettings,
  type WeeklyScheduleDay
} from "./models/BusinessSettings.js";

export type Service = {
  id: string;
  name: string;
  duration: string;
  durationHours: number;
  price: string;
  description: string;
};

const templateTestServices: Service[] = [
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
  },
  {
    id: "move-out",
    name: "Project Service",
    duration: "5-7 hours",
    durationHours: 7,
    price: "From $320",
    description: "A project-sized service for one-off work that needs more time and preparation."
  },
  {
    id: "office-care",
    name: "Business Service",
    duration: "Custom",
    durationHours: 2,
    price: "Quote",
    description: "A configurable business service for commercial or recurring account requests."
  }
];

const salonServices: Service[] = [
  {
    id: "herrklippning",
    name: "Herrklippning",
    duration: "45 min",
    durationHours: 0.75,
    price: "300 kr",
    description: "Klassisk eller modern herrklippning anpassad efter dig."
  },
  {
    id: "skaggtrimning",
    name: "Skäggtrimning",
    duration: "30 min",
    durationHours: 0.5,
    price: "200 kr",
    description: "Formning och trimning av skägg med en ren finish."
  },
  {
    id: "har-skagg",
    name: "Hår + skägg",
    duration: "60 min",
    durationHours: 1,
    price: "400 kr",
    description: "Komplett klippning och skäggtrimning i samma besök."
  },
  {
    id: "barnklippning",
    name: "Barnklippning",
    duration: "30 min",
    durationHours: 0.5,
    price: "250 kr",
    description: "Trygg och smidig klippning för barn."
  },
  {
    id: "pensionarsklippning",
    name: "Pensionärsklippning",
    duration: "30 min",
    durationHours: 0.5,
    price: "250 kr",
    description: "Herrklippning till pensionärspris."
  },
  {
    id: "maskinklippning",
    name: "Maskinklippning",
    duration: "30 min",
    durationHours: 0.5,
    price: "200 kr",
    description: "Jämn och noggrann maskinklippning."
  },
  {
    id: "tvatt-styling",
    name: "Tvätt & styling",
    duration: "30 min",
    durationHours: 0.5,
    price: "150 kr",
    description: "Hårtvätt och styling för en fräsch finish."
  },
  {
    id: "konturtrimning",
    name: "Konturtrimning",
    duration: "20 min",
    durationHours: 1 / 3,
    price: "150 kr",
    description: "Snabb uppfräschning av nacke, polisonger och konturer."
  }
];

export const defaultServices = config.NODE_ENV === "test" ? templateTestServices : salonServices;

export type BusinessSettingsValue = Pick<
  BusinessSettingsDocument,
  | "businessName"
  | "ownerEmail"
  | "notificationEmailFromName"
  | "timezone"
  | "ownerNotificationEmails"
  | "publicContact"
  | "legal"
  | "operatingWeekdays"
  | "slotStartHours"
  | "slotDurationHours"
  | "slotIntervalMinutes"
  | "weeklySchedule"
  | "blackoutDates"
  | "bookingRules"
  | "services"
  | "emailAutomations"
  | "operationalControls"
>;

export type EmailAutomationSettingsValue = EmailAutomationSettings;
export type OperationalControlsValue = OperationalControls;
export type WeeklyScheduleDayValue = WeeklyScheduleDay;
export type BlackoutDateValue = BlackoutDate;
export type BookingRulesValue = BookingRules;
export type PublicContactSettingsValue = PublicContactSettings;
export type LegalSettingsValue = LegalSettings;

function buildLegacySchedule(weekdays: number[], hours: number[], slotDurationHours: number) {
  const sortedHours = [...new Set(hours)].sort((left, right) => left - right);
  const start = `${String(sortedHours[0] ?? 8).padStart(2, "0")}:00`;
  const endHour = Math.min(24, (sortedHours.at(-1) ?? 14) + slotDurationHours);
  const end = endHour === 24 ? "24:00" : `${String(endHour).padStart(2, "0")}:00`;

  return Array.from({ length: 7 }, (_, index): WeeklyScheduleDay => ({
    weekday: index + 1,
    enabled: weekdays.includes(index + 1),
    openings: weekdays.includes(index + 1) ? [{ start, end }] : [],
    breaks: []
  }));
}

function normalizeReminderStages(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === "number" ? [value] : [];
  const valid = values.filter(
    (item): item is number => Number.isInteger(item) && item >= 1 && item <= 168
  );

  return [...new Set(valid)].sort((left, right) => right - left);
}

export const defaultBusinessSettings: BusinessSettingsValue = {
  businessName: config.NODE_ENV === "test" ? "Service Booking Business" : "Hudiksvalls Salong",
  ownerEmail: config.BUSINESS_OWNER_EMAIL,
  notificationEmailFromName: "Booking Notifications",
  timezone: config.BUSINESS_TIMEZONE,
  ownerNotificationEmails: [config.BUSINESS_OWNER_EMAIL],
  publicContact: {},
  legal: {},
  operatingWeekdays: config.NODE_ENV === "test" ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6],
  slotStartHours: config.NODE_ENV === "test"
    ? [8, 10, 12, 14]
    : [10, 11, 12, 13, 14, 15, 16, 17],
  slotDurationHours: config.NODE_ENV === "test" ? 2 : 0.5,
  slotIntervalMinutes: config.NODE_ENV === "test" ? 120 : 30,
  weeklySchedule: config.NODE_ENV === "test"
    ? buildLegacySchedule([1, 2, 3, 4, 5], [8, 10, 12, 14], 2)
    : [
        ...Array.from({ length: 5 }, (_, index): WeeklyScheduleDay => ({
          weekday: index + 1,
          enabled: true,
          openings: [{ start: "10:00", end: "18:00" }],
          breaks: []
        })),
        {
          weekday: 6,
          enabled: true,
          openings: [{ start: "10:00", end: "17:00" }],
          breaks: []
        },
        { weekday: 7, enabled: false, openings: [], breaks: [] }
      ],
  blackoutDates: [],
  bookingRules: {
    minimumNoticeHours: 0,
    bookingWindowDays: 90,
    cancellationNoticeHours: 0,
    rescheduleNoticeHours: 0,
    requirePhone: config.NODE_ENV === "test",
    requireNotes: false,
    confirmationMode: "request"
  },
  services: defaultServices,
  emailAutomations: {
    ownerBookingNoticeEnabled: true,
    bookingReminderEnabled: true,
    reviewRequestEnabled: true,
    reminderLeadHours: normalizeReminderStages([48, config.BOOKING_REMINDER_LEAD_HOURS, 2]),
    reviewRequestDelayHours: config.REVIEW_REQUEST_DELAY_HOURS,
    reviewUrl: config.REVIEW_URL,
    waitlistEnabled: true,
    waitlistOfferMinutes: 30
  },
  operationalControls: {
    bookingsPaused: false,
    bookingPauseMessage: "Online booking is temporarily paused. Please contact us directly.",
    maintenanceBannerEnabled: false,
    maintenanceBannerMessage: "We are doing maintenance. Some features may be temporarily unavailable."
  }
};

let cachedBusinessSettings:
  | {
      value: BusinessSettingsValue;
      expiresAt: number;
    }
  | undefined;

function cloneBusinessSettings(settings: BusinessSettingsValue): BusinessSettingsValue {
  return {
    ...settings,
    operatingWeekdays: [...settings.operatingWeekdays],
    slotStartHours: [...settings.slotStartHours],
    ownerNotificationEmails: [...settings.ownerNotificationEmails],
    publicContact: { ...settings.publicContact },
    legal: { ...settings.legal },
    weeklySchedule: settings.weeklySchedule.map((day) => ({
      ...day,
      openings: day.openings.map((range) => ({ ...range })),
      breaks: day.breaks.map((range) => ({ ...range }))
    })),
    blackoutDates: settings.blackoutDates.map((date) => ({ ...date })),
    bookingRules: { ...settings.bookingRules },
    services: settings.services.map((service) => ({ ...service })),
    emailAutomations: {
      ...settings.emailAutomations,
      reminderLeadHours: [...settings.emailAutomations.reminderLeadHours]
    },
    operationalControls: { ...settings.operationalControls }
  };
}

function setBusinessSettingsCache(settings: BusinessSettingsValue) {
  if (config.BUSINESS_SETTINGS_CACHE_TTL_MS <= 0) {
    cachedBusinessSettings = undefined;
    return;
  }

  cachedBusinessSettings = {
    value: cloneBusinessSettings(settings),
    expiresAt: Date.now() + config.BUSINESS_SETTINGS_CACHE_TTL_MS
  };
}

export function clearBusinessSettingsCache() {
  cachedBusinessSettings = undefined;
}

function assertSettings(settings: BusinessSettingsDocument | null): BusinessSettingsDocument {
  if (!settings) {
    throw new Error("Business settings could not be loaded");
  }

  return settings;
}

function normalizeSettings(settings: BusinessSettingsDocument): BusinessSettingsValue {
  const defaultDurationByServiceId = new Map(
    defaultServices.map((service) => [service.id, service.durationHours])
  );
  const services =
    settings.services?.length > 0
      ? settings.services.map((service) => ({
          ...service,
          durationHours:
            service.durationHours ||
            defaultDurationByServiceId.get(service.id) ||
            defaultBusinessSettings.slotDurationHours
        }))
      : defaultBusinessSettings.services;
  const emailAutomations = {
    ...defaultBusinessSettings.emailAutomations,
    ...(settings.emailAutomations || {}),
    reminderLeadHours: normalizeReminderStages(
      (settings.emailAutomations as unknown as { reminderLeadHours?: unknown } | undefined)
        ?.reminderLeadHours
    )
  };

  if (emailAutomations.reminderLeadHours.length === 0) {
    emailAutomations.reminderLeadHours = [...defaultBusinessSettings.emailAutomations.reminderLeadHours];
  }
  const operationalControls = {
    ...defaultBusinessSettings.operationalControls,
    ...(settings.operationalControls || {})
  };
  const operatingWeekdays = settings.operatingWeekdays?.length > 0
    ? settings.operatingWeekdays
    : defaultBusinessSettings.operatingWeekdays;
  const slotStartHours = settings.slotStartHours?.length > 0
    ? settings.slotStartHours
    : defaultBusinessSettings.slotStartHours;
  const slotDurationHours = settings.slotDurationHours || defaultBusinessSettings.slotDurationHours;

  return {
    businessName: settings.businessName || defaultBusinessSettings.businessName,
    ownerEmail: settings.ownerEmail || defaultBusinessSettings.ownerEmail,
    notificationEmailFromName:
      settings.notificationEmailFromName || defaultBusinessSettings.notificationEmailFromName,
    timezone: settings.timezone || defaultBusinessSettings.timezone,
    ownerNotificationEmails: settings.ownerNotificationEmails?.length
      ? [...settings.ownerNotificationEmails]
      : [settings.ownerEmail || defaultBusinessSettings.ownerEmail],
    publicContact: { ...defaultBusinessSettings.publicContact, ...(settings.publicContact || {}) },
    legal: { ...defaultBusinessSettings.legal, ...(settings.legal || {}) },
    operatingWeekdays,
    slotStartHours,
    slotDurationHours,
    slotIntervalMinutes: settings.slotIntervalMinutes || slotDurationHours * 60,
    weeklySchedule: settings.weeklySchedule?.length
      ? settings.weeklySchedule
      : buildLegacySchedule(operatingWeekdays, slotStartHours, slotDurationHours),
    blackoutDates: settings.blackoutDates || [],
    bookingRules: { ...defaultBusinessSettings.bookingRules, ...(settings.bookingRules || {}) },
    services,
    emailAutomations,
    operationalControls
  };
}

function getMissingSettingUpdates(settings: BusinessSettingsDocument) {
  const updates: Partial<BusinessSettingsValue> = {};

  if (!settings.businessName) updates.businessName = defaultBusinessSettings.businessName;
  if (!settings.ownerEmail) updates.ownerEmail = defaultBusinessSettings.ownerEmail;
  if (!settings.notificationEmailFromName) {
    updates.notificationEmailFromName = defaultBusinessSettings.notificationEmailFromName;
  }
  if (!settings.timezone) updates.timezone = defaultBusinessSettings.timezone;
  if (!settings.ownerNotificationEmails?.length) updates.ownerNotificationEmails = [settings.ownerEmail || defaultBusinessSettings.ownerEmail];
  if (!settings.publicContact) updates.publicContact = defaultBusinessSettings.publicContact;
  if (!settings.legal) updates.legal = defaultBusinessSettings.legal;
  if (!settings.operatingWeekdays?.length) {
    updates.operatingWeekdays = defaultBusinessSettings.operatingWeekdays;
  }
  if (!settings.slotStartHours?.length) {
    updates.slotStartHours = defaultBusinessSettings.slotStartHours;
  }
  if (!settings.slotDurationHours) {
    updates.slotDurationHours = defaultBusinessSettings.slotDurationHours;
  }
  if (!settings.slotIntervalMinutes) updates.slotIntervalMinutes = (settings.slotDurationHours || defaultBusinessSettings.slotDurationHours) * 60;
  if (!settings.weeklySchedule?.length) {
    updates.weeklySchedule = buildLegacySchedule(
      settings.operatingWeekdays?.length ? settings.operatingWeekdays : defaultBusinessSettings.operatingWeekdays,
      settings.slotStartHours?.length ? settings.slotStartHours : defaultBusinessSettings.slotStartHours,
      settings.slotDurationHours || defaultBusinessSettings.slotDurationHours
    );
  }
  if (!settings.blackoutDates) updates.blackoutDates = [];
  if (!settings.bookingRules) updates.bookingRules = defaultBusinessSettings.bookingRules;
  if (!settings.services?.length) updates.services = defaultBusinessSettings.services;
  if (!settings.emailAutomations) {
    updates.emailAutomations = defaultBusinessSettings.emailAutomations;
  }
  if (!settings.operationalControls) {
    updates.operationalControls = defaultBusinessSettings.operationalControls;
  }

  return updates;
}

export async function getBusinessSettings() {
  if (cachedBusinessSettings && cachedBusinessSettings.expiresAt > Date.now()) {
    return cloneBusinessSettings(cachedBusinessSettings.value);
  }

  const settings = assertSettings(
    await BusinessSettings.findOneAndUpdate(
      { key: "default" },
      { $setOnInsert: { key: "default", ...defaultBusinessSettings } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean<BusinessSettingsDocument>()
  );
  const missingUpdates = getMissingSettingUpdates(settings);

  if (Object.keys(missingUpdates).length > 0) {
    const backfilledSettings = assertSettings(
      await BusinessSettings.findOneAndUpdate(
        { key: "default" },
        { $set: missingUpdates },
        { new: true }
      ).lean<BusinessSettingsDocument>()
    );

    const normalizedBackfilledSettings = normalizeSettings(backfilledSettings);

    setBusinessSettingsCache(normalizedBackfilledSettings);
    return cloneBusinessSettings(normalizedBackfilledSettings);
  }

  const normalizedSettings = normalizeSettings(settings);

  setBusinessSettingsCache(normalizedSettings);
  return cloneBusinessSettings(normalizedSettings);
}

export async function updateBusinessSettings(input: Partial<BusinessSettingsValue>) {
  clearBusinessSettingsCache();
  const existing = await getBusinessSettings();
  const nextSettings = {
    ...existing,
    ...input,
    publicContact: input.publicContact
      ? { ...existing.publicContact, ...input.publicContact }
      : existing.publicContact,
    legal: input.legal ? { ...existing.legal, ...input.legal } : existing.legal,
    bookingRules: input.bookingRules
      ? { ...existing.bookingRules, ...input.bookingRules }
      : existing.bookingRules,
    emailAutomations: input.emailAutomations
      ? { ...existing.emailAutomations, ...input.emailAutomations }
      : existing.emailAutomations,
    operationalControls: input.operationalControls
      ? { ...existing.operationalControls, ...input.operationalControls }
      : existing.operationalControls
  };

  const settings = assertSettings(
    await BusinessSettings.findOneAndUpdate(
      { key: "default" },
      { $set: nextSettings },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean<BusinessSettingsDocument>()
  );

  const normalizedSettings = normalizeSettings(settings);

  setBusinessSettingsCache(normalizedSettings);
  return cloneBusinessSettings(normalizedSettings);
}

export function getServiceById(
  serviceId: string,
  settings: Pick<BusinessSettingsValue, "services">
): Service | undefined {
  return settings.services.find((service) => service.id === serviceId);
}
