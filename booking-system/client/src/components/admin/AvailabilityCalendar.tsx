import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  Eye,
  X
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAvailability, setAvailabilitySlot, setAvailabilitySlots } from "../../api";
import type { AvailabilityDay, AvailabilitySlot } from "../../types";
import {
  CALENDAR_WEEK_DAYS,
  addDays,
  buildMobileWeekDays,
  clampWeekStart,
  countDaySlots,
  countSlots,
  formatDateTime,
  formatMobileDayName,
  formatMobileDayNumber,
  formatRangeLabel,
  getMinimumWeekStart,
  getSlotContext,
  getSlotLabel,
  getSlotTone,
  isPastBusinessDay,
  isToday,
  toDateInputValue
} from "./availabilityCalendarUtils";
import {
  BookingDrawer,
  CalendarCount,
  DayBulkControls,
  LegendItem,
  MobileDayCalendar
} from "./AvailabilityCalendarParts";

export function AvailabilityCalendar() {
  const [availabilityDays, setAvailabilityDays] = useState<AvailabilityDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => clampWeekStart(new Date()));
  const [pendingSlots, setPendingSlots] = useState<Set<string>>(() => new Set());
  const [selectedMobileDayDate, setSelectedMobileDayDate] = useState<string>();
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot>();
  const [showPastMobileSlots, setShowPastMobileSlots] = useState(false);
  const [message, setMessage] = useState("");
  const loadRequestId = useRef(0);

  const counts = useMemo(() => countSlots(availabilityDays), [availabilityDays]);
  const timeRows = useMemo(
    () =>
      Array.from(
        new Set(
          availabilityDays.flatMap((day) =>
            day.slots.map((slot) => slot.timeLabel)
          )
        )
      ).sort((left, right) => {
        const leftSlot = availabilityDays.flatMap((day) => day.slots).find((slot) => slot.timeLabel === left);
        const rightSlot = availabilityDays.flatMap((day) => day.slots).find((slot) => slot.timeLabel === right);

        return (
          new Date(leftSlot?.slotStartAt || 0).getUTCHours() * 60 +
          new Date(leftSlot?.slotStartAt || 0).getUTCMinutes() -
          (new Date(rightSlot?.slotStartAt || 0).getUTCHours() * 60 +
            new Date(rightSlot?.slotStartAt || 0).getUTCMinutes())
        );
      }),
    [availabilityDays]
  );
  const mobileWeekDays = useMemo(
    () => buildMobileWeekDays(weekStart, availabilityDays),
    [availabilityDays, weekStart]
  );
  const selectedMobileDay =
    mobileWeekDays.find((day) => day.date === selectedMobileDayDate) || mobileWeekDays[0];
  const minimumWeekStart = getMinimumWeekStart();
  const canMoveToPreviousWeek = weekStart.getTime() > minimumWeekStart.getTime();

  async function loadAvailability(start = weekStart) {
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setMessage("");

    try {
      const response = await getAvailability(CALENDAR_WEEK_DAYS, undefined, {
        start: toDateInputValue(start)
      });
      if (requestId !== loadRequestId.current) return;

      setAvailabilityDays(response.days);
      setSelectedMobileDayDate((current) =>
        current
          ? current
          : response.days[0]?.date
      );
      setShowPastMobileSlots(false);
    } catch (error) {
      if (requestId === loadRequestId.current) {
        setMessage(error instanceof Error ? error.message : "Could not load availability.");
      }
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    void loadAvailability(weekStart);
  }, [weekStart]);

  async function handleToggle(slot: AvailabilitySlot) {
    if (slot.status === "past" || slot.status === "booked") {
      return;
    }

    const nextStatus = slot.status === "busy" ? "open" : "busy";
    const confirmed = window.confirm(
      nextStatus === "busy"
        ? `Mark ${slot.timeLabel} as busy?`
        : `Reopen ${slot.timeLabel}?`
    );

    if (!confirmed) {
      return;
    }

    setPendingSlots((current) => new Set(current).add(slot.slotStartAt));
    setMessage("");

    try {
      await setAvailabilitySlot(slot.slotStartAt, nextStatus);
      await loadAvailability();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update this slot.");
    } finally {
      setPendingSlots((current) => {
        const next = new Set(current);
        next.delete(slot.slotStartAt);
        return next;
      });
    }
  }

  async function handleBulkDay(day: AvailabilityDay, status: "open" | "busy") {
    const eligibleSlots = day.slots.filter((slot) =>
      status === "busy" ? slot.status === "open" : slot.status === "busy"
    );

    if (eligibleSlots.length === 0) {
      setMessage(status === "busy" ? "No open slots to block." : "No busy slots to reopen.");
      return;
    }

    const confirmed = window.confirm(
      status === "busy"
        ? `Block ${eligibleSlots.length} open slots on ${day.dateLabel}?`
        : `Reopen ${eligibleSlots.length} busy slots on ${day.dateLabel}?`
    );

    if (!confirmed) {
      return;
    }

    setPendingSlots((current) => {
      const next = new Set(current);
      eligibleSlots.forEach((slot) => next.add(slot.slotStartAt));
      return next;
    });
    setMessage("");

    try {
      await setAvailabilitySlots(eligibleSlots.map((slot) => slot.slotStartAt), status);
      await loadAvailability();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update day availability.");
    } finally {
      setPendingSlots((current) => {
        const next = new Set(current);
        eligibleSlots.forEach((slot) => next.delete(slot.slotStartAt));
        return next;
      });
    }
  }

  function findSlot(day: AvailabilityDay, timeLabel: string) {
    return day.slots.find((slot) => slot.timeLabel === timeLabel);
  }

  const moveRange = useCallback((days: number) => {
    setWeekStart((current) => clampWeekStart(addDays(current, days)));
  }, []);

  const goToCurrentWeek = useCallback(() => {
    setWeekStart(clampWeekStart(new Date()));
  }, []);

  useEffect(() => {
    function handleCalendarShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (isEditableTarget || !event.altKey) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveRange(-CALENDAR_WEEK_DAYS);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveRange(CALENDAR_WEEK_DAYS);
      }

      if (event.key === "Home") {
        event.preventDefault();
        goToCurrentWeek();
      }
    }

    window.addEventListener("keydown", handleCalendarShortcut);

    return () => window.removeEventListener("keydown", handleCalendarShortcut);
  }, [goToCurrentWeek, moveRange]);

  return (
    <section className="admin-availability">
      <div className="hidden flex-col gap-4 lg:flex xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-aqua text-ink">
            <CalendarDays size={21} aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-bold text-ink">Bokningskalender</h2>
            <p className="text-sm text-slate-500">
              {formatRangeLabel(weekStart, CALENDAR_WEEK_DAYS)}. Stäng lediga tider eller öppna bokningar för mer information.
            </p>
          </div>
        </div>

        <div className="hidden flex-wrap items-center gap-2 lg:flex">
          <button
            className="classic-button"
            disabled={!canMoveToPreviousWeek}
            onClick={() => moveRange(-CALENDAR_WEEK_DAYS)}
            type="button"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Föregående
          </button>
          <button
            className="classic-button"
            onClick={goToCurrentWeek}
            type="button"
          >
            Denna vecka
          </button>
          <button className="classic-button" onClick={() => moveRange(CALENDAR_WEEK_DAYS)} type="button">
            Nästa
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <input
            aria-label="Välj kalendervecka"
            className="field-input w-auto min-w-40"
            min={toDateInputValue(minimumWeekStart)}
            onChange={(event) => setWeekStart(clampWeekStart(new Date(`${event.target.value}T00:00:00`)))}
            type="date"
            value={toDateInputValue(weekStart)}
          />
          <button
            className="classic-button"
            disabled={loading}
            onClick={() => void loadAvailability()}
            type="button"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
            Uppdatera
          </button>
        </div>
      </div>

      <div className="classic-summary-grid mt-5 hidden lg:grid">
        <CalendarCount label="Lediga" tone="bg-emerald-50 text-emerald-700" value={counts.open} />
        <CalendarCount label="Bokade" tone="bg-emerald-50 text-emerald-700" value={counts.booked} />
        <CalendarCount label="Stängda" tone="bg-amber-50 text-amber-700" value={counts.busy} />
        <CalendarCount label="Passerade" tone="bg-slate-100 text-slate-500" value={counts.past} />
      </div>

      <div className="mt-4 hidden flex-wrap gap-2 text-xs font-bold text-slate-600 lg:flex">
        <LegendItem label="Ledig" className="border-emerald-200 bg-white" />
        <LegendItem label="Bokad" className="border-emerald-300 bg-emerald-100" />
        <LegendItem label="Stängd" className="border-amber-300 bg-amber-50" />
        <LegendItem label="Passerad" className="border-slate-200 bg-slate-100" />
      </div>

      <div className="mt-2 lg:mt-5">
        {loading ? (
          <div className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            Hämtar kalendern...
          </div>
        ) : availabilityDays.length === 0 ? (
          <>
            <div className="lg:hidden">
              <MobileDayCalendar
                days={mobileWeekDays}
                pendingSlots={pendingSlots}
                selectedDay={selectedMobileDay}
                showPastSlots={showPastMobileSlots}
                canMoveToPreviousWeek={canMoveToPreviousWeek}
                onCurrentWeek={goToCurrentWeek}
                onMoveWeek={moveRange}
                onSelectBooked={setSelectedSlot}
                onSelectDay={(dayDate) => {
                  setSelectedMobileDayDate(dayDate);
                  setShowPastMobileSlots(false);
                }}
                onShowPastSlotsChange={setShowPastMobileSlots}
                onToggle={handleToggle}
              />
            </div>
            <div className="hidden rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500 lg:block">
              Inga öppetdagar finns i det här intervallet.
            </div>
          </>
        ) : (
          <>
          <div className="lg:hidden">
            <MobileDayCalendar
              days={mobileWeekDays}
              pendingSlots={pendingSlots}
              selectedDay={selectedMobileDay}
              showPastSlots={showPastMobileSlots}
              canMoveToPreviousWeek={canMoveToPreviousWeek}
              onCurrentWeek={goToCurrentWeek}
              onMoveWeek={moveRange}
              onSelectBooked={setSelectedSlot}
              onSelectDay={(dayDate) => {
                setSelectedMobileDayDate(dayDate);
                setShowPastMobileSlots(false);
              }}
              onShowPastSlotsChange={setShowPastMobileSlots}
              onToggle={handleToggle}
            />
          </div>

          <div className="hidden max-h-[72vh] overflow-auto rounded-lg border border-slate-200 bg-white lg:block">
            <div
              className="grid min-w-[900px]"
              style={{ gridTemplateColumns: `104px repeat(${availabilityDays.length}, minmax(132px, 1fr))` }}
            >
              <div className="sticky left-0 top-0 z-20 border-b border-r border-slate-200 bg-slate-50 p-3 text-xs font-bold uppercase text-slate-500">
                Tid
              </div>
              {availabilityDays.map((day) => {
                const today = isToday(day);

                return (
                  <div
                    key={day.date}
                    className={`sticky top-0 z-10 border-b border-r p-3 text-sm font-bold ${
                      today
                        ? "border-blue-300 bg-blue-50 text-blue-950 shadow-[inset_0_3px_0_#2563eb]"
                        : "border-slate-200 bg-slate-50 text-ink"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{day.dateLabel}</span>
                      {today && (
                        <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          Idag
                        </span>
                      )}
                    </div>
                    <DayBulkControls day={day} onBulkDay={handleBulkDay} />
                  </div>
                );
              })}

              {timeRows.map((timeLabel) => (
                <Fragment key={timeLabel}>
                  <div
                    className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white p-3 text-xs font-bold text-slate-500"
                  >
                    {timeLabel.split(" - ")[0]}
                  </div>
                  {availabilityDays.map((day) => {
                    const slot = findSlot(day, timeLabel);
                    const today = isToday(day);

                    if (!slot) {
                      return (
                        <div
                          key={`${day.date}-${timeLabel}-empty`}
                          className={`min-h-20 border-b border-r border-slate-200 ${
                            today ? "bg-blue-50/40" : "bg-slate-50/40"
                          }`}
                        />
                      );
                    }

                    const isPending = pendingSlots.has(slot.slotStartAt);

                    return (
                      <button
                        key={slot.slotStartAt}
                        className={`min-h-20 border-b border-r p-3 text-left transition ${getSlotTone(
                          slot
                        )} ${today ? "ring-1 ring-inset ring-blue-100" : ""} disabled:opacity-70`}
                        disabled={isPending || slot.status === "past"}
                        onClick={() => {
                          if (slot.status === "booked") {
                            setSelectedSlot(slot);
                            return;
                          }

                          void handleToggle(slot);
                        }}
                        type="button"
                      >
                        <span className="flex items-center justify-between gap-2 text-xs font-bold uppercase">
                          {getSlotLabel(slot)}
                          {slot.status === "booked" && <Lock size={13} aria-hidden="true" />}
                        </span>
                        <strong className="mt-2 block text-sm">
                          {slot.booking?.name || slot.timeLabel}
                        </strong>
                        {getSlotContext(slot) && (
                          <span className="mt-1 block truncate text-xs font-semibold opacity-75">
                            {getSlotContext(slot)}
                          </span>
                        )}
                        {isPending && (
                          <span className="mt-2 block text-xs font-bold opacity-75">Updating...</span>
                        )}
                      </button>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
          </>
        )}

        {message && (
          <div
            aria-live="polite"
            className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
            role="status"
          >
            {message}
          </div>
        )}
      </div>

      {selectedSlot && (
        <BookingDrawer slot={selectedSlot} onClose={() => setSelectedSlot(undefined)} />
      )}
    </section>
  );
}
