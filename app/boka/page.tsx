"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { InteractiveMap } from "../components/interactive-map";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";

type Service = {
  id: string;
  name: string;
  price: string;
  duration: string;
};

type AvailabilitySlot = {
  slotStartAt: string;
  slotEndAt: string;
  timeLabel: string;
  status: string;
  isAvailable: boolean;
};

type AvailabilityDay = {
  date: string;
  dateLabel: string;
  timezone: string;
  slots: AvailabilitySlot[];
};

type TimeSlot = {
  time: string;
  period: "morning" | "afternoon";
  available: boolean;
  appointmentAt: string;
};

const fallbackServices: Service[] = [
  { id: "herrklippning", name: "Herrklippning", price: "300 kr", duration: "45 min" },
  { id: "skaggtrimning", name: "Skäggtrimning", price: "200 kr", duration: "30 min" },
  { id: "har-skagg", name: "Hår + skägg", price: "400 kr", duration: "60 min" },
  { id: "barnklippning", name: "Barnklippning", price: "250 kr", duration: "30 min" },
  { id: "pensionarsklippning", name: "Pensionärsklippning", price: "250 kr", duration: "30 min" },
  { id: "maskinklippning", name: "Maskinklippning", price: "200 kr", duration: "30 min" },
  { id: "tvatt-styling", name: "Tvätt & styling", price: "150 kr", duration: "30 min" },
  { id: "konturtrimning", name: "Konturtrimning", price: "150 kr", duration: "20 min" },
];

const timeGroups = [
  { id: "morning", label: "Förmiddag", range: "10–12" },
  { id: "afternoon", label: "Eftermiddag", range: "13–17" },
] as const;
const weekdays = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getBusinessDateKey(day: AvailabilityDay) {
  const firstSlot = day.slots[0];
  if (!firstSlot) return "";

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: day.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(firstSlot.slotStartAt));
}

function getCalendarDays(month: Date, availableDates: Set<string>) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cells: Array<{ value: string; day: number; available: boolean; closed: boolean } | null> =
    Array.from({ length: mondayOffset }, () => null);

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const current = new Date(month.getFullYear(), month.getMonth(), day);
    const value = toDateKey(current);
    const closed = current.getDay() === 0;
    cells.push({
      value,
      day,
      closed,
      available: current > today && availableDates.has(value),
    });
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

async function readApiError(response: Response) {
  try {
    const payload = await response.json() as { error?: string; message?: string };
    return payload.error || payload.message || "Något gick fel. Försök igen.";
  } catch {
    return "Något gick fel. Försök igen.";
  }
}

export default function BookingPage() {
  const bookingFlowRef = useRef<HTMLElement>(null);
  const initialMonth = useMemo(() => {
    const current = new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  }, []);
  const availabilityRangeDays = useMemo(() => {
    const end = new Date(initialMonth.getFullYear(), initialMonth.getMonth() + 2, 0);
    return Math.ceil((end.getTime() - initialMonth.getTime()) / 86_400_000) + 1;
  }, [initialMonth]);
  const [services, setServices] = useState<Service[]>(fallbackServices);
  const [availabilityDays, setAvailabilityDays] = useState<AvailabilityDay[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(initialMonth);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [appointmentAt, setAppointmentAt] = useState("");
  const [timePeriod, setTimePeriod] = useState<"morning" | "afternoon">("morning");
  const [serviceMenuOpen, setServiceMenuOpen] = useState(false);
  const [bookingStage, setBookingStage] = useState<"service" | "date" | "time">("service");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const selectedService = services.find((service) => service.id === serviceId);
  const availabilityByDate = useMemo(
    () => new Map(availabilityDays.map((day) => [getBusinessDateKey(day), day])),
    [availabilityDays],
  );
  const availableDates = useMemo(
    () => new Set(
      availabilityDays
        .filter((day) => day.slots.some((slot) => slot.isAvailable))
        .map(getBusinessDateKey)
        .filter(Boolean),
    ),
    [availabilityDays],
  );
  const calendarDays = useMemo(
    () => getCalendarDays(calendarMonth, availableDates),
    [availableDates, calendarMonth],
  );
  const selectedDay = date ? availabilityByDate.get(date) : undefined;
  const timeSlots = useMemo<TimeSlot[]>(
    () => (selectedDay?.slots || []).map((slot) => {
      const slotTime = slot.timeLabel.split(" - ")[0];
      return {
        time: slotTime,
        period: Number(slotTime.slice(0, 2)) < 13 ? "morning" : "afternoon",
        available: slot.isAvailable,
        appointmentAt: slot.slotStartAt,
      };
    }),
    [selectedDay],
  );
  const monthLabel = new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" }).format(calendarMonth);
  const selectedDateLabel = date
    ? new Intl.DateTimeFormat("sv-SE", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`))
    : "";
  const currentMonthIndex = initialMonth.getFullYear() * 12 + initialMonth.getMonth();
  const visibleMonthIndex = calendarMonth.getFullYear() * 12 + calendarMonth.getMonth();

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/services", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ services: Service[] }>;
      })
      .then((payload) => {
        if (payload.services.length > 0) setServices(payload.services);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Could not load booking services", error);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!serviceId) {
      setAvailabilityDays([]);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      start: toDateKey(initialMonth),
      days: String(availabilityRangeDays),
      serviceId,
    });
    setAvailabilityLoading(true);
    setApiError("");

    fetch(`/api/availability?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ days: AvailabilityDay[] }>;
      })
      .then((payload) => setAvailabilityDays(payload.days))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAvailabilityDays([]);
          setApiError("Lediga tider kunde inte hämtas. Försök igen om en stund.");
        }
      })
      .finally(() => setAvailabilityLoading(false));

    return () => controller.abort();
  }, [availabilityRangeDays, initialMonth, serviceId]);

  useEffect(() => {
    if (step !== 2) return;
    const frame = window.requestAnimationFrame(() => {
      bookingFlowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [bookingStage, step]);

  function resetTime() {
    setTime("");
    setAppointmentAt("");
  }

  function changeMonth(direction: -1 | 1) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  function continueToBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiError("");
    setStep(2);
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedService || !appointmentAt || submitting) return;

    setSubmitting(true);
    setApiError("");

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          serviceId: selectedService.id,
          appointmentAt,
        }),
      });

      if (!response.ok) throw new Error(await readApiError(response));
      setSubmitted(true);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Bokningen kunde inte skickas. Försök igen.");
    } finally {
      setSubmitting(false);
    }
  }

  return <><SiteHeader /><main className={`booking-page ${step === 1 ? "booking-page-details" : `booking-page-active ${bookingStage === "service" ? "booking-page-service" : bookingStage === "date" ? "booking-page-date" : "booking-page-time"}`}`}>
    <section className="booking-page-intro">
      <h1>En ny look<br/><em>börjar här.</em></h1>
    </section>

    <section className="booking-flow" aria-label="Bokningsflöde" ref={bookingFlowRef}>
      <div className="booking-steps" aria-label="Bokningssteg">
        <span className={step === 1 ? "active" : "complete"}><b>01</b> Dina uppgifter</span>
        <i aria-hidden="true" />
        <span className={step === 2 && bookingStage === "service" ? "active" : step === 2 ? "complete" : ""}><b>02</b> Välj behandling</span>
        <i aria-hidden="true" />
        <span className={step === 2 && bookingStage !== "service" ? "active" : ""}><b>03</b> Välj tid</span>
      </div>

      {!submitted && step === 1 && <form className="booking-form booking-details-form" onSubmit={continueToBooking}>
        <div className="booking-form-heading"><p className="eyebrow">Steg 01</p><h2 id="booking-flow-title">Vi börjar<br/>enkelt.</h2><p>Fyll i dina uppgifter, så tar vi resten steg för steg.</p></div>
        <label><span>Namn</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ditt för- och efternamn" autoComplete="name" required /></label>
        <label><span>E-post</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="din@email.se" autoComplete="email" required /></label>
        <button className="button booking-next" type="submit">Nästa steg <span aria-hidden="true">→</span></button>
        <small>Vi använder bara din e-post för din bokningsbekräftelse.</small>
      </form>}

      {!submitted && step === 2 && <form className="booking-form booking-selection-form" onSubmit={submitBooking}>
        {bookingStage !== "time" && <div className="booking-form-heading booking-choice-heading"><p className="eyebrow">Steg 02</p><h2 id="booking-flow-title">{bookingStage === "service" ? <>Vad vill du<br/>boka?</> : <>Vilken dag<br/>passar dig?</>}</h2></div>}

        {bookingStage === "date" && selectedService && <div className="booking-choice-summary"><span><small>Behandling</small><strong>{selectedService.name}</strong></span><span><small>Tid & pris</small><strong>{selectedService.duration} · {selectedService.price}</strong></span><button type="button" onClick={() => { setBookingStage("service"); setDate(""); resetTime(); }}>Ändra</button></div>}

        {bookingStage === "service" && <><fieldset className="booking-stage-panel booking-desktop-service"><legend>Välj behandling</legend><div className="booking-service-grid">{services.map((service, index) => <label className={`booking-service ${serviceId === service.id ? "selected" : ""}`} key={service.id}><input type="radio" name="service" value={service.id} checked={serviceId === service.id} onChange={() => { setServiceId(service.id); setDate(""); resetTime(); setBookingStage("date"); }} required /><i>{String(index + 1).padStart(2, "0")}</i><span><strong>{service.name}</strong><small>{service.duration}</small></span><b>{service.price}</b><em aria-hidden="true">→</em></label>)}</div></fieldset><div className="booking-mobile-service"><span className="booking-mobile-service-label">Behandling</span><div className={`booking-mobile-select ${serviceMenuOpen ? "open" : ""}`}><button className="booking-mobile-select-trigger" type="button" aria-haspopup="listbox" aria-expanded={serviceMenuOpen} onClick={() => setServiceMenuOpen((open) => !open)}><span><small>{selectedService ? "Vald behandling" : "Välj en behandling"}</small><strong>{selectedService?.name || "Tryck för att välja"}</strong></span><i aria-hidden="true">⌄</i></button>{serviceMenuOpen && <div className="booking-mobile-select-menu" role="listbox" aria-label="Välj behandling">{services.map((service) => <button type="button" role="option" aria-selected={serviceId === service.id} className={serviceId === service.id ? "selected" : ""} onClick={() => { setServiceId(service.id); setDate(""); resetTime(); setServiceMenuOpen(false); }} key={service.id}><strong>{service.name}</strong><em aria-hidden="true">{serviceId === service.id ? "✓" : ""}</em></button>)}</div>}</div>{selectedService && <div className="booking-mobile-service-summary"><span><small>Vald behandling</small><strong>{selectedService.name}</strong></span><span><small>Längd</small><strong>{selectedService.duration}</strong></span><span><small>Pris</small><strong>{selectedService.price}</strong></span></div>}<button className="button booking-mobile-service-next" type="button" disabled={!selectedService} onClick={() => setBookingStage("date")}>Välj och fortsätt <span aria-hidden="true">→</span></button></div></>}

        {bookingStage === "date" && <fieldset className="booking-stage-panel"><legend>Välj datum</legend><div className="booking-calendar" aria-busy={availabilityLoading}>
          <div className="booking-calendar-head"><button type="button" onClick={() => changeMonth(-1)} disabled={visibleMonthIndex <= currentMonthIndex} aria-label="Föregående månad">←</button><strong>{monthLabel}</strong><button type="button" onClick={() => changeMonth(1)} disabled={visibleMonthIndex >= currentMonthIndex + 1} aria-label="Nästa månad">→</button></div>
          <div className="booking-calendar-weekdays" aria-hidden="true">{weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
          <div className="booking-calendar-grid">{calendarDays.map((day, index) => day ? <button type="button" className={`${date === day.value ? "selected" : ""} ${!day.available ? "unavailable" : ""}`} disabled={!day.available || availabilityLoading} aria-pressed={date === day.value} onClick={() => { setDate(day.value); resetTime(); setBookingStage("time"); }} key={day.value}><span>{day.day}</span>{day.closed && <small>Stängt</small>}</button> : <span className="empty" key={`empty-${index}`} />)}</div>
          <div className="booking-calendar-key"><span><i /> Ledig</span><span><i /> Stängt, fullbokat eller passerat</span></div>
        </div></fieldset>}

        {bookingStage === "time" && <><div className="booking-time-context"><span><small>Din bokning</small><strong>{selectedService?.name} · {selectedDateLabel}</strong></span><div><button type="button" onClick={() => { setBookingStage("service"); setDate(""); resetTime(); }}>Ändra behandling</button><button type="button" onClick={() => { setBookingStage("date"); resetTime(); }}>Ändra datum</button></div></div><fieldset className="booking-stage-panel booking-time-panel"><legend>Lediga tider</legend><div className="booking-time-groups">{timeGroups.map((group) => {
          const groupSlots = timeSlots.filter((slot) => slot.period === group.id);
          const availableCount = groupSlots.filter((slot) => slot.available).length;
          return <button type="button" className={timePeriod === group.id ? "active" : ""} onClick={() => { setTimePeriod(group.id); resetTime(); }} aria-pressed={timePeriod === group.id} key={group.id}><span><strong>{group.label}</strong><small>{group.range}</small></span><b>{availableCount} lediga</b></button>;
        })}</div><div className="booking-time-stage"><div className="booking-time-stage-heading"><span aria-hidden="true">{timePeriod === "morning" ? "☼" : "◐"}</span><p><strong>{timePeriod === "morning" ? "En lugn start på dagen" : "En tid senare på dagen"}</strong><small>Välj den tid som passar dig bäst</small></p></div><div className="booking-time-options">{timeSlots.filter((slot) => slot.period === timePeriod).map((slot) => <button type="button" className={`booking-time-option ${appointmentAt === slot.appointmentAt ? "selected" : ""} ${!slot.available ? "unavailable" : ""}`} disabled={!slot.available} aria-pressed={appointmentAt === slot.appointmentAt} onClick={() => { setTime(slot.time); setAppointmentAt(slot.appointmentAt); }} key={slot.appointmentAt}><small>{slot.available ? "Ledig" : "Bokad"}</small><strong>{slot.time}</strong><span aria-hidden="true">{appointmentAt === slot.appointmentAt ? "✓" : ""}</span></button>)}</div></div></fieldset></>}

        {apiError && <p className="booking-api-error" role="alert">{apiError}</p>}
        <div className="booking-submit-row"><button className="booking-back" type="button" onClick={() => bookingStage === "service" ? setStep(1) : bookingStage === "date" ? setBookingStage("service") : setBookingStage("date")}>← Tillbaka</button>{bookingStage === "time" && time && <button className="button booking-next" type="submit" disabled={submitting}>{submitting ? "Skickar…" : "Bekräfta bokning"} <span aria-hidden="true">→</span></button>}</div>
      </form>}

      {submitted && <div className="booking-success" role="status"><p className="eyebrow">Din bokning</p><h2>Tack, {name.split(" ")[0]}.</h2><p>Du har bokat <strong>{selectedService?.name}</strong> den <strong>{selectedDateLabel}</strong> klockan <strong>{time}</strong>.</p><p className="booking-demo-note">Din bokningsförfrågan är registrerad.</p></div>}
    </section>
  </main><InteractiveMap /><SiteFooter /></>;
}
