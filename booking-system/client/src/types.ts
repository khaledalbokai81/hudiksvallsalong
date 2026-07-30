export type Service = {
  id: string;
  name: string;
  duration: string;
  durationHours: number;
  price: string;
  description: string;
};

export type Booking = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  serviceId: string;
  serviceName: string;
  serviceDurationHours?: number;
  appointmentAt?: string;
  appointmentEndAt?: string;
  status: "open" | "resolved" | "canceled";
  notes?: string;
  emailVerified: boolean;
  emailVerifiedAt?: string;
  emailVerificationExpiresAt?: string;
  resolvedAt?: string;
  canceledAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type BookingInput = {
  name: string;
  email: string;
  phone: string;
  serviceId: string;
  appointmentAt: string;
  notes?: string;
  waitlistToken?: string;
};

export type ManageBookingInput = {
  name: string;
  phone: string;
  serviceId: string;
  appointmentAt: string;
  notes?: string;
};

export type AvailabilitySlot = {
  slotStartAt: string;
  slotEndAt: string;
  timeLabel: string;
  status: "open" | "busy" | "booked" | "past";
  isAvailable: boolean;
  bookingId?: string;
  booking?: {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
    serviceId?: string;
    serviceName?: string;
    serviceDurationHours?: number;
    appointmentAt?: string;
    appointmentEndAt?: string;
    status?: "open" | "resolved" | "canceled";
    notes?: string;
    emailVerified?: boolean;
    emailVerifiedAt?: string;
    createdAt?: string;
  };
};

export type AvailabilityDay = {
  date: string;
  dateLabel: string;
  timezone: string;
  slots: AvailabilitySlot[];
};

export type LeadServiceSummary = {
  serviceId: string;
  serviceName: string;
  total: number;
  open: number;
  resolved: number;
  canceled: number;
};

export type LeadSummary = {
  totalLeads: number;
  openLeads: number;
  resolvedLeads: number;
  canceledLeads: number;
  newLeadsLast7Days: number;
  newOpenLast24Hours: number;
  todayOpen: number;
  upcomingOpen: number;
  unverifiedOpen: number;
  needsFollowUp: number;
  resolutionRate: number;
  newestLeadService: string | null;
  leadsByService: LeadServiceSummary[];
};

export type EmailJobStatus = "pending" | "processing" | "sent" | "failed";

export type EmailJobType =
  | "bookingVerification"
  | "ownerBookingNotice"
  | "bookingReminder"
  | "reviewRequest"
  | "waitlistJoined"
  | "waitlistAvailable";

export type EmailAutomationSettings = {
  customerVerificationEnabled: boolean;
  ownerBookingNoticeEnabled: boolean;
  bookingReminderEnabled: boolean;
  reviewRequestEnabled: boolean;
  reminderLeadHours: number[];
  reviewRequestDelayHours: number;
  reviewUrl?: string;
  waitlistEnabled: boolean;
  waitlistOfferMinutes: number;
};

export type WaitlistEntry = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  serviceId: string;
  serviceName: string;
  slotStartAt: string;
  status: "waiting" | "notified" | "converted" | "expired" | "canceled";
  offerExpiresAt?: string;
  notifiedAt?: string;
  convertedAt?: string;
  createdAt: string;
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
export type BusinessSettings = {
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
};
export type PublicSettings = Pick<BusinessSettings, "businessName" | "timezone" | "publicContact" | "legal" | "bookingRules">;

export type EmailAutomationRuntime = {
  automatedSchedulerEnabled: boolean;
  emailJobWorkerEnabled: boolean;
  smtpHost: string;
  mailFrom: string;
  maxAttempts: number;
};

export type EmailJob = {
  _id: string;
  type: EmailJobType;
  status: EmailJobStatus;
  to?: string;
  attempts: number;
  maxAttempts: number;
  runAt?: string;
  lockedUntil?: string;
  lastError?: string;
  sentAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type MonitoringIncident = {
  severity: "critical" | "warning";
  message: string;
  action: string;
};

export type SystemEvent = {
  _id: string;
  severity: "info" | "warning" | "error";
  type: string;
  message: string;
  code?: string;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  createdAt?: string;
};

export type BrowserEvent = {
  _id: string;
  type: "javascript_error" | "unhandled_rejection" | "web_vitals" | "page_load";
  path: string;
  message?: string;
  source?: string;
  stack?: string;
  metricName?: string;
  metricValue?: number;
  rating?: "good" | "needs-improvement" | "poor";
  userAgent?: string;
  createdAt?: string;
};

export type HttpRequestLog = {
  _id: string;
  requestId?: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userAgent?: string;
  createdAt?: string;
};

export type SyntheticCheck = {
  name: string;
  status: "pass" | "fail" | "warn";
  durationMs: number;
  message: string;
};

export type AlertState = {
  _id: string;
  key: string;
  status: "active" | "resolved";
  lastSentAt?: string;
  lastResolvedAt?: string;
  lastMessage?: string;
  updatedAt: string;
};

export type EmailAutomationDashboard = {
  settings: EmailAutomationSettings;
  runtime: EmailAutomationRuntime;
  summary: {
    byStatus: Partial<Record<EmailJobStatus, number>>;
    byType: Partial<Record<EmailJobType, number>>;
  };
  recentJobs: EmailJob[];
  failedJobs: EmailJob[];
  waitlist: {
    byStatus: Partial<Record<WaitlistEntry["status"], number>>;
    recentEntries: WaitlistEntry[];
  };
};

export type MonitoringBooking = {
  _id: string;
  name?: string;
  serviceName?: string;
  appointmentAt?: string;
  status: "open" | "resolved" | "canceled";
  emailVerified: boolean;
  createdAt?: string;
};

export type MonitoringAuditLog = {
  _id: string;
  action: string;
  targetType: string;
  targetId?: string;
  createdAt: string;
};

export type MonitoringDashboard = {
  status: {
    generatedAt: string;
    api: "online";
    database: "ready" | "not-ready";
    databaseName?: string;
    environment: string;
    appBaseUrl: string;
    emailJobWorkerEnabled: boolean;
    automatedSchedulerEnabled: boolean;
    uptimeSeconds: number;
    averageRequestDurationMs: number;
    memoryRssMb: number;
  };
  release: {
    version: string;
    commit?: string;
    buildTime?: string;
    nodeVersion: string;
  };
  alerting: {
    enabled: boolean;
    recipient: string;
    checkIntervalMs: number;
    cooldownMs: number;
    lookbackMinutes: number;
    recentStates: AlertState[];
  };
  operationalControls: OperationalControls;
  traffic: {
    httpRequestsTotal: number;
    httpErrorsTotal: number;
    errorRate: number;
    recentRequests: HttpRequestLog[];
  };
  database: {
    available: boolean;
    collections: number;
    objects: number;
    dataSizeMb: number;
    storageSizeMb: number;
    indexSizeMb: number;
    connections?: number;
  };
  frontend: {
    eventsLast24Hours: Partial<Record<BrowserEvent["type"], number>>;
    poorWebVitals: number;
    recentEvents: BrowserEvent[];
  };
  syntheticChecks: SyntheticCheck[];
  trends: {
    requests: Array<{
      bucket: string;
      requests: number;
      errors: number;
      averageDurationMs: number;
    }>;
    bookings: Array<{ bucket: string; created: number }>;
    emailFailures: Array<{ bucket: string; failed: number }>;
  };
  bookings: {
    total: number;
    open: number;
    resolved: number;
    canceled: number;
    today: number;
    next24Hours: number;
    pastOpen: number;
    last7Days: number;
    unverifiedOpen: number;
    recent: MonitoringBooking[];
  };
  emails: {
    queued: number;
    sent: number;
    failed: number;
    staleProcessing: number;
    oldPending: number;
    oldestPendingAgeMinutes: number;
    lastSentAt?: string;
    byStatus: Partial<Record<EmailJobStatus, number>>;
    recentJobs: EmailJob[];
    failedJobs: EmailJob[];
    staleJobs: EmailJob[];
  };
  auditLogs: MonitoringAuditLog[];
  incidents: MonitoringIncident[];
  recentErrors: SystemEvent[];
};
