import { ChevronLeft, ChevronRight, Eye, Lock, Mail, Phone, RefreshCw, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { AvailabilityDay, AvailabilitySlot } from "../../types";
import {
  CALENDAR_WEEK_DAYS,
  countDaySlots,
  formatDateTime,
  formatMobileDayName,
  formatMobileDayNumber,
  getSlotContext,
  getSlotLabel,
  getSlotTone,
  isPastBusinessDay,
  isToday
} from "./availabilityCalendarUtils";

export function CalendarCount({ label, tone, value }: { label: string; tone: string; value: number }) {
  return (
    <div className="classic-summary-box">
      <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${tone}`}>{label}</span>
      <strong>{value}</strong>
      <span>{label} tider</span>
    </div>
  );
}

export function MobileDayCalendar({
  days,
  pendingSlots,
  selectedDay,
  showPastSlots,
  canMoveToPreviousWeek,
  onCurrentWeek,
  onMoveWeek,
  onSelectBooked,
  onSelectDay,
  onShowPastSlotsChange,
  onToggle
}: {
  days: AvailabilityDay[];
  pendingSlots: Set<string>;
  selectedDay?: AvailabilityDay;
  showPastSlots: boolean;
  canMoveToPreviousWeek: boolean;
  onCurrentWeek: () => void;
  onMoveWeek: (days: number) => void;
  onSelectBooked: (slot: AvailabilitySlot) => void;
  onSelectDay: (dayDate: string) => void;
  onShowPastSlotsChange: (value: boolean) => void;
  onToggle: (slot: AvailabilitySlot) => void;
}) {
  if (!selectedDay) {
    return null;
  }

  const pastSlots = selectedDay.slots.filter((slot) => slot.status === "past");
  const selectedDayIsPast = isPastBusinessDay(selectedDay);
  const visibleSlots = showPastSlots
    ? selectedDay.slots
    : selectedDayIsPast
      ? selectedDay.slots
      : selectedDay.slots.filter((slot) => slot.status !== "past");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2">
        <button
          className="grid h-10 w-10 place-items-center rounded-xl border border-[#e1d8c5] bg-white text-[#5c4720] shadow-sm disabled:opacity-40"
          disabled={!canMoveToPreviousWeek}
          onClick={() => onMoveWeek(-CALENDAR_WEEK_DAYS)}
          type="button"
          aria-label="Previous week"
        >
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
        <button
          className="h-10 rounded-xl border border-[#3a3020] bg-[#171614] px-3 text-xs font-bold uppercase text-[#f1d48a] shadow-sm"
          onClick={onCurrentWeek}
          type="button"
        >
          This week
        </button>
        <button
          className="grid h-10 w-10 place-items-center rounded-xl border border-[#e1d8c5] bg-white text-[#5c4720] shadow-sm"
          onClick={() => onMoveWeek(CALENDAR_WEEK_DAYS)}
          type="button"
          aria-label="Next week"
        >
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {days.map((day) => {
          const dayCounts = countDaySlots(day);
          const selected = selectedDay.date === day.date;
          const today = isToday(day);

          return (
            <button
              key={day.date}
              className={`min-h-[82px] rounded-xl border px-1.5 py-2 text-center shadow-sm transition ${
                selected
                  ? "border-[#171614] bg-[#171614] text-white"
                  : today
                    ? "border-[#d6b46a] bg-white text-[#5c4720]"
                    : "border-[#e1d8c5] bg-white text-[#746d61]"
              }`}
              onClick={() => onSelectDay(day.date)}
              type="button"
            >
              <span className="block text-[11px] font-bold uppercase">
                {formatMobileDayName(day.date, day.timezone)}
              </span>
              <span
                className={`mx-auto mt-1 grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${
                  selected
                    ? "bg-[#d6b46a] text-[#171614]"
                    : today
                      ? "bg-[#d6b46a] text-[#171614]"
                      : "bg-[#f4f0e6] text-[#171614]"
                }`}
              >
                {formatMobileDayNumber(day.date, day.timezone)}
              </span>
              <span
                className={`mx-auto mt-1.5 inline-flex min-w-8 justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  selected
                    ? "bg-white/10 text-[#f1d48a]"
                    : dayCounts.open > 0
                      ? "bg-[#fbf2d9] text-[#5c4720]"
                      : "bg-[#f4f0e6] text-[#a8a197]"
                }`}
              >
                {dayCounts.open} open
              </span>
            </button>
          );
        })}
      </div>

      {pastSlots.length > 0 && !selectedDayIsPast && (
        <div className="flex justify-end px-0.5">
          <button
            className="rounded-full border border-[#e1d8c5] bg-white px-3 py-1 text-xs font-bold text-[#746d61]"
            onClick={() => onShowPastSlotsChange(!showPastSlots)}
            type="button"
          >
            {showPastSlots ? "Hide past" : "Show past"}
          </button>
        </div>
      )}

      <MobileDayTimeline
        pendingSlots={pendingSlots}
        slots={visibleSlots}
        onSelectBooked={onSelectBooked}
        onToggle={onToggle}
      />
    </div>
  );
}

export function MobileDayTimeline({
  pendingSlots,
  slots,
  onSelectBooked,
  onToggle
}: {
  pendingSlots: Set<string>;
  slots: AvailabilitySlot[];
  onSelectBooked: (slot: AvailabilitySlot) => void;
  onToggle: (slot: AvailabilitySlot) => void;
}) {
  return (
    <section className="rounded-xl border border-[#e1d8c5] bg-white p-2.5 shadow-sm">
      {slots.length === 0 ? (
        <p className="px-2 py-8 text-center text-sm font-semibold text-[#746d61]">
          No slots on this day.
        </p>
      ) : (
        <div className="space-y-2">
          {slots.map((slot) => (
            <MobileTimelineSlot
              key={slot.slotStartAt}
              isPending={pendingSlots.has(slot.slotStartAt)}
              slot={slot}
              onSelectBooked={onSelectBooked}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function getMobileSlotClasses(slot: AvailabilitySlot) {
  if (slot.status === "booked") {
    return "border-emerald-600 bg-emerald-600 text-white shadow-[inset_4px_0_0_#047857]";
  }

  if (slot.status === "busy") {
    return "border-[#d6b46a] bg-[#fbf2d9] text-[#5c4720] shadow-[inset_4px_0_0_#d6b46a]";
  }

  if (slot.status === "past") {
    return "border-[#e8dcc2] bg-[#f7f3ea] text-[#a8a197]";
  }

  return "border-[#e1d8c5] bg-white text-[#171614] shadow-[inset_4px_0_0_#d6b46a]";
}

export function MobileTimelineSlot({
  isPending,
  slot,
  onSelectBooked,
  onToggle
}: {
  isPending: boolean;
  slot: AvailabilitySlot;
  onSelectBooked: (slot: AvailabilitySlot) => void;
  onToggle: (slot: AvailabilitySlot) => void;
}) {
  const isBooked = slot.status === "booked";
  const isBusy = slot.status === "busy";
  const isPast = slot.status === "past";
  const actionLabel = isBooked ? "Details" : isBusy ? "Reopen" : isPast ? "Passed" : "Block";
  const actionIcon = isBooked ? Eye : isBusy ? RefreshCw : isPast ? Lock : X;
  const ActionIcon = actionIcon;
  const [startLabel, endLabel] = slot.timeLabel.split(" - ");

  return (
    <div className="grid grid-cols-[54px_minmax(0,1fr)] gap-2.5">
      <div className="pt-3 text-right">
        <span className="block text-xs font-bold text-[#5c4720]">{startLabel}</span>
        {endLabel && <span className="block text-[10px] font-semibold text-[#a8a197]">{endLabel}</span>}
      </div>
      <button
        className={`min-h-[74px] rounded-xl border p-3 text-left shadow-sm transition ${getMobileSlotClasses(
          slot
        )} disabled:opacity-70`}
        disabled={isPending || isPast}
        onClick={() => {
          if (isBooked) {
            onSelectBooked(slot);
            return;
          }

          onToggle(slot);
        }}
        type="button"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-xs font-bold uppercase opacity-80">{getSlotLabel(slot)}</span>
            <span className="mt-1 block truncate text-sm font-bold">
              {slot.booking?.name || getSlotContext(slot) || (isBusy ? "Owner unavailable" : "Available")}
            </span>
            {slot.booking?.serviceName && (
              <span className="mt-0.5 block truncate text-xs font-semibold opacity-80">
                {slot.booking.serviceName}
              </span>
            )}
            {isPending && (
              <span className="mt-1 block text-xs font-bold opacity-75">Updating...</span>
            )}
          </span>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${
            isBooked ? "bg-white/20 text-white" : "bg-[#171614]/5 text-inherit"
          }`}>
            <ActionIcon size={13} aria-hidden="true" />
            {actionLabel}
          </span>
        </span>
      </button>
    </div>
  );
}

export function DayBulkControls({
  day,
  onBulkDay
}: {
  day: AvailabilityDay;
  onBulkDay: (day: AvailabilityDay, status: "open" | "busy") => void;
}) {
  const openCount = day.slots.filter((slot) => slot.status === "open").length;
  const busyCount = day.slots.filter((slot) => slot.status === "busy").length;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      <button
        className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800 transition hover:border-amber-400 disabled:opacity-45"
        disabled={openCount === 0}
        onClick={() => onBulkDay(day, "busy")}
        type="button"
      >
        Stäng dagen
      </button>
      <button
        className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs font-bold text-emerald-700 transition hover:border-emerald-400 disabled:opacity-45"
        disabled={busyCount === 0}
        onClick={() => onBulkDay(day, "open")}
        type="button"
      >
        Öppna igen
      </button>
    </div>
  );
}

export function DayPanel({
  day,
  pendingSlots,
  onBulkDay,
  onSelectBooked,
  onToggle
}: {
  day: AvailabilityDay;
  pendingSlots: Set<string>;
  onBulkDay: (day: AvailabilityDay, status: "open" | "busy") => void;
  onSelectBooked: (slot: AvailabilitySlot) => void;
  onToggle: (slot: AvailabilitySlot) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 p-3">
        <div className="text-sm font-bold text-ink">{day.dateLabel}</div>
        <DayBulkControls day={day} onBulkDay={onBulkDay} />
      </div>
      <div className="grid gap-2 p-3">
        {day.slots.map((slot) => {
          const isPending = pendingSlots.has(slot.slotStartAt);

          return (
            <button
              key={slot.slotStartAt}
              className={`rounded-lg border p-3 text-left transition ${getSlotTone(
                slot
              )} disabled:opacity-70`}
              disabled={isPending || slot.status === "past"}
              onClick={() => {
                if (slot.status === "booked") {
                  onSelectBooked(slot);
                  return;
                }

                onToggle(slot);
              }}
              type="button"
            >
              <span className="flex items-center justify-between gap-2 text-xs font-bold uppercase">
                {getSlotLabel(slot)}
                {slot.status === "booked" && <Lock size={13} aria-hidden="true" />}
              </span>
              <strong className="mt-2 block text-sm">{slot.booking?.name || slot.timeLabel}</strong>
              {getSlotContext(slot) && (
                <span className="mt-1 block text-xs font-semibold opacity-75">
                  {getSlotContext(slot)}
                </span>
              )}
              {isPending && <span className="mt-2 block text-xs font-bold opacity-75">Updating...</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-3 w-3 rounded border ${className}`} />
      {label}
    </span>
  );
}

export function BookingDrawer({ onClose, slot }: { onClose: () => void; slot: AvailabilitySlot }) {
  const booking = slot.booking;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();

      if (event.key === "Tab") {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ) || []
        );
        const first = focusable[0];
        const last = focusable.at(-1);

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 p-4" role="presentation" onMouseDown={onClose}>
      <aside
        aria-labelledby="booking-drawer-title"
        aria-modal="true"
        className="ml-auto flex h-full w-full max-w-md flex-col rounded-lg bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <span className="text-xs font-bold uppercase text-blue-700">Booked slot</span>
            <h3 id="booking-drawer-title" className="mt-1 text-xl font-bold text-ink">{booking?.name || "Booking details"}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">{formatDateTime(slot.slotStartAt)}</p>
          </div>
          <button
            aria-label="Close booking details"
            className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <DetailBlock label="Service" value={booking?.serviceName || "Not available"} />
          <DetailBlock label="Time" value={`${formatDateTime(slot.slotStartAt)} - ${formatDateTime(slot.slotEndAt)}`} />
          <DetailBlock
            label="Email verification"
            value={booking?.emailVerified ? "Verified" : "Not verified"}
          />
          <DetailBlock label="Notes" value={booking?.notes || "No notes"} />

          <div className="grid gap-3">
            {booking?.email && (
              <a className="classic-button justify-center" href={`mailto:${booking.email}`}>
                <Mail size={16} aria-hidden="true" />
                {booking.email}
              </a>
            )}
            {booking?.phone && (
              <a className="classic-button justify-center" href={`tel:${booking.phone}`}>
                <Phone size={16} aria-hidden="true" />
                {booking.phone}
              </a>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

export function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <span className="text-xs font-bold uppercase text-slate-500">{label}</span>
      <p className="mt-1 text-sm font-bold text-ink">{value}</p>
    </div>
  );
}
