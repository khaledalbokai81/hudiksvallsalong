import { AlertCircle, Check, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  cancelManagedBooking,
  getAvailability,
  getManagedBooking,
  updateManagedBooking
} from "../api";
import { SalonAppointmentPicker } from "../components/SalonAppointmentPicker";
import { SalonMapFooter } from "../components/SalonMapFooter";
import { usePublicSettings } from "../hooks/usePublicSettings";
import { useServices } from "../hooks/useServices";
import { formatBusinessFullDateTime } from "../lib/time";
import type { AvailabilityDay, Booking, ManageBookingInput } from "../types";

type PageStatus = "loading" | "ready" | "saving" | "canceling" | "error";

function createForm(booking: Booking): ManageBookingInput {
  return {
    name: booking.name,
    phone: booking.phone,
    serviceId: booking.serviceId,
    appointmentAt: booking.appointmentAt || "",
    notes: booking.notes || ""
  };
}

function statusLabel(status: Booking["status"]) {
  if (status === "open") return "Aktiv bokning";
  if (status === "resolved") return "Genomförd";
  return "Avbokad";
}

export function ManageBookingPage() {
  const publicSettings = usePublicSettings();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const { services, error: servicesError } = useServices();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [form, setForm] = useState<ManageBookingInput>({
    name: "",
    phone: "",
    serviceId: "",
    appointmentAt: "",
    notes: ""
  });
  const [status, setStatus] = useState<PageStatus>("loading");
  const [message, setMessage] = useState("Hämtar din bokning…");
  const [availabilityDays, setAvailabilityDays] = useState<AvailabilityDay[]>([]);

  async function loadAvailability(serviceId: string) {
    const response = await getAvailability(publicSettings.bookingRules.bookingWindowDays, serviceId);
    setAvailabilityDays(response.days);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      if (!token) {
        setStatus("error");
        setMessage("Bokningslänken saknar en säker kod.");
        return;
      }

      try {
        const response = await getManagedBooking(token);
        const availability = await getAvailability(
          publicSettings.bookingRules.bookingWindowDays,
          response.booking.serviceId
        );
        if (!active) return;
        setBooking(response.booking);
        setForm(createForm(response.booking));
        setAvailabilityDays(availability.days);
        setStatus("ready");
        setMessage("");
      } catch (error) {
        if (!active) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Bokningen kunde inte hämtas.");
      }
    }

    void load();
    return () => { active = false; };
  }, [token, publicSettings.bookingRules.bookingWindowDays]);

  function updateField(field: keyof ManageBookingInput, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "serviceId" ? { appointmentAt: "" } : {})
    }));
    setMessage("");
    if (field === "serviceId") void loadAvailability(value);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    try {
      const response = await updateManagedBooking(token, form);
      setBooking(response.booking);
      setForm(createForm(response.booking));
      await loadAvailability(response.booking.serviceId);
      setStatus("ready");
      setMessage("Dina ändringar är sparade.");
    } catch (error) {
      setStatus("ready");
      setMessage(error instanceof Error ? error.message : "Bokningen kunde inte uppdateras.");
    }
  }

  async function handleCancel() {
    if (!window.confirm("Är du säker på att du vill avboka tiden?")) return;
    setStatus("canceling");
    setMessage("");
    try {
      const response = await cancelManagedBooking(token);
      setBooking(response.booking);
      setStatus("ready");
      setMessage("Bokningen är avbokad.");
    } catch (error) {
      setStatus("ready");
      setMessage(error instanceof Error ? error.message : "Bokningen kunde inte avbokas.");
    }
  }

  const isBusy = status === "loading" || status === "saving" || status === "canceling";
  const isEditable = booking?.status === "open";
  const selectedService = services.find((service) => service.id === form.serviceId);
  const serviceOptions = useMemo(() => {
    if (!booking || services.some((service) => service.id === booking.serviceId)) return services;
    return [{
      id: booking.serviceId,
      name: booking.serviceName,
      duration: `${booking.serviceDurationHours || 1} tim`,
      durationHours: booking.serviceDurationHours || 1,
      price: "Nuvarande",
      description: booking.serviceName
    }, ...services];
  }, [booking, services]);

  if (status === "loading") {
    return <section className="salon-manage-state"><Loader2 className="animate-spin" size={28} /><p>{message}</p></section>;
  }

  if (status === "error" || !booking) {
    return (
      <section className="salon-manage-state salon-manage-error">
        <AlertCircle size={28} />
        <p className="salon-kicker">Säker bokningslänk</p>
        <h1>Länken kan inte öppnas.</h1>
        <p>{message}</p>
        <Link to="/booking">Gör en ny bokning <span>→</span></Link>
      </section>
    );
  }

  return (
    <><section className="salon-manage-experience">
      <div className="salon-verified-strip">
        <ShieldCheck size={18} />
        <span><strong>{statusLabel(booking.status)}</strong> E-post verifierad för {booking.email}. Den här länken är personlig.</span>
        {form.appointmentAt && <time>{formatBusinessFullDateTime(form.appointmentAt)}</time>}
      </div>

      <form className="salon-manage-form" onSubmit={handleSubmit}>
        <section className="salon-manage-section salon-manage-details">
          <div className="salon-section-number">01</div>
          <div className="salon-section-heading">
            <p className="salon-kicker">Dina val</p>
            <h2>Uppgifter & behandling</h2>
          </div>
          <div className="salon-detail-fields">
            <label><span>Namn</span><input value={form.name} onChange={(event) => updateField("name", event.target.value)} disabled={!isEditable || isBusy} minLength={2} required /></label>
            <label><span>Telefon <em>{publicSettings.bookingRules.requirePhone ? "" : "valfritt"}</em></span><input type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} disabled={!isEditable || isBusy} required={publicSettings.bookingRules.requirePhone} /></label>
            <label className="salon-service-field"><span>Behandling</span><select value={form.serviceId} onChange={(event) => updateField("serviceId", event.target.value)} disabled={!isEditable || isBusy} required>{serviceOptions.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>{servicesError && <small>Den sparade behandlingen visas eftersom tjänsterna inte kunde uppdateras.</small>}</label>
          </div>
          {selectedService && <div className="salon-selected-service"><span><small>Vald behandling</small><strong>{selectedService.name}</strong></span><span><small>Längd</small><strong>{selectedService.duration}</strong></span><span><small>Pris</small><strong>{selectedService.price}</strong></span></div>}
        </section>

        <section className="salon-manage-section salon-manage-appointment">
          <div className="salon-section-number">02</div>
          <div className="salon-section-heading">
            <p className="salon-kicker">Datum & tid</p>
            <h2>När passar det?</h2>
            <p>Välj en ledig dag och därefter den tid som passar bäst.</p>
          </div>
          <SalonAppointmentPicker days={availabilityDays} value={form.appointmentAt} disabled={!isEditable || isBusy} onSelect={(value) => updateField("appointmentAt", value)} />
          <input className="sr-only" value={form.appointmentAt} onChange={() => undefined} required tabIndex={-1} />
        </section>

        <section className="salon-manage-section salon-manage-notes">
          <div className="salon-section-number">03</div>
          <div className="salon-section-heading"><p className="salon-kicker">Sista detaljen</p><h2>Något vi bör veta?</h2></div>
          <label><span>Anteckning <em>{publicSettings.bookingRules.requireNotes ? "" : "valfritt"}</em></span><textarea value={form.notes || ""} onChange={(event) => updateField("notes", event.target.value)} disabled={!isEditable || isBusy} maxLength={500} required={publicSettings.bookingRules.requireNotes} placeholder="Skriv en kort anteckning till salongen…" /></label>
        </section>

        {message && <div className="salon-manage-message" role="status"><Check size={16} />{message}</div>}

        <div className="salon-manage-actions">
          <button className="salon-cancel-booking" type="button" disabled={!isEditable || isBusy} onClick={() => void handleCancel()}><Trash2 size={16} />{status === "canceling" ? "Avbokar…" : "Avboka tid"}</button>
          <div><small>Kontrollera dina val innan du sparar</small><button className="salon-save-booking" type="submit" disabled={!isEditable || isBusy}>{status === "saving" ? "Sparar…" : "Spara ändringar"} <span>→</span></button></div>
        </div>
      </form>
    </section><SalonMapFooter /></>
  );
}
