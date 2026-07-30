import mongoose, { Schema } from "mongoose";
import type { Service } from "../services.js";

export type EmailAutomationSettings = {
  ownerBookingNoticeEnabled: boolean;
  bookingReminderEnabled: boolean;
  reviewRequestEnabled: boolean;
  reminderLeadHours: number[];
  reviewRequestDelayHours: number;
  reviewUrl?: string;
  waitlistEnabled: boolean;
  waitlistOfferMinutes: number;
};

export type OperationalControls = {
  bookingsPaused: boolean;
  bookingPauseMessage?: string;
  maintenanceBannerEnabled: boolean;
  maintenanceBannerMessage?: string;
};

export type TimeRange = { start: string; end: string };
export type WeeklyScheduleDay = {
  weekday: number;
  enabled: boolean;
  openings: TimeRange[];
  breaks: TimeRange[];
};
export type BlackoutDate = { id: string; startDate: string; endDate: string; reason?: string };
export type BookingRules = {
  minimumNoticeHours: number;
  bookingWindowDays: number;
  cancellationNoticeHours: number;
  rescheduleNoticeHours: number;
  requirePhone: boolean;
  requireNotes: boolean;
  confirmationMode: "request" | "instant";
};
export type PublicContactSettings = {
  email?: string;
  phone?: string;
  address?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  emergencyMessage?: string;
};
export type LegalSettings = {
  privacyContactEmail?: string;
  cancellationPolicy?: string;
};

export type BusinessSettingsDocument = {
  key: "default";
  businessName: string;
  ownerEmail: string;
  notificationEmailFromName: string;
  timezone: string;
  ownerNotificationEmails: string[];
  publicContact: PublicContactSettings;
  legal: LegalSettings;
  operatingWeekdays: number[];
  slotStartHours: number[];
  slotDurationHours: number;
  slotIntervalMinutes: number;
  weeklySchedule: WeeklyScheduleDay[];
  blackoutDates: BlackoutDate[];
  bookingRules: BookingRules;
  services: Service[];
  emailAutomations: EmailAutomationSettings;
  operationalControls: OperationalControls;
  createdAt: Date;
  updatedAt: Date;
};

const serviceSchema = new Schema<Service>(
  {
    id: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    durationHours: { type: Number, required: true, min: 0.25, max: 12, default: 0.5 },
    price: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const timeRangeSchema = new Schema<TimeRange>(
  {
    start: { type: String, required: true, trim: true },
    end: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const weeklyScheduleDaySchema = new Schema<WeeklyScheduleDay>(
  {
    weekday: { type: Number, required: true, min: 1, max: 7 },
    enabled: { type: Boolean, required: true },
    openings: { type: [timeRangeSchema], required: true, default: [] },
    breaks: { type: [timeRangeSchema], required: true, default: [] }
  },
  { _id: false }
);

const blackoutDateSchema = new Schema<BlackoutDate>(
  {
    id: { type: String, required: true, trim: true },
    startDate: { type: String, required: true, trim: true },
    endDate: { type: String, required: true, trim: true },
    reason: { type: String, trim: true, maxlength: 160 }
  },
  { _id: false }
);

const businessSettingsSchema = new Schema<BusinessSettingsDocument>(
  {
    key: { type: String, enum: ["default"], default: "default", unique: true, index: true },
    businessName: { type: String, required: true, trim: true },
    ownerEmail: { type: String, required: true, lowercase: true, trim: true },
    notificationEmailFromName: { type: String, required: true, trim: true },
    timezone: { type: String, required: true, trim: true },
    ownerNotificationEmails: [{ type: String, required: true, lowercase: true, trim: true }],
    publicContact: {
      email: { type: String, lowercase: true, trim: true },
      phone: { type: String, trim: true },
      address: { type: String, trim: true, maxlength: 500 },
      facebookUrl: { type: String, trim: true },
      instagramUrl: { type: String, trim: true },
      linkedinUrl: { type: String, trim: true },
      emergencyMessage: { type: String, trim: true, maxlength: 500 }
    },
    legal: {
      privacyContactEmail: { type: String, lowercase: true, trim: true },
      cancellationPolicy: { type: String, trim: true, maxlength: 4000 }
    },
    operatingWeekdays: [{ type: Number, required: true, min: 1, max: 7 }],
    slotStartHours: [{ type: Number, required: true, min: 0, max: 23 }],
    slotDurationHours: { type: Number, required: true, min: 0.25, max: 12 },
    slotIntervalMinutes: { type: Number, required: true, min: 15, max: 720, default: 120 },
    weeklySchedule: { type: [weeklyScheduleDaySchema], required: true, default: [] },
    blackoutDates: { type: [blackoutDateSchema], required: true, default: [] },
    bookingRules: {
      minimumNoticeHours: { type: Number, required: true, min: 0, max: 8760, default: 0 },
      bookingWindowDays: { type: Number, required: true, min: 1, max: 90, default: 90 },
      cancellationNoticeHours: { type: Number, required: true, min: 0, max: 8760, default: 0 },
      rescheduleNoticeHours: { type: Number, required: true, min: 0, max: 8760, default: 0 },
      requirePhone: { type: Boolean, required: true, default: true },
      requireNotes: { type: Boolean, required: true, default: false },
      confirmationMode: { type: String, enum: ["request", "instant"], required: true, default: "request" }
    },
    services: { type: [serviceSchema], required: true },
    emailAutomations: {
      ownerBookingNoticeEnabled: { type: Boolean, required: true, default: true },
      bookingReminderEnabled: { type: Boolean, required: true, default: true },
      reviewRequestEnabled: { type: Boolean, required: true, default: true },
      reminderLeadHours: {
        type: [{ type: Number, min: 1, max: 168 }],
        required: true,
        default: [48, 24, 2]
      },
      reviewRequestDelayHours: { type: Number, required: true, min: 0, max: 720, default: 2 },
      reviewUrl: { type: String, trim: true },
      waitlistEnabled: { type: Boolean, required: true, default: true },
      waitlistOfferMinutes: { type: Number, required: true, min: 5, max: 1440, default: 30 }
    },
    operationalControls: {
      bookingsPaused: { type: Boolean, required: true, default: false },
      bookingPauseMessage: { type: String, trim: true, maxlength: 240 },
      maintenanceBannerEnabled: { type: Boolean, required: true, default: false },
      maintenanceBannerMessage: { type: String, trim: true, maxlength: 240 }
    }
  },
  { timestamps: true }
);

export const BusinessSettings =
  mongoose.models.BusinessSettings ||
  mongoose.model<BusinessSettingsDocument>("BusinessSettings", businessSettingsSchema);
