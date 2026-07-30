import type { AvailabilityDay, AvailabilitySlot } from "../../types";

export const CALENDAR_WEEK_DAYS = 7;
const MAX_PAST_WEEKS = 1;

export function toDateInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getWeekStart(date: Date) {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(startOfLocalDay(date), mondayOffset);
}

export function getMinimumWeekStart() {
  return addDays(getWeekStart(new Date()), -MAX_PAST_WEEKS * CALENDAR_WEEK_DAYS);
}

export function clampWeekStart(date: Date) {
  const weekStart = getWeekStart(date);
  const minimumWeekStart = getMinimumWeekStart();

  return weekStart.getTime() < minimumWeekStart.getTime() ? minimumWeekStart : weekStart;
}

export function formatRangeLabel(start: Date, days: number) {
  const end = addDays(start, days - 1);
  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

export function formatDateTime(value?: string) {
  if (!value) return "Inte schemalagd";

  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function getBusinessDateKey(value: Date | string, timezone?: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function isToday(day: AvailabilityDay) {
  return getBusinessDateKey(day.date, day.timezone) === getBusinessDateKey(new Date(), day.timezone);
}

export function isPastBusinessDay(day: AvailabilityDay) {
  return getBusinessDateKey(day.date, day.timezone) < getBusinessDateKey(new Date(), day.timezone);
}

export function formatMobileDateLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(date);
}

export function formatMobileDayName(value: Date | string, timezone?: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    weekday: "short"
  }).format(new Date(value));
}

export function formatMobileDayNumber(value: Date | string, timezone?: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    day: "numeric"
  }).format(new Date(value));
}

export function buildMobileWeekDays(weekStart: Date, availabilityDays: AvailabilityDay[]) {
  const timezone =
    availabilityDays[0]?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const daysByKey = new Map(
    availabilityDays.map((day) => [getBusinessDateKey(day.date, day.timezone), day])
  );

  return Array.from({ length: CALENDAR_WEEK_DAYS }, (_, index) => addDays(weekStart, index))
    .filter((date) => {
      const day = date.getDay();
      return day !== 0 && day !== 6;
    })
    .map((date) => {
      const key = toDateInputValue(date);

      return (
        daysByKey.get(key) || {
          date: date.toISOString(),
          dateLabel: formatMobileDateLabel(date),
          timezone,
          slots: []
        }
      );
    });
}

export function getSlotTone(slot: AvailabilitySlot) {
  if (slot.status === "booked") {
    return "border-emerald-500 bg-emerald-100 text-emerald-950 shadow-[inset_4px_0_0_#059669] hover:border-emerald-700 hover:bg-emerald-200";
  }

  if (slot.status === "busy") {
    return "border-amber-500 bg-amber-100 text-amber-950 shadow-[inset_4px_0_0_#d97706] hover:border-amber-700 hover:bg-amber-200";
  }

  if (slot.status === "past") {
    return "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300";
  }

  return "border-slate-200 bg-white text-slate-500 hover:border-emerald-400 hover:bg-emerald-50 hover:text-ink";
}

export function getSlotLabel(slot: AvailabilitySlot) {
  if (slot.status === "booked") return "Bokad";
  if (slot.status === "busy") return "Stängd";
  if (slot.status === "past") return "Passerad";
  return "Ledig";
}

export function isBookingStart(slot: AvailabilitySlot) {
  if (!slot.booking?.appointmentAt) {
    return false;
  }

  return new Date(slot.booking.appointmentAt).getTime() === new Date(slot.slotStartAt).getTime();
}

export function getSlotContext(slot: AvailabilitySlot) {
  if (!slot.booking) {
    return slot.status === "busy" ? "Salongen är stängd" : undefined;
  }

  const serviceName = slot.booking.serviceName || "Bokning";
  const duration = slot.booking.serviceDurationHours
    ? `${slot.booking.serviceDurationHours} h behandling`
    : undefined;

  if (isBookingStart(slot)) {
    return duration ? `${serviceName} - ${duration}` : serviceName;
  }

  return duration ? `Upptagen av ${serviceName} – ${duration}` : `Upptagen av ${serviceName}`;
}

export function countSlots(days: AvailabilityDay[]) {
  return days.reduce(
    (counts, day) => {
      for (const slot of day.slots) {
        counts[slot.status] += 1;
      }

      return counts;
    },
    { open: 0, booked: 0, busy: 0, past: 0 }
  );
}

export function countDaySlots(day: AvailabilityDay) {
  return day.slots.reduce(
    (counts, slot) => {
      counts[slot.status] += 1;
      return counts;
    },
    { open: 0, booked: 0, busy: 0, past: 0 }
  );
}
