"use client";

import { FormEvent, useMemo, useState } from "react";
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

const timeSlots = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

function getBookingDays() {
  const formatter = new Intl.DateTimeFormat("sv-SE", { weekday: "short", day: "numeric", month: "short" });
  const days: { value: string; label: string; disabled: boolean }[] = [];
  const date = new Date();

  while (days.length < 9) {
    date.setDate(date.getDate() + 1);
    const weekday = date.getDay();
    if (weekday === 0) continue;
    days.push({ value: date.toISOString().slice(0, 10), label: formatter.format(date), disabled: false });
  }

  return days;
}

export default function BookingPage() {
  const days = useMemo(getBookingDays, []);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [bookingStage, setBookingStage] = useState<"service" | "date" | "time">("service");
  const [submitted, setSubmitted] = useState(false);
  const selectedService = services.find((service) => service.id === serviceId);
  const selectedDay = days.find((day) => day.value === date);

  function continueToBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStep(2);
  }

  function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return <><SiteHeader /><main className="booking-page">
    <section className="booking-page-intro">
      <h1>En ny look<br/><em>börjar här.</em></h1>
    </section>

    <section className="booking-flow" aria-labelledby="booking-flow-title">
      <div className="booking-steps" aria-label="Bokningssteg">
        <span className={step === 1 ? "active" : "complete"}><b>01</b> Dina uppgifter</span>
        <i aria-hidden="true" />
        <span className={step === 2 ? "active" : ""}><b>02</b> Välj tid</span>
      </div>

      {!submitted && step === 1 && <form className="booking-form booking-details-form" onSubmit={continueToBooking}>
        <div className="booking-form-heading"><p className="eyebrow">Steg 01</p><h2 id="booking-flow-title">Vi börjar<br/>enkelt.</h2><p>Fyll i dina uppgifter, så tar vi resten steg för steg.</p></div>
        <label><span>Namn</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ditt för- och efternamn" autoComplete="name" required /></label>
        <label><span>E-post</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="din@email.se" autoComplete="email" required /></label>
        <button className="button booking-next" type="submit">Nästa steg <span aria-hidden="true">→</span></button>
        <small>Vi använder bara din e-post för din bokningsbekräftelse.</small>
      </form>}

      {!submitted && step === 2 && <form className="booking-form booking-selection-form" onSubmit={submitBooking}>
        <div className="booking-form-heading booking-choice-heading"><p className="eyebrow">Steg 02</p><h2 id="booking-flow-title">{bookingStage === "service" ? <>Vad vill du<br/>boka?</> : bookingStage === "date" ? <>Vilken dag<br/>passar dig?</> : <>Välj en<br/>ledig tid.</>}</h2></div>

        {bookingStage !== "service" && selectedService && <div className="booking-choice-summary"><span><small>Behandling</small><strong>{selectedService.name}</strong></span><span><small>Tid & pris</small><strong>{selectedService.duration} · {selectedService.price}</strong></span><button type="button" onClick={() => { setBookingStage("service"); setDate(""); setTime(""); }}>Ändra</button></div>}

        {bookingStage === "service" && <fieldset className="booking-stage-panel"><legend>Välj behandling</legend><div className="booking-service-grid">{services.map((service, index) => <label className={`booking-service ${serviceId === service.id ? "selected" : ""}`} key={service.id}><input type="radio" name="service" value={service.id} checked={serviceId === service.id} onChange={() => { setServiceId(service.id); setDate(""); setTime(""); setBookingStage("date"); }} required /><i>{String(index + 1).padStart(2, "0")}</i><span><strong>{service.name}</strong><small>{service.duration}</small></span><b>{service.price}</b><em aria-hidden="true">→</em></label>)}</div></fieldset>}

        {bookingStage === "date" && <fieldset className="booking-stage-panel"><legend>Välj datum</legend><div className="booking-day-grid">{days.map((day) => <label className={`booking-day ${date === day.value ? "selected" : ""}`} key={day.value}><input type="radio" name="date" value={day.value} checked={date === day.value} onChange={() => { setDate(day.value); setTime(""); setBookingStage("time"); }} required /><span>{day.label}</span></label>)}</div></fieldset>}

        {bookingStage === "time" && <><div className="booking-date-summary"><span><small>Valt datum</small><strong>{selectedDay?.label}</strong></span><button type="button" onClick={() => { setBookingStage("date"); setTime(""); }}>Ändra datum</button></div><fieldset className="booking-stage-panel"><legend>Lediga tider</legend><div className="booking-time-grid">{timeSlots.map((slot, index) => <label className={`booking-time ${time === slot ? "selected" : ""} ${index === 2 || index === 6 ? "unavailable" : ""}`} key={slot}><input type="radio" name="time" value={slot} disabled={index === 2 || index === 6} checked={time === slot} onChange={() => setTime(slot)} required /><span>{slot}</span></label>)}</div></fieldset></>}

        <div className="booking-submit-row">{bookingStage === "time" && time && <button className="button booking-next" type="submit">Bekräfta bokning <span aria-hidden="true">→</span></button>}<button className="booking-back" type="button" onClick={() => bookingStage === "service" ? setStep(1) : bookingStage === "date" ? setBookingStage("service") : setBookingStage("date")}>← Tillbaka</button></div>
      </form>}

      {submitted && <div className="booking-success" role="status"><p className="eyebrow">Din förfrågan</p><h2>Tack, {name.split(" ")[0]}.</h2><p>Du har valt <strong>{selectedService?.name}</strong> {selectedDay && <>den <strong>{selectedDay.label}</strong></>} klockan <strong>{time}</strong>.</p><p className="booking-demo-note">Det här är en förhandsvisning. Bokningen skickas till systemet när API-integrationen är ansluten.</p><button className="booking-back" type="button" onClick={() => { setSubmitted(false); setStep(2); }}>Ändra val</button></div>}
    </section>
  </main></>;
}
