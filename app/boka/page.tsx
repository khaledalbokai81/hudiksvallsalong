"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { InteractiveMap } from "../components/interactive-map";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";

const services = [
  { id: "herrklippning", name: "Herrklippning", price: "300 kr", duration: "45 min" },
  { id: "skaggtrimning", name: "Skäggtrimning", price: "200 kr", duration: "30 min" },
  { id: "har-skagg", name: "Hår + skägg", price: "400 kr", duration: "60 min" },
  { id: "barnklippning", name: "Barnklippning", price: "250 kr", duration: "30 min" },
  { id: "pensionarsklippning", name: "Pensionärsklippning", price: "250 kr", duration: "30 min" },
  { id: "maskinklippning", name: "Maskinklippning", price: "200 kr", duration: "30 min" },
  { id: "tvatt-styling", name: "Tvätt & styling", price: "150 kr", duration: "30 min" },
  { id: "konturtrimning", name: "Konturtrimning", price: "150 kr", duration: "20 min" },
];

const timeSlots = [
  { time: "10:00", period: "morning", available: true },
  { time: "11:00", period: "morning", available: true },
  { time: "12:00", period: "morning", available: false },
  { time: "13:00", period: "afternoon", available: true },
  { time: "14:00", period: "afternoon", available: true },
  { time: "15:00", period: "afternoon", available: true },
  { time: "16:00", period: "afternoon", available: false },
  { time: "17:00", period: "afternoon", available: true },
];
const timeGroups = [
  { id: "morning", label: "Förmiddag", range: "10–12" },
  { id: "afternoon", label: "Eftermiddag", range: "13–17" },
] as const;
const weekdays = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getCalendarDays(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bookingLimit = new Date(today);
  bookingLimit.setDate(bookingLimit.getDate() + 60);
  const cells: Array<{ value: string; day: number; available: boolean; closed: boolean } | null> =
    Array.from({ length: mondayOffset }, () => null);

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const current = new Date(month.getFullYear(), month.getMonth(), day);
    const closed = current.getDay() === 0;
    cells.push({
      value: toDateKey(current),
      day,
      closed,
      available: current > today && current <= bookingLimit && !closed,
    });
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function BookingPage() {
  const bookingFlowRef = useRef<HTMLElement>(null);
  const initialMonth = useMemo(() => {
    const current = new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  }, []);
  const [calendarMonth, setCalendarMonth] = useState(initialMonth);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [timePeriod, setTimePeriod] = useState<"morning" | "afternoon">("morning");
  const [bookingStage, setBookingStage] = useState<"service" | "date" | "time">("service");
  const [submitted, setSubmitted] = useState(false);
  const selectedService = services.find((service) => service.id === serviceId);
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);
  const monthLabel = new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" }).format(calendarMonth);
  const selectedDateLabel = date
    ? new Intl.DateTimeFormat("sv-SE", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`))
    : "";
  const currentMonthIndex = initialMonth.getFullYear() * 12 + initialMonth.getMonth();
  const visibleMonthIndex = calendarMonth.getFullYear() * 12 + calendarMonth.getMonth();

  useEffect(() => {
    if (step !== 2) return;
    const frame = window.requestAnimationFrame(() => {
      bookingFlowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [bookingStage, step]);

  function changeMonth(direction: -1 | 1) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  function continueToBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStep(2);
  }

  function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return <><SiteHeader /><main className={`booking-page ${step === 1 ? "booking-page-details" : `booking-page-active ${bookingStage === "service" ? "booking-page-service" : ""}`}`}>
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

        {bookingStage === "date" && selectedService && <div className="booking-choice-summary"><span><small>Behandling</small><strong>{selectedService.name}</strong></span><span><small>Tid & pris</small><strong>{selectedService.duration} · {selectedService.price}</strong></span><button type="button" onClick={() => { setBookingStage("service"); setDate(""); setTime(""); }}>Ändra</button></div>}

        {bookingStage === "service" && <><fieldset className="booking-stage-panel booking-desktop-service"><legend>Välj behandling</legend><div className="booking-service-grid">{services.map((service, index) => <label className={`booking-service ${serviceId === service.id ? "selected" : ""}`} key={service.id}><input type="radio" name="service" value={service.id} checked={serviceId === service.id} onChange={() => { setServiceId(service.id); setDate(""); setTime(""); setBookingStage("date"); }} required /><i>{String(index + 1).padStart(2, "0")}</i><span><strong>{service.name}</strong><small>{service.duration}</small></span><b>{service.price}</b><em aria-hidden="true">→</em></label>)}</div></fieldset><div className="booking-mobile-service"><label htmlFor="mobile-service">Behandling</label><div className="booking-mobile-select"><select id="mobile-service" value={serviceId} onChange={(event) => { setServiceId(event.target.value); setDate(""); setTime(""); }}><option value="">Välj en behandling</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name} — {service.price}</option>)}</select><span aria-hidden="true">⌄</span></div>{selectedService && <div className="booking-mobile-service-summary"><span><small>Vald behandling</small><strong>{selectedService.name}</strong></span><span><small>Längd</small><strong>{selectedService.duration}</strong></span><span><small>Pris</small><strong>{selectedService.price}</strong></span></div>}<button className="button booking-mobile-service-next" type="button" disabled={!selectedService} onClick={() => setBookingStage("date")}>Välj och fortsätt <span aria-hidden="true">→</span></button></div></>}

        {bookingStage === "date" && <fieldset className="booking-stage-panel"><legend>Välj datum</legend><div className="booking-calendar">
          <div className="booking-calendar-head"><button type="button" onClick={() => changeMonth(-1)} disabled={visibleMonthIndex <= currentMonthIndex} aria-label="Föregående månad">←</button><strong>{monthLabel}</strong><button type="button" onClick={() => changeMonth(1)} disabled={visibleMonthIndex >= currentMonthIndex + 2} aria-label="Nästa månad">→</button></div>
          <div className="booking-calendar-weekdays" aria-hidden="true">{weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
          <div className="booking-calendar-grid">{calendarDays.map((day, index) => day ? <button type="button" className={`${date === day.value ? "selected" : ""} ${!day.available ? "unavailable" : ""}`} disabled={!day.available} aria-pressed={date === day.value} onClick={() => { setDate(day.value); setTime(""); setBookingStage("time"); }} key={day.value}><span>{day.day}</span>{day.closed && <small>Stängt</small>}</button> : <span className="empty" key={`empty-${index}`} />)}</div>
          <div className="booking-calendar-key"><span><i /> Ledig</span><span><i /> Stängt eller passerad</span></div>
        </div></fieldset>}

        {bookingStage === "time" && <><div className="booking-time-context"><span><small>Din bokning</small><strong>{selectedService?.name} · {selectedDateLabel}</strong></span><div><button type="button" onClick={() => { setBookingStage("service"); setDate(""); setTime(""); }}>Ändra behandling</button><button type="button" onClick={() => { setBookingStage("date"); setTime(""); }}>Ändra datum</button></div></div><fieldset className="booking-stage-panel booking-time-panel"><legend>Lediga tider</legend><div className="booking-time-groups">{timeGroups.map((group) => {
          const groupSlots = timeSlots.filter((slot) => slot.period === group.id);
          const availableCount = groupSlots.filter((slot) => slot.available).length;
          return <button type="button" className={timePeriod === group.id ? "active" : ""} onClick={() => { setTimePeriod(group.id); setTime(""); }} aria-pressed={timePeriod === group.id} key={group.id}><span><strong>{group.label}</strong><small>{group.range}</small></span><b>{availableCount} lediga</b></button>;
        })}</div><div className="booking-time-stage"><div className="booking-time-stage-heading"><span aria-hidden="true">{timePeriod === "morning" ? "☼" : "◐"}</span><p><strong>{timePeriod === "morning" ? "En lugn start på dagen" : "En tid senare på dagen"}</strong><small>Välj den tid som passar dig bäst</small></p></div><div className="booking-time-options">{timeSlots.filter((slot) => slot.period === timePeriod).map((slot) => <button type="button" className={`booking-time-option ${time === slot.time ? "selected" : ""} ${!slot.available ? "unavailable" : ""}`} disabled={!slot.available} aria-pressed={time === slot.time} onClick={() => setTime(slot.time)} key={slot.time}><small>{slot.available ? "Ledig" : "Bokad"}</small><strong>{slot.time}</strong><span aria-hidden="true">{time === slot.time ? "✓" : ""}</span></button>)}</div></div></fieldset></>}

        <div className="booking-submit-row"><button className="booking-back" type="button" onClick={() => bookingStage === "service" ? setStep(1) : bookingStage === "date" ? setBookingStage("service") : setBookingStage("date")}>← Tillbaka</button>{bookingStage === "time" && time && <button className="button booking-next" type="submit">Bekräfta bokning <span aria-hidden="true">→</span></button>}</div>
      </form>}

      {submitted && <div className="booking-success" role="status"><p className="eyebrow">Din förfrågan</p><h2>Tack, {name.split(" ")[0]}.</h2><p>Du har valt <strong>{selectedService?.name}</strong> den <strong>{selectedDateLabel}</strong> klockan <strong>{time}</strong>.</p><p className="booking-demo-note">Det här är en förhandsvisning. Bokningen skickas till systemet när API-integrationen är ansluten.</p><button className="booking-back" type="button" onClick={() => { setSubmitted(false); setStep(2); }}>Ändra val</button></div>}
    </section>
  </main><InteractiveMap /><SiteFooter /></>;
}
