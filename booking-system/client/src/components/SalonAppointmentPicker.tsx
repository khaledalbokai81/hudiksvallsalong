import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AvailabilityDay, AvailabilitySlot } from "../types";

type Props = {
  days: AvailabilityDay[];
  value?: string;
  disabled?: boolean;
  onSelect: (slotStartAt: string) => void;
};

const weekdays = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function dateKey(value: string) {
  return dateFormatter.format(new Date(value));
}

function monthFromKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function sameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function getCalendarCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const offset = (first.getDay() + 6) % 7;
  const cells: Array<{ key: string; day: number } | null> = Array.from({ length: offset }, () => null);

  for (let day = 1; day <= last.getDate(); day += 1) {
    const current = new Date(month.getFullYear(), month.getMonth(), day);
    cells.push({
      key: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      day
    });
  }

  while (cells.length % 7) cells.push(null);
  return cells;
}

function startTime(slot: AvailabilitySlot) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(slot.slotStartAt));
}

export function SalonAppointmentPicker({ days, value, disabled, onSelect }: Props) {
  const currentMonth = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }, []);
  const nextMonth = useMemo(
    () => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    [currentMonth]
  );
  const dayMap = useMemo(
    () => new Map(days
      .map((day) => [dateKey(day.slots[0]?.slotStartAt || day.date), day] as const)
      .filter(([key]) => {
        const itemMonth = monthFromKey(key);
        return sameMonth(itemMonth, currentMonth) || sameMonth(itemMonth, nextMonth);
      })),
    [currentMonth, days, nextMonth]
  );
  const selectedDateKey = value ? dateKey(value) : "";
  const firstMonth = useMemo(
    () => {
      const selectedMonth = selectedDateKey ? monthFromKey(selectedDateKey) : currentMonth;
      return sameMonth(selectedMonth, nextMonth) ? nextMonth : currentMonth;
    },
    [currentMonth, nextMonth, selectedDateKey]
  );
  const [month, setMonth] = useState(firstMonth);
  const [chosenDate, setChosenDate] = useState(selectedDateKey);
  const [period, setPeriod] = useState<"morning" | "afternoon">("morning");

  useEffect(() => {
    if (!selectedDateKey) return;
    setChosenDate(selectedDateKey);
    const selectedMonth = monthFromKey(selectedDateKey);
    setMonth(sameMonth(selectedMonth, nextMonth) ? nextMonth : currentMonth);
    const hour = Number(startTime({ slotStartAt: value!, slotEndAt: "", timeLabel: "", status: "open", isAvailable: true }).slice(0, 2));
    setPeriod(hour < 13 ? "morning" : "afternoon");
  }, [currentMonth, nextMonth, selectedDateKey, value]);

  const availableMonths = useMemo(() => [currentMonth, nextMonth], [currentMonth, nextMonth]);
  const currentMonthIndex = availableMonths.findIndex((item) => sameMonth(item, month));
  const calendarCells = useMemo(() => getCalendarCells(month), [month]);
  const selectedDay = dayMap.get(chosenDate);
  const visibleSlots = (selectedDay?.slots || []).filter((slot) => {
    const hour = Number(startTime(slot).slice(0, 2));
    return (period === "morning" ? hour < 13 : hour >= 13) && (slot.isAvailable || slot.slotStartAt === value);
  });
  const counts = {
    morning: (selectedDay?.slots || []).filter((slot) => Number(startTime(slot).slice(0, 2)) < 13 && slot.isAvailable).length,
    afternoon: (selectedDay?.slots || []).filter((slot) => Number(startTime(slot).slice(0, 2)) >= 13 && slot.isAvailable).length
  };

  return (
    <div className="salon-appointment-picker">
      <div className="salon-picker-calendar">
        <div className="salon-picker-month">
          <button
            type="button"
            aria-label="Föregående månad"
            disabled={disabled || currentMonthIndex <= 0}
            onClick={() => setMonth(availableMonths[currentMonthIndex - 1])}
          >
            <ChevronLeft size={18} />
          </button>
          <strong>{new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" }).format(month)}</strong>
          <button
            type="button"
            aria-label="Nästa månad"
            disabled={disabled || currentMonthIndex < 0 || currentMonthIndex >= availableMonths.length - 1}
            onClick={() => setMonth(availableMonths[currentMonthIndex + 1])}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="salon-picker-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="salon-picker-days">
          {calendarCells.map((cell, index) => {
            if (!cell) return <span key={`empty-${index}`} />;
            const availability = dayMap.get(cell.key);
            const canChoose = Boolean(availability?.slots.some((slot) => slot.isAvailable || slot.slotStartAt === value));
            return (
              <button
                type="button"
                key={cell.key}
                disabled={disabled || !canChoose}
                className={chosenDate === cell.key ? "selected" : ""}
                onClick={() => {
                  setChosenDate(cell.key);
                  const firstOpen = availability?.slots.find((slot) => slot.isAvailable);
                  if (firstOpen) setPeriod(Number(startTime(firstOpen).slice(0, 2)) < 13 ? "morning" : "afternoon");
                }}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>

      <div className="salon-picker-times">
        <div className="salon-picker-periods">
          {(["morning", "afternoon"] as const).map((item) => (
            <button type="button" className={period === item ? "active" : ""} onClick={() => setPeriod(item)} key={item}>
              <span>{item === "morning" ? "Förmiddag" : "Eftermiddag"}</span>
              <small>{counts[item]} lediga</small>
            </button>
          ))}
        </div>
        <div className="salon-picker-time-intro">
          <span>{period === "morning" ? "☼" : "◐"}</span>
          <div>
            <strong>{chosenDate ? "Välj en tid" : "Välj först en dag"}</strong>
            <small>{chosenDate ? "Tiderna visas i svensk tid" : "Lediga dagar är markerade i kalendern"}</small>
          </div>
        </div>
        <div className="salon-picker-time-grid">
          {visibleSlots.map((slot) => (
            <button
              type="button"
              key={slot.slotStartAt}
              disabled={disabled || (!slot.isAvailable && slot.slotStartAt !== value)}
              className={slot.slotStartAt === value ? "selected" : ""}
              onClick={() => onSelect(slot.slotStartAt)}
            >
              <small>{slot.slotStartAt === value ? "Vald" : "Ledig"}</small>
              <strong>{startTime(slot)}</strong>
              <span>{slot.slotStartAt === value ? "✓" : ""}</span>
            </button>
          ))}
          {chosenDate && visibleSlots.length === 0 && <p>Inga lediga tider under den här delen av dagen.</p>}
        </div>
      </div>
    </div>
  );
}
