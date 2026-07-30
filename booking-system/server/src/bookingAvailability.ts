import { DateTime } from "luxon";
import { config } from "./config.js";
import { buildActiveBookingFilter } from "./bookingLifecycle.js";
import { createHttpError } from "./middleware/errorHandling.js";
import { AvailabilityOverride } from "./models/AvailabilityOverride.js";
import { Booking } from "./models/Booking.js";
import { expireUnverifiedBookings } from "./reliabilityJobs.js";
import { getServiceById, type BusinessSettingsValue } from "./services.js";

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
  status?: "open" | "resolved" | "canceled";
  notes?: string;
  emailVerified?: boolean;
  emailVerifiedAt?: Date | string;
  createdAt: Date | string;
};

export function getBusinessDateTime(value: Date, timezone: string) {
  return DateTime.fromJSDate(value, { zone: "utc" }).setZone(timezone);
}

export function startOfBusinessDay(timezone: string, value = new Date()) {
  return getBusinessDateTime(value, timezone).startOf("day");
}

export function parseBusinessDate(value: string | undefined, timezone: string) {
  if (!value) {
    return startOfBusinessDay(timezone);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (match) {
    return DateTime.fromObject(
      {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3])
      },
      { zone: timezone }
    ).startOf("day");
  }

  const parsed = DateTime.fromISO(value, { zone: timezone });

  if (!parsed.isValid) {
    throw createHttpError(400, "Choose a valid availability start date", "INVALID_AVAILABILITY_DATE");
  }

  return parsed.startOf("day");
}

export function normalizeSlotStart(value: string | Date, timezone: string) {
  const parsed =
    value instanceof Date
      ? DateTime.fromJSDate(value, { zone: "utc" })
      : DateTime.fromISO(value, { setZone: true });

  if (!parsed.isValid || (typeof value === "string" && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value))) {
    throw createHttpError(400, "Choose a valid appointment time", "INVALID_APPOINTMENT_TIME");
  }

  const slotInBusinessZone = parsed.setZone(timezone);

  if (
    slotInBusinessZone.second !== 0 ||
    slotInBusinessZone.millisecond !== 0 ||
    slotInBusinessZone.minute % 15 !== 0
  ) {
    throw createHttpError(
      400,
      "Choose an exact available appointment slot",
      "INVALID_APPOINTMENT_TIME"
    );
  }

  return slotInBusinessZone.toUTC().toJSDate();
}

export function ensureSupportedSlot(slotStartAt: Date, settings: BusinessSettingsValue) {
  const slotInBusinessZone = getBusinessDateTime(slotStartAt, settings.timezone);
  const isSupportedHour = getAdvertisedSlotStarts(
    slotInBusinessZone.startOf("day"),
    settings,
    settings.slotDurationHours
  ).some((candidate) => candidate.toMillis() === slotInBusinessZone.toMillis());

  if (!isSupportedHour) {
    throw createHttpError(
      400,
      "Choose an available business slot",
      "UNSUPPORTED_APPOINTMENT_SLOT"
    );
  }
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function dateKey(value: DateTime) {
  return value.toFormat("yyyy-MM-dd");
}

function isBlackoutDay(day: DateTime, settings: BusinessSettingsValue) {
  const key = dateKey(day);
  return settings.blackoutDates.some((blackout) => key >= blackout.startDate && key <= blackout.endDate);
}

function rangesOverlapMinutes(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number) {
  return leftStart < rightEnd && leftEnd > rightStart;
}

export function getAdvertisedSlotStarts(
  day: DateTime,
  settings: BusinessSettingsValue,
  durationHours: number,
  includeBlackout = false
) {
  const schedule = settings.weeklySchedule.find((item) => item.weekday === day.weekday);
  if (!schedule || schedule.openings.length === 0 || (!schedule.enabled && !includeBlackout) || (!includeBlackout && isBlackoutDay(day, settings))) return [];

  const durationMinutes = durationHours * 60;
  const intervalMinutes = settings.slotIntervalMinutes || settings.slotDurationHours * 60;
  const slots: DateTime[] = [];

  for (const opening of schedule.openings) {
    const openingStart = timeToMinutes(opening.start);
    const openingEnd = timeToMinutes(opening.end);
    let nextAvailableMinute = openingStart;

    for (let minute = openingStart; minute + durationMinutes <= openingEnd; minute += intervalMinutes) {
      if (minute < nextAvailableMinute) continue;
      const end = minute + durationMinutes;
      const overlapsBreak = schedule.breaks.some((range) =>
        rangesOverlapMinutes(minute, end, timeToMinutes(range.start), timeToMinutes(range.end))
      );
      if (!overlapsBreak) {
        slots.push(day.startOf("day").plus({ minutes: minute }));
        nextAvailableMinute = end;
      }
    }
  }

  return slots;
}

export function getAdvertisedSlotStartHours(
  settings: Pick<BusinessSettingsValue, "slotStartHours" | "slotDurationHours">,
  durationHours: number
) {
  const sortedStartHours = [...new Set(settings.slotStartHours)].sort((left, right) => left - right);
  const lastConfiguredStartHour = sortedStartHours.at(-1);

  if (lastConfiguredStartHour === undefined) {
    return [];
  }

  const businessEndHour = lastConfiguredStartHour + settings.slotDurationHours;
  const advertisedStartHours: number[] = [];
  let nextAvailableHour = -Infinity;

  for (const hour of sortedStartHours) {
    const slotEndHour = hour + durationHours;

    if (hour >= nextAvailableHour && slotEndHour <= businessEndHour) {
      advertisedStartHours.push(hour);
      nextAvailableHour = slotEndHour;
    }
  }

  return advertisedStartHours;
}

export function ensureAdvertisedSlotForDuration(
  slotStartAt: Date,
  settings: BusinessSettingsValue,
  durationHours: number
) {
  const slotInBusinessZone = getBusinessDateTime(slotStartAt, settings.timezone);
  const advertisedStarts = getAdvertisedSlotStarts(slotInBusinessZone.startOf("day"), settings, durationHours);

  if (!advertisedStarts.some((candidate) => candidate.toMillis() === slotInBusinessZone.toMillis())) {
    if (slotInBusinessZone.minute !== 0) {
      throw createHttpError(400, "Choose an exact available appointment slot", "INVALID_APPOINTMENT_TIME");
    }
    throw createHttpError(
      400,
      "Choose an advertised appointment slot for this service",
      "UNSUPPORTED_APPOINTMENT_SLOT"
    );
  }
}

export function getServiceDurationHours(
  serviceId: string | undefined,
  settings: BusinessSettingsValue
) {
  if (!serviceId) {
    return settings.slotDurationHours;
  }

  return getServiceById(serviceId, settings)?.durationHours || settings.slotDurationHours;
}

export function getSlotEnd(
  slotStartAt: Date,
  settings: BusinessSettingsValue,
  durationHours: number
) {
  return getBusinessDateTime(slotStartAt, settings.timezone)
    .plus({ hours: durationHours })
    .toUTC()
    .toJSDate();
}

export function buildOccupiedSlotStarts(slotStartAt: Date, slotEndAt: Date) {
  const occupiedSlotStarts: Date[] = [];
  let cursor = DateTime.fromJSDate(slotStartAt, { zone: "utc" });
  const end = DateTime.fromJSDate(slotEndAt, { zone: "utc" });

  while (cursor < end) {
    occupiedSlotStarts.push(cursor.toJSDate());
    cursor = cursor.plus({ hours: 1 });
  }

  return occupiedSlotStarts;
}

export function getBookingDate(value: Date | string | undefined) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value : new Date(value);
}

export function getBookingInterval(booking: LeanBooking, settings: BusinessSettingsValue) {
  const start = getBookingDate(booking.appointmentAt);

  if (!start) {
    return undefined;
  }

  return {
    start,
    end:
      getBookingDate(booking.appointmentEndAt) ||
      getSlotEnd(
        start,
        settings,
        booking.serviceDurationHours || getServiceDurationHours(booking.serviceId, settings)
      )
  };
}

export function intervalsOverlap(leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date) {
  return leftStart.getTime() < rightEnd.getTime() && leftEnd.getTime() > rightStart.getTime();
}

function formatBusinessDay(value: Date, timezone: string) {
  return getBusinessDateTime(value, timezone).setLocale(config.NODE_ENV === "test" ? "en" : "sv").toLocaleString({
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function formatBusinessTime(value: Date, timezone: string) {
  return getBusinessDateTime(value, timezone)
    .setLocale(config.NODE_ENV === "test" ? "en" : "sv")
    .toLocaleString(config.NODE_ENV === "test" ? DateTime.TIME_SIMPLE : { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

export function formatBusinessAppointment(value: Date, timezone: string) {
  return getBusinessDateTime(value, timezone).toLocaleString({
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });
}

export function buildAppointmentWindowFilter(slotStartAt: Date, slotEndAt: Date) {
  return {
    appointmentAt: {
      $gte: DateTime.fromJSDate(slotStartAt, { zone: "utc" })
        .minus({ hours: 12 })
        .toJSDate(),
      $lt: slotEndAt
    }
  };
}

export function buildActiveAppointmentWindowFilter(
  slotStartAt: Date,
  slotEndAt: Date,
  currentBookingId?: string
) {
  const extraFilter: Record<string, unknown> = buildAppointmentWindowFilter(slotStartAt, slotEndAt);

  if (currentBookingId) {
    extraFilter._id = { $ne: currentBookingId };
  }

  return buildActiveBookingFilter(extraFilter);
}

export async function ensureSlotAvailable(
  slotStartAt: Date,
  settings: BusinessSettingsValue,
  durationHours: number,
  currentBookingId?: string
) {
  ensureAdvertisedSlotForDuration(slotStartAt, settings, durationHours);

  const earliestAllowed = DateTime.now().plus({ hours: settings.bookingRules.minimumNoticeHours });
  const latestAllowed = DateTime.now().setZone(settings.timezone).plus({ days: settings.bookingRules.bookingWindowDays }).endOf("day");
  const requested = DateTime.fromJSDate(slotStartAt, { zone: "utc" });

  if (requested < earliestAllowed) {
    throw createHttpError(409, "This appointment is inside the minimum booking notice", "BOOKING_NOTICE_REQUIRED");
  }
  if (requested > latestAllowed) {
    throw createHttpError(409, "This appointment is outside the booking window", "BOOKING_WINDOW_EXCEEDED");
  }

  if (slotStartAt.getTime() <= Date.now()) {
    throw createHttpError(409, "This appointment time has already passed", "SLOT_IN_PAST");
  }

  const slotEndAt = getSlotEnd(slotStartAt, settings, durationHours);
  await expireUnverifiedBookings(buildAppointmentWindowFilter(slotStartAt, slotEndAt));

  const busySlots = await AvailabilityOverride.find({
    slotStartAt: {
      $gte: DateTime.fromJSDate(slotStartAt, { zone: "utc" })
        .minus({ hours: 12 })
        .toJSDate(),
      $lt: slotEndAt
    }
  })
    .select("slotStartAt")
    .lean<{ slotStartAt: Date }[]>();
  const overlappingBusySlot = busySlots.find((slot) => {
    const busySlotEndAt = getSlotEnd(slot.slotStartAt, settings, settings.slotDurationHours);

    return intervalsOverlap(slotStartAt, slotEndAt, slot.slotStartAt, busySlotEndAt);
  });

  if (overlappingBusySlot) {
    throw createHttpError(409, "This appointment time is no longer available", "SLOT_BUSY");
  }

  const existingBookings = await Booking.find(
    buildActiveAppointmentWindowFilter(slotStartAt, slotEndAt, currentBookingId)
  )
    .select("_id serviceId serviceDurationHours appointmentAt appointmentEndAt")
    .lean<LeanBooking[]>();
  const overlappingBooking = existingBookings.find((booking) => {
    const interval = getBookingInterval(booking, settings);

    return interval && intervalsOverlap(slotStartAt, slotEndAt, interval.start, interval.end);
  });

  if (overlappingBooking) {
    throw createHttpError(409, "This appointment time is already booked", "SLOT_BOOKED");
  }
}

export async function buildAvailabilityDays(
  start: DateTime,
  days: number,
  settings: BusinessSettingsValue,
  serviceId?: string,
  includeBookingDetails = false
) {
  const rangeStart = start.startOf("day");
  const rangeEnd = rangeStart.plus({ days });
  const durationHours = getServiceDurationHours(serviceId, settings);

  const [busySlots, bookedSlots] = await Promise.all([
    AvailabilityOverride.find({
      slotStartAt: { $gte: rangeStart.toUTC().toJSDate(), $lt: rangeEnd.toUTC().toJSDate() }
    })
      .select("slotStartAt")
      .lean<{ slotStartAt: Date }[]>(),
    Booking.find({
      ...buildActiveBookingFilter({
        appointmentAt: {
          $gte: rangeStart.minus({ hours: 12 }).toUTC().toJSDate(),
          $lt: rangeEnd.toUTC().toJSDate()
        }
      })
    })
      .select(
        includeBookingDetails
          ? "_id name email phone serviceId serviceName serviceDurationHours appointmentAt appointmentEndAt status notes emailVerified emailVerifiedAt createdAt"
          : "_id serviceId serviceDurationHours appointmentAt appointmentEndAt"
      )
      .lean<LeanBooking[]>()
  ]);
  const bookedIntervals = bookedSlots
    .map((booking) => {
      const interval = getBookingInterval(booking, settings);

      return interval ? { booking, interval } : undefined;
    })
    .filter((entry): entry is { booking: LeanBooking; interval: { start: Date; end: Date } } =>
      Boolean(entry)
    );
  const busyIntervals = busySlots.map((slot) => ({
    start: slot.slotStartAt,
    end: getSlotEnd(slot.slotStartAt, settings, settings.slotDurationHours)
  }));
  const availabilityDays = [];
  const now = Date.now();

  for (let index = 0; index < days; index += 1) {
    const day = rangeStart.plus({ days: index });

    const daySchedule = settings.weeklySchedule.find((item) => item.weekday === day.weekday);
    const blackoutDay = isBlackoutDay(day, settings);
    const closedDay = !daySchedule?.enabled;
    if ((!daySchedule?.enabled && !includeBookingDetails) || (blackoutDay && !includeBookingDetails) || !daySchedule?.openings.length) {
      continue;
    }

    const dayStart = day.toUTC().toJSDate();

    availabilityDays.push({
      date: dayStart.toISOString(),
      dateLabel: formatBusinessDay(dayStart, settings.timezone),
      timezone: settings.timezone,
      slots: getAdvertisedSlotStarts(day, settings, durationHours, includeBookingDetails).map((slotDateTime) => {
        const slotStartAt = slotDateTime.toUTC().toJSDate();
        const slotEndAt = getSlotEnd(slotStartAt, settings, durationHours);
        const slotTime = slotStartAt.getTime();
        const bookedSlot = bookedIntervals.find(({ interval }) =>
          intervalsOverlap(slotStartAt, slotEndAt, interval.start, interval.end)
        )?.booking;
        const busySlot = busyIntervals.find((interval) =>
          intervalsOverlap(slotStartAt, slotEndAt, interval.start, interval.end)
        );
        const earliestAllowed = now + settings.bookingRules.minimumNoticeHours * 60 * 60 * 1000;
        const latestAllowed = DateTime.fromMillis(now).setZone(settings.timezone).plus({ days: settings.bookingRules.bookingWindowDays }).endOf("day").toMillis();
        const status =
          bookedSlot
            ? "booked"
            : busySlot || blackoutDay || closedDay
              ? "busy"
              : slotTime <= earliestAllowed || slotTime > latestAllowed
                ? "past"
                : "open";

        return {
          slotStartAt: slotStartAt.toISOString(),
          slotEndAt: slotEndAt.toISOString(),
          timeLabel: `${formatBusinessTime(slotStartAt, settings.timezone)} - ${formatBusinessTime(
            slotEndAt,
            settings.timezone
          )}`,
          status,
          isAvailable: status === "open",
          bookingId: bookedSlot ? String(bookedSlot._id) : undefined,
          booking:
            includeBookingDetails && bookedSlot
              ? {
                  _id: String(bookedSlot._id),
                  name: bookedSlot.name,
                  email: bookedSlot.email,
                  phone: bookedSlot.phone,
                  serviceId: bookedSlot.serviceId,
                  serviceName: bookedSlot.serviceName,
                  serviceDurationHours: bookedSlot.serviceDurationHours,
                  appointmentAt: getBookingDate(bookedSlot.appointmentAt)?.toISOString(),
                  appointmentEndAt: getBookingDate(bookedSlot.appointmentEndAt)?.toISOString(),
                  status: bookedSlot.status || "open",
                  notes: bookedSlot.notes,
                  emailVerified: Boolean(bookedSlot.emailVerified),
                  emailVerifiedAt: getBookingDate(bookedSlot.emailVerifiedAt)?.toISOString(),
                  createdAt: getBookingDate(bookedSlot.createdAt)?.toISOString()
                }
              : undefined
        };
      })
    });
  }

  return availabilityDays;
}
