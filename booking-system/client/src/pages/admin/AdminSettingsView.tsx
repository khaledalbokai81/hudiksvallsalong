import {
  ArrowLeft,
  Bell,
  Building2,
  CalendarOff,
  ChevronRight,
  Clock3,
  Copy,
  FileText,
  Globe2,
  Mail,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  X
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAvailability } from "../../api";
import type { AvailabilityDay, BlackoutDate, BusinessSettings, WeeklyScheduleDay } from "../../types";

const weekdayNames = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];
const commonTimezones = [
  "Europe/Berlin",
  "Europe/London",
  "Europe/Paris",
  "Europe/Helsinki",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC"
];
type SettingsSection = "business" | "availability" | "booking" | "notifications" | "public" | "policies";

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

type Props = {
  settings: BusinessSettings | null;
  loading: boolean;
  saving: boolean;
  onSave: (input: Partial<BusinessSettings>, successMessage: string) => Promise<boolean>;
};

const sectionMeta: Array<{
  id: SettingsSection;
  title: string;
  description: string;
  icon: typeof Building2;
}> = [
  { id: "business", title: "Salongen", description: "Identitet och tidszon", icon: Building2 },
  { id: "availability", title: "Tillgänglighet", description: "Tider, pauser och stängningar", icon: Clock3 },
  { id: "booking", title: "Bokningsregler", description: "Varsel och kundändringar", icon: ShieldCheck },
  { id: "notifications", title: "Aviseringar", description: "Mottagare och avsändare", icon: Bell },
  { id: "public", title: "Publika uppgifter", description: "Kontakt och sociala länkar", icon: Globe2 },
  { id: "policies", title: "Policyer", description: "Integritet och avbokningar", icon: FileText }
];

function sectionPayload(section: SettingsSection, value: BusinessSettings): Partial<BusinessSettings> {
  if (section === "business") return { businessName: value.businessName, ownerEmail: value.ownerEmail, timezone: value.timezone };
  if (section === "availability") return { weeklySchedule: value.weeklySchedule, slotIntervalMinutes: value.slotIntervalMinutes, blackoutDates: value.blackoutDates };
  if (section === "booking") return { bookingRules: value.bookingRules };
  if (section === "notifications") return { ownerNotificationEmails: value.ownerNotificationEmails, notificationEmailFromName: value.notificationEmailFromName };
  if (section === "public") return { publicContact: value.publicContact };
  return { legal: value.legal };
}

function sectionMessage(section: SettingsSection) {
  return `${sectionMeta.find((item) => item.id === section)?.title || "Settings"} saved.`;
}

function summaryFor(section: SettingsSection, settings: BusinessSettings) {
  if (section === "business") return `${settings.businessName} - ${settings.timezone}`;
  if (section === "availability") {
    const openDays = settings.weeklySchedule.filter((day) => day.enabled).length;
    return `${openDays} open days - ${settings.blackoutDates.length} blackout${settings.blackoutDates.length === 1 ? "" : "s"}`;
  }
  if (section === "booking") return `${settings.bookingRules.minimumNoticeHours}h notice - ${settings.bookingRules.bookingWindowDays} day window`;
  if (section === "notifications") return `${settings.ownerNotificationEmails.length} recipient${settings.ownerNotificationEmails.length === 1 ? "" : "s"}`;
  if (section === "public") return settings.publicContact.phone || settings.publicContact.email || "Not configured";
  return settings.legal.cancellationPolicy ? "Cancellation policy added" : "Not configured";
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-[#28251f]">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs font-semibold leading-relaxed text-[#746d61]">{hint}</span>}
    </label>
  );
}

function ToggleRow({ checked, label, description, disabled = false, onChange }: { checked: boolean; label: string; description: string; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={`flex items-center justify-between gap-4 rounded-xl border border-[#e1d8c5] bg-[#fffdf8] p-3.5 ${disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer"}`}>
      <span><strong className="block text-sm text-[#28251f]">{label}</strong><small className="mt-1 block text-xs font-semibold leading-relaxed text-[#746d61]">{description}</small></span>
      <input className="h-5 w-5 shrink-0 accent-[#d6b46a]" checked={checked} disabled={disabled} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="settings-panel rounded-2xl border border-[#e1d8c5] bg-[#fffdf8] p-4 shadow-[0_12px_30px_rgba(55,48,35,0.07)] sm:p-6">
      <h2 className="text-lg font-black text-[#28251f]">{title}</h2>
      <p className="mt-1 text-sm font-semibold leading-relaxed text-[#746d61]">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function AdminSettingsView({ settings, loading, saving, onSave }: Props) {
  const [draft, setDraft] = useState<BusinessSettings | null>(settings);
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingBlackout, setEditingBlackout] = useState<BlackoutDate | null>(null);
  const [newRecipient, setNewRecipient] = useState("");
  const [pendingSection, setPendingSection] = useState<SettingsSection | null | undefined>();
  const [savedToast, setSavedToast] = useState("");
  const [showSocialLinks, setShowSocialLinks] = useState(false);
  const [showAfterHours, setShowAfterHours] = useState(false);

  useEffect(() => {
    setDraft(settings);
    setShowSocialLinks(Boolean(settings?.publicContact.facebookUrl || settings?.publicContact.instagramUrl || settings?.publicContact.linkedinUrl));
    setShowAfterHours(Boolean(settings?.publicContact.emergencyMessage));
  }, [settings]);

  const visibleSection = activeSection || "business";
  const dirty = useMemo(() => {
    if (!settings || !draft) return false;
    return JSON.stringify(sectionPayload(visibleSection, draft)) !== JSON.stringify(sectionPayload(visibleSection, settings));
  }, [draft, settings, visibleSection]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (loading && !draft) return <div className="rounded-2xl bg-white p-8 text-center text-sm font-bold text-slate-500">Loading business settings...</div>;
  if (!settings || !draft) return <div className="rounded-2xl bg-white p-8 text-center text-sm font-bold text-slate-500">Business settings are unavailable.</div>;

  const navigateToSection = (next: SettingsSection | null) => {
    setActiveSection(next);
    setEditingDay(null);
    setEditingBlackout(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chooseSection = (next: SettingsSection | null) => {
    if (dirty) {
      setPendingSection(next);
      return;
    }
    navigateToSection(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!dirty) return;
    const message = sectionMessage(visibleSection);
    if (await onSave(sectionPayload(visibleSection, draft), message)) {
      setSavedToast(message);
      window.setTimeout(() => setSavedToast(""), 2400);
    }
  };

  const addRecipient = () => {
    const email = newRecipient.trim().toLowerCase();
    if (!email || draft.ownerNotificationEmails.includes(email)) return;
    setDraft({ ...draft, ownerNotificationEmails: [...draft.ownerNotificationEmails, email] });
    setNewRecipient("");
  };

  return (
    <div className="settings-mobile md:grid md:grid-cols-[240px_minmax(0,1fr)] md:gap-5">
      <aside className="hidden self-start rounded-2xl border border-[#d8caa6] bg-[#24211c] p-2 shadow-lg md:sticky md:top-24 md:block">
        <p className="px-3 pb-2 pt-3 text-xs font-black uppercase tracking-[0.16em] text-[#d6b46a]">Inställningar</p>
        {sectionMeta.map((item) => {
          const Icon = item.icon;
          const selected = visibleSection === item.id;
          return <button className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${selected ? "bg-[#d6b46a] text-[#171614]" : "text-[#cfc6b4] hover:bg-white/10"}`} key={item.id} onClick={() => chooseSection(item.id)} type="button"><Icon size={18} /><span className="min-w-0"><strong className="block text-sm">{item.title}</strong><small className={`block truncate text-[11px] font-semibold ${selected ? "text-[#5c4720]" : "text-[#a99f8e]"}`}>{item.description}</small></span></button>;
        })}
      </aside>

      {!activeSection && (
        <div className="md:hidden">
          <div className="px-1 pb-4 pt-1"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#8a7652]">Manage</p><h1 className="mt-1 text-2xl font-black tracking-tight text-[#28251f]">Business settings</h1><p className="mt-1 text-sm font-semibold text-[#746d61]">Update the details customers rely on.</p></div>
          <div className="overflow-hidden rounded-2xl border border-[#ded8cb] bg-white shadow-[0_10px_30px_rgba(35,31,25,0.06)]">
            {sectionMeta.map((item, index) => {
              const Icon = item.icon;
              return <button className={`flex min-h-[72px] w-full items-center gap-3 px-4 text-left transition active:bg-[#f6f3ed] ${index > 0 ? "border-t border-[#ebe6dc]" : ""}`} key={item.id} onClick={() => chooseSection(item.id)} type="button"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f0ece3] text-[#6f5d36]"><Icon size={19} /></span><span className="min-w-0 flex-1"><strong className="block text-[15px] text-[#28251f]">{item.title}</strong><small className="mt-0.5 block truncate text-xs font-medium text-[#7b7468]">{summaryFor(item.id, settings)}</small></span><ChevronRight className="shrink-0 text-[#b2a995]" size={18} /></button>;
            })}
          </div>
        </div>
      )}

      <form className={`${!activeSection ? "hidden md:block" : "block"} min-w-0`} onSubmit={submit}>
        <div className="mb-4 flex items-center gap-3 px-1 pt-1 md:hidden">
          <button aria-label="Back to settings" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#28251f] shadow-sm" onClick={() => chooseSection(null)} type="button"><ArrowLeft size={19} /></button>
          <div className="min-w-0"><h1 className="truncate text-xl font-black tracking-tight text-[#28251f]">{sectionMeta.find((item) => item.id === visibleSection)?.title}</h1><p className="truncate text-xs font-medium text-[#746d61]">{sectionMeta.find((item) => item.id === visibleSection)?.description}</p></div>
        </div>

        {visibleSection === "business" && <BusinessSection draft={draft} setDraft={setDraft} />}
        {visibleSection === "availability" && <AvailabilitySection draft={draft} setDraft={setDraft} dirty={dirty} onEditDay={setEditingDay} onEditBlackout={setEditingBlackout} />}
        {visibleSection === "booking" && <BookingSection draft={draft} setDraft={setDraft} />}
        {visibleSection === "notifications" && <NotificationsSection draft={draft} setDraft={setDraft} newRecipient={newRecipient} setNewRecipient={setNewRecipient} addRecipient={addRecipient} />}
        {visibleSection === "public" && <PublicSection draft={draft} setDraft={setDraft} showSocialLinks={showSocialLinks} setShowSocialLinks={setShowSocialLinks} showAfterHours={showAfterHours} setShowAfterHours={setShowAfterHours} />}
        {visibleSection === "policies" && <PoliciesSection draft={draft} setDraft={setDraft} />}

        {dirty && <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.7rem)] z-30 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#d8caa6] bg-white/95 p-3 shadow-[0_12px_34px_rgba(35,31,25,0.18)] backdrop-blur md:bottom-4">
          <strong className="min-w-0 truncate text-sm text-amber-700">Unsaved changes</strong>
          <div className="flex gap-2"><button className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[#675f53]" disabled={saving} onClick={() => setDraft(settings)} type="button"><RotateCcw size={15} />Discard</button><button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#24211c] px-4 text-sm font-black text-white disabled:opacity-45" disabled={saving} type="submit"><Save size={16} />{saving ? "Saving..." : "Save changes"}</button></div>
        </div>}
      </form>

      {editingDay !== null && <DayEditor canClose={draft.weeklySchedule.filter((day) => day.enabled).length > 1 || !draft.weeklySchedule.find((day) => day.weekday === editingDay)!.enabled} day={draft.weeklySchedule.find((day) => day.weekday === editingDay)!} onClose={() => setEditingDay(null)} onCommit={(source, selectedDays) => { setDraft({ ...draft, weeklySchedule: draft.weeklySchedule.map((day) => selectedDays.includes(day.weekday) ? { ...source, weekday: day.weekday, openings: source.openings.map((range) => ({ ...range })), breaks: source.breaks.map((range) => ({ ...range })) } : day) }); setEditingDay(null); }} />}
      {editingBlackout !== null && <BlackoutEditor blackout={editingBlackout} existing={draft.blackoutDates.some((item) => item.id === editingBlackout.id)} onCommit={(next) => { const exists = draft.blackoutDates.some((item) => item.id === next.id); setDraft({ ...draft, blackoutDates: exists ? draft.blackoutDates.map((item) => item.id === next.id ? next : item) : [...draft.blackoutDates, next] }); setEditingBlackout(null); }} onDelete={() => { setDraft({ ...draft, blackoutDates: draft.blackoutDates.filter((item) => item.id !== editingBlackout.id) }); setEditingBlackout(null); }} onClose={() => setEditingBlackout(null)} />}
      {pendingSection !== undefined && <DiscardChangesDialog onKeep={() => setPendingSection(undefined)} onDiscard={() => { setDraft(settings); const next = pendingSection; setPendingSection(undefined); navigateToSection(next ?? null); }} />}
      {savedToast && <div aria-live="polite" className="fixed bottom-[calc(env(safe-area-inset-bottom)+6rem)] left-1/2 z-[80] -translate-x-1/2 rounded-full bg-[#24211c] px-4 py-2.5 text-sm font-bold text-white shadow-xl">{savedToast}</div>}
    </div>
  );
}

function BusinessSection({ draft, setDraft }: { draft: BusinessSettings; setDraft: (value: BusinessSettings) => void }) {
  const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const timezoneValid = isValidTimezone(draft.timezone);
  const initials = draft.businessName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "B";
  const timezoneOptions = [...new Set([draft.timezone, deviceTimezone, ...commonTimezones])].filter(Boolean);

  return <div className="space-y-4">
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f4c5c] to-[#17343b] p-4 text-white shadow-[0_14px_34px_rgba(15,76,92,0.2)]">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#dfc3ae]">Salongsprofil</p>
      <div className="mt-3 flex items-center gap-3"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 text-lg font-black ring-1 ring-white/15">{initials}</span><div className="min-w-0"><h2 className="truncate text-xl font-black">{draft.businessName.trim() || "Salongens namn"}</h2><p className="mt-1 flex items-center gap-1.5 truncate text-xs font-semibold text-[#dfc3ae]"><Clock3 size={13} />{timezoneValid ? draft.timezone : "Tidszonen behöver kontrolleras"}</p></div></div>
    </section>

    <Panel title="Salongsinformation" description="Används i bokningsflödet och i kundernas e-postmeddelanden.">
      <div className="overflow-hidden rounded-xl border border-[#d9e7e4] bg-white">
        <div className="p-3"><Field label="Salongens namn"><input autoComplete="organization" className="field-input" maxLength={120} required value={draft.businessName} onChange={(event) => setDraft({ ...draft, businessName: event.target.value })} /></Field></div>
        <div className="border-t border-[#e7efed] p-3"><Field label="Ansvarigs e-post" hint="Används som salongens huvudsakliga kontakt. Mottagare av bokningsaviseringar hanteras under Aviseringar."><input autoComplete="email" className="field-input" type="email" required value={draft.ownerEmail} onChange={(event) => setDraft({ ...draft, ownerEmail: event.target.value })} /></Field></div>
      </div>
    </Panel>

    <Panel title="Salongens tidszon" description="Styr öppettider, tidsangivelser och schemalagda e-postmeddelanden.">
      <Field label="Tidszon" hint="Befintliga bokningar behåller sin sparade tid om inställningen ändras."><input aria-describedby={!timezoneValid ? "timezone-error" : undefined} aria-invalid={!timezoneValid} className="field-input" list="business-timezones" placeholder="Europe/Stockholm" ref={(input) => input?.setCustomValidity(timezoneValid ? "" : "Välj en giltig IANA-tidszon")} required value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} /><datalist id="business-timezones">{timezoneOptions.map((timezone) => <option key={timezone} value={timezone} />)}</datalist></Field>
      {!timezoneValid && <p className="mt-2 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700" id="timezone-error">Välj en giltig tidszon, exempelvis Europe/Stockholm.</p>}
      {deviceTimezone !== draft.timezone && <button className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#e7f3f1] text-sm font-black text-[#0f5c66]" onClick={() => setDraft({ ...draft, timezone: deviceTimezone })} type="button"><Clock3 size={16} />Använd enhetens tidszon ({deviceTimezone})</button>}
      {timezoneValid && <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800"><CheckCircleIcon />Giltig tidszon</div>}
    </Panel>
  </div>;
}

function CheckCircleIcon() {
  return <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-[11px] text-white">✓</span>;
}

function AvailabilitySection({ draft, setDraft, dirty, onEditDay, onEditBlackout }: { draft: BusinessSettings; setDraft: (value: BusinessSettings) => void; dirty: boolean; onEditDay: (weekday: number) => void; onEditBlackout: (value: BlackoutDate) => void }) {
  const [tab, setTab] = useState<"hours" | "timeoff">("hours");
  const [preview, setPreview] = useState<AvailabilityDay[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  useEffect(() => { if (dirty) setPreview(null); }, [dirty]);
  const today = new Date().toISOString().slice(0, 10);
  const openDayCount = draft.weeklySchedule.filter((day) => day.enabled).length;
  const upcoming = draft.blackoutDates.filter((item) => item.endDate >= today).sort((left, right) => left.startDate.localeCompare(right.startDate));
  const past = draft.blackoutDates.filter((item) => item.endDate < today).sort((left, right) => right.startDate.localeCompare(left.startDate));
  const updateDay = (weekday: number, transform: (day: WeeklyScheduleDay) => WeeklyScheduleDay) => setDraft({ ...draft, weeklySchedule: draft.weeklySchedule.map((day) => day.weekday === weekday ? transform(day) : day) });
  const addBlackout = () => onEditBlackout({ id: crypto.randomUUID(), startDate: today, endDate: today, reason: "" });
  const loadPreview = async () => {
    if (dirty || !draft.services[0]) return;
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const response = await getAvailability(Math.min(7, draft.bookingRules.bookingWindowDays), draft.services[0].id);
      setPreview(response.days);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Could not load availability preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  return <div className="space-y-4">
    <div className="grid grid-cols-2 rounded-xl bg-[#dfeae8] p-1">
      <button aria-pressed={tab === "hours"} className={`min-h-11 rounded-lg text-sm font-black ${tab === "hours" ? "bg-white text-[#17343b] shadow-sm" : "text-[#637a7d]"}`} onClick={() => setTab("hours")} type="button">Weekly hours</button>
      <button aria-pressed={tab === "timeoff"} className={`min-h-11 rounded-lg text-sm font-black ${tab === "timeoff" ? "bg-white text-[#17343b] shadow-sm" : "text-[#637a7d]"}`} onClick={() => setTab("timeoff")} type="button">Time off</button>
    </div>

    {tab === "hours" && <>
      <Panel title="Opening schedule" description={`${openDayCount} days open each week`}>
        <div className="overflow-hidden rounded-xl border border-[#d9e7e4] bg-white">
          {draft.weeklySchedule.map((day, index) => <div className={`flex min-h-[68px] items-center gap-3 px-3 ${index > 0 ? "border-t border-[#e7efed]" : ""}`} key={day.weekday}>
            <button aria-label={`${day.enabled ? "Close" : "Open"} ${weekdayNames[day.weekday - 1]}`} className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${day.enabled ? "bg-emerald-500" : "bg-slate-300"}`} disabled={day.enabled && openDayCount === 1} onClick={() => updateDay(day.weekday, (current) => ({ ...current, enabled: !current.enabled, openings: !current.enabled && current.openings.length === 0 ? [{ start: "09:00", end: "17:00" }] : current.openings }))} type="button"><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${day.enabled ? "left-6" : "left-1"}`} /></button>
            <button className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left" onClick={() => onEditDay(day.weekday)} type="button"><span className="w-10 shrink-0 text-sm font-black text-[#334b50]">{weekdayNames[day.weekday - 1].slice(0, 3)}</span><span className="min-w-0 flex-1"><strong className={`block text-sm ${day.enabled ? "text-[#17343b]" : "text-[#8a9798]"}`}>{day.enabled && day.openings[0] ? `${day.openings[0].start} - ${day.openings[0].end}` : "Closed"}</strong>{day.enabled && day.breaks[0] && <small className="mt-0.5 block truncate text-xs font-semibold text-amber-700">Break {day.breaks[0].start} - {day.breaks[0].end}</small>}</span><ChevronRight size={17} className="shrink-0 text-[#96aaa7]" /></button>
          </div>)}
        </div>
      </Panel>

      <Panel title="Appointment spacing" description="How often a new appointment can begin.">
        <div className="grid grid-cols-4 gap-2">{[{ value: 30, label: "30m" }, { value: 60, label: "1h" }, { value: 120, label: "2h" }].map((option) => <button aria-pressed={draft.slotIntervalMinutes === option.value} className={`min-h-12 rounded-xl border text-sm font-black ${draft.slotIntervalMinutes === option.value ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-[#d9e7e4] bg-white text-[#637a7d]"}`} key={option.value} onClick={() => setDraft({ ...draft, slotIntervalMinutes: option.value })} type="button">{option.label}</button>)}<button aria-pressed={![30, 60, 120].includes(draft.slotIntervalMinutes)} className={`min-h-12 rounded-xl border text-xs font-black ${![30, 60, 120].includes(draft.slotIntervalMinutes) ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-[#d9e7e4] bg-white text-[#637a7d]"}`} onClick={() => setDraft({ ...draft, slotIntervalMinutes: 90 })} type="button">Other</button></div>
        {![30, 60, 120].includes(draft.slotIntervalMinutes) && <div className="mt-3"><Field label="Custom spacing"><select className="field-input" value={draft.slotIntervalMinutes} onChange={(event) => setDraft({ ...draft, slotIntervalMinutes: Number(event.target.value) })}>{[15, 45, 90, 180].map((value) => <option key={value} value={value}>{value} minutes</option>)}</select></Field></div>}
      </Panel>

      <Panel title="Customer preview" description="Check the next customer-visible times using the saved schedule.">
        {dirty && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Save your changes before previewing.</p>}
        {!dirty && !preview && <button className="min-h-11 w-full rounded-xl bg-[#e7f3f1] text-sm font-black text-[#0f5c66]" disabled={previewLoading} onClick={() => void loadPreview()} type="button">{previewLoading ? "Loading..." : "Preview availability"}</button>}
        {previewError && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{previewError}</p>}
        {!dirty && preview && <div className="space-y-2">{preview.flatMap((day) => day.slots.filter((slot) => slot.isAvailable).slice(0, 2).map((slot) => ({ day: day.dateLabel, time: slot.timeLabel }))).slice(0, 5).map((slot) => <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f2f8f7] px-3 py-2.5 text-sm" key={`${slot.day}-${slot.time}`}><strong className="text-[#334b50]">{slot.day}</strong><span className="font-bold text-emerald-700">{slot.time}</span></div>)}{preview.every((day) => day.slots.every((slot) => !slot.isAvailable)) && <p className="text-sm font-semibold text-[#637a7d]">No open customer times in the next seven days.</p>}</div>}
      </Panel>
    </>}

    {tab === "timeoff" && <Panel title="Time off" description="Close online booking for holidays or time away.">
      {upcoming.length === 0 ? <div className="rounded-xl bg-[#f2f8f7] p-5 text-center"><CalendarOff className="mx-auto text-[#7ca19c]" size={24} /><strong className="mt-2 block text-sm text-[#334b50]">No upcoming closures</strong><span className="mt-1 block text-xs font-semibold text-[#637a7d]">Add time off whenever the business will be closed.</span></div> : <div className="overflow-hidden rounded-xl border border-[#d9e7e4] bg-white">{upcoming.map((item, index) => <button className={`flex min-h-[64px] w-full items-center gap-3 px-3 text-left ${index > 0 ? "border-t border-[#e7efed]" : ""}`} key={item.id} onClick={() => onEditBlackout(item)} type="button"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><CalendarOff size={18} /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-[#334b50]">{item.reason || "Closed"}</strong><small className="mt-0.5 block text-xs font-semibold text-[#637a7d]">{item.startDate}{item.endDate !== item.startDate ? ` to ${item.endDate}` : ""}</small></span><ChevronRight size={17} className="text-[#96aaa7]" /></button>)}</div>}
      <button className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0f4c5c] text-sm font-black text-white" onClick={addBlackout} type="button"><Plus size={16} />Add time off</button>
      {past.length > 0 && <details className="mt-4 rounded-xl bg-[#f2f8f7] p-3"><summary className="cursor-pointer text-sm font-bold text-[#637a7d]">Past time off ({past.length})</summary><div className="mt-2 space-y-1">{past.map((item) => <button className="flex w-full justify-between gap-3 rounded-lg px-2 py-2 text-left text-xs font-semibold text-[#637a7d]" key={item.id} onClick={() => onEditBlackout(item)} type="button"><span>{item.reason || "Closed"}</span><span>{item.startDate}</span></button>)}</div></details>}
    </Panel>}
  </div>;
}

function BookingSection({ draft, setDraft }: { draft: BusinessSettings; setDraft: (value: BusinessSettings) => void }) {
  const numberRules = [{ key: "bookingWindowDays", label: "Customers can book up to", suffix: "days ahead", max: 90 }, { key: "minimumNoticeHours", label: "Require at least", suffix: "hours notice", max: 8760 }, { key: "cancellationNoticeHours", label: "Allow cancellation until", suffix: "hours before", max: 8760 }, { key: "rescheduleNoticeHours", label: "Allow rescheduling until", suffix: "hours before", max: 8760 }] as const;
  const confirmationOptions = [{ value: "request", title: "Request", description: "Tell customers the owner will review the booking." }, { value: "instant", title: "Instant", description: "Tell customers the appointment is confirmed." }] as const;
  return <div className="space-y-4"><Panel title="Timing rules" description="Simple limits for new bookings and customer self-service."><div className="overflow-hidden rounded-xl border border-[#e7e1d6] bg-white">{numberRules.map((rule, index) => <label className={`grid grid-cols-[1fr_76px] items-center gap-3 px-3 py-3 ${index > 0 ? "border-t border-[#eee9df]" : ""}`} key={rule.key}><span><strong className="block text-sm text-[#28251f]">{rule.label}</strong><small className="text-xs font-medium text-[#746d61]">{rule.suffix}</small></span><input aria-label={`${rule.label} ${rule.suffix}`} className="field-input text-center font-bold" max={rule.max} min={rule.key === "bookingWindowDays" ? 1 : 0} required type="number" value={draft.bookingRules[rule.key]} onChange={(event) => setDraft({ ...draft, bookingRules: { ...draft.bookingRules, [rule.key]: Number(event.target.value) } })} /></label>)}</div></Panel><Panel title="Customer details" description="Choose what the booking form must collect."><div className="space-y-2"><ToggleRow checked={draft.bookingRules.requirePhone} label="Require phone number" description="Customers must provide a callback number." onChange={(checked) => setDraft({ ...draft, bookingRules: { ...draft.bookingRules, requirePhone: checked } })} /><ToggleRow checked={draft.bookingRules.requireNotes} label="Require booking notes" description="Customers must add details before submitting." onChange={(checked) => setDraft({ ...draft, bookingRules: { ...draft.bookingRules, requireNotes: checked } })} /></div></Panel><Panel title="Confirmation" description="Choose the message customers receive after booking."><div className="grid grid-cols-2 rounded-xl bg-[#eee9df] p-1">{confirmationOptions.map((option) => <button aria-pressed={draft.bookingRules.confirmationMode === option.value} className={`min-h-11 rounded-lg text-sm font-black transition ${draft.bookingRules.confirmationMode === option.value ? "bg-white text-[#28251f] shadow-sm" : "text-[#746d61]"}`} key={option.value} onClick={() => setDraft({ ...draft, bookingRules: { ...draft.bookingRules, confirmationMode: option.value } })} type="button">{option.title}</button>)}</div><p className="mt-3 text-xs font-semibold leading-relaxed text-[#746d61]">{confirmationOptions.find((option) => option.value === draft.bookingRules.confirmationMode)?.description}</p></Panel></div>;
}

function NotificationsSection({ draft, setDraft, newRecipient, setNewRecipient, addRecipient }: { draft: BusinessSettings; setDraft: (value: BusinessSettings) => void; newRecipient: string; setNewRecipient: (value: string) => void; addRecipient: () => void }) {
  return <Panel title="Booking notifications" description="Choose who receives new-booking alerts."><div className="overflow-hidden rounded-xl border border-[#e7e1d6] bg-white">{draft.ownerNotificationEmails.map((email, index) => <div className={`flex min-h-[52px] items-center gap-3 px-3 ${index > 0 ? "border-t border-[#eee9df]" : ""}`} key={email}><Mail className="shrink-0 text-[#8a7652]" size={16} /><span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#403b33]">{email}</span><button aria-label={`Remove ${email}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#8b8376] disabled:opacity-30" disabled={draft.ownerNotificationEmails.length === 1} onClick={() => setDraft({ ...draft, ownerNotificationEmails: draft.ownerNotificationEmails.filter((item) => item !== email) })} type="button"><X size={16} /></button></div>)}</div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input aria-label="New notification recipient" className="field-input" placeholder="name@example.com" type="email" value={newRecipient} onChange={(event) => setNewRecipient(event.target.value)} /><button className="min-h-11 shrink-0 rounded-xl bg-[#f0ece3] px-4 text-sm font-bold text-[#5d574d]" onClick={addRecipient} type="button"><span className="inline-flex items-center gap-2"><Plus size={15} />Add recipient</span></button></div><div className="mt-5"><Field label="Sender name"><input className="field-input" required value={draft.notificationEmailFromName} onChange={(event) => setDraft({ ...draft, notificationEmailFromName: event.target.value })} /></Field></div><Link className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#8a7652]" to="/admin/emails">Configure reminders, reviews and waitlist <ChevronRight size={16} /></Link></Panel>;
}

function PublicSection({ draft, setDraft, showSocialLinks, setShowSocialLinks, showAfterHours, setShowAfterHours }: { draft: BusinessSettings; setDraft: (value: BusinessSettings) => void; showSocialLinks: boolean; setShowSocialLinks: (value: boolean) => void; showAfterHours: boolean; setShowAfterHours: (value: boolean) => void }) {
  return <div className="space-y-4"><Panel title="Customer contact" description="Shown in the public website footer."><div className="grid gap-4 md:grid-cols-2"><Field label="Public email"><input className="field-input" type="email" value={draft.publicContact.email || ""} onChange={(event) => setDraft({ ...draft, publicContact: { ...draft.publicContact, email: event.target.value } })} /></Field><Field label="Public phone"><input className="field-input" type="tel" value={draft.publicContact.phone || ""} onChange={(event) => setDraft({ ...draft, publicContact: { ...draft.publicContact, phone: event.target.value } })} /></Field><div className="md:col-span-2"><Field label="Address"><textarea className="field-input min-h-24" maxLength={500} value={draft.publicContact.address || ""} onChange={(event) => setDraft({ ...draft, publicContact: { ...draft.publicContact, address: event.target.value } })} /></Field></div></div></Panel>{showSocialLinks ? <Panel title="Social links" description="Leave any network blank to hide it."><div className="grid gap-4">{(["facebookUrl", "instagramUrl", "linkedinUrl"] as const).map((key) => <Field key={key} label={key.replace("Url", " URL")}><input className="field-input" placeholder="https://" type="url" value={draft.publicContact[key] || ""} onChange={(event) => setDraft({ ...draft, publicContact: { ...draft.publicContact, [key]: event.target.value } })} /></Field>)}</div></Panel> : <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#675f53] shadow-sm" onClick={() => setShowSocialLinks(true)} type="button"><Plus size={16} />Add social links</button>}{showAfterHours ? <Panel title="After-hours message" description="Optional guidance displayed above the public footer."><Field label="Message"><textarea className="field-input min-h-28" maxLength={500} value={draft.publicContact.emergencyMessage || ""} onChange={(event) => setDraft({ ...draft, publicContact: { ...draft.publicContact, emergencyMessage: event.target.value } })} /></Field></Panel> : <button className="ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#675f53] shadow-sm" onClick={() => setShowAfterHours(true)} type="button"><Plus size={16} />Add after-hours message</button>}</div>;
}

function PoliciesSection({ draft, setDraft }: { draft: BusinessSettings; setDraft: (value: BusinessSettings) => void }) {
  return <Panel title="Customer policies" description="Information shown on the privacy page."><div className="space-y-4"><Field label="Privacy contact email"><input className="field-input" type="email" value={draft.legal.privacyContactEmail || ""} onChange={(event) => setDraft({ ...draft, legal: { ...draft.legal, privacyContactEmail: event.target.value } })} /></Field><Field label="Cancellation policy" hint="Keep this concise and have the final wording reviewed for the business location."><textarea className="field-input min-h-44" maxLength={4000} value={draft.legal.cancellationPolicy || ""} onChange={(event) => setDraft({ ...draft, legal: { ...draft.legal, cancellationPolicy: event.target.value } })} /></Field></div></Panel>;
}

function DiscardChangesDialog({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  return <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/40 p-3" role="presentation"><section aria-labelledby="discard-settings-title" aria-modal="true" className="w-full rounded-3xl bg-white p-5 shadow-2xl" role="dialog"><h2 className="text-lg font-black text-[#28251f]" id="discard-settings-title">Discard changes?</h2><p className="mt-2 text-sm font-medium leading-relaxed text-[#746d61]">Your edits in this section have not been saved.</p><div className="mt-5 grid gap-2"><button autoFocus className="min-h-12 rounded-xl bg-[#24211c] text-sm font-black text-white" onClick={onKeep} type="button">Keep editing</button><button className="min-h-12 rounded-xl text-sm font-bold text-rose-700" onClick={onDiscard} type="button">Discard changes</button></div></section></div>;
}

function DialogShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const titleId = `settings-dialog-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 p-3 sm:items-center sm:justify-center" onMouseDown={onClose} role="presentation"><section aria-labelledby={titleId} aria-modal="true" className="max-h-[88vh] w-full overflow-y-auto rounded-2xl bg-[#fffdf8] p-4 shadow-2xl sm:max-w-lg sm:p-6" onMouseDown={(event) => event.stopPropagation()} role="dialog"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-black text-[#28251f]" id={titleId}>{title}</h2><button aria-label="Close editor" autoFocus className="grid h-10 w-10 place-items-center rounded-xl bg-[#f4f0e6]" onClick={onClose} type="button"><X size={18} /></button></div>{children}</section></div>;
}

function DayEditor({ day, canClose, onClose, onCommit }: { day: WeeklyScheduleDay; canClose: boolean; onClose: () => void; onCommit: (day: WeeklyScheduleDay, selectedDays: number[]) => void }) {
  const [localDay, setLocalDay] = useState<WeeklyScheduleDay>({ ...day, openings: day.openings.map((item) => ({ ...item })), breaks: day.breaks.map((item) => ({ ...item })) });
  const [selectedDays, setSelectedDays] = useState<number[]>([day.weekday]);
  const opening = localDay.openings[0] || { start: "09:00", end: "17:00" };
  const breakRange = localDay.breaks[0] || { start: "12:00", end: "13:00" };
  const openingValid = opening.start < opening.end;
  const breakValid = localDay.breaks.length === 0 || (breakRange.start < breakRange.end && breakRange.start >= opening.start && breakRange.end <= opening.end);
  const valid = !localDay.enabled || (openingValid && breakValid);
  const error = !openingValid ? "Closing time must be after opening time." : !breakValid ? "The break must sit inside opening hours." : "";
  const windows = !localDay.enabled ? [] : localDay.breaks.length > 0 ? [`${opening.start} - ${breakRange.start}`, `${breakRange.end} - ${opening.end}`] : [`${opening.start} - ${opening.end}`];
  const toggleTargetDay = (weekday: number) => setSelectedDays((current) => current.includes(weekday) ? current.filter((item) => item !== weekday) : [...current, weekday]);

  return <DialogShell title={weekdayNames[day.weekday - 1]} onClose={onClose}><div className="space-y-4">
    <ToggleRow checked={localDay.enabled} disabled={localDay.enabled && !canClose} label="Open for bookings" description={localDay.enabled && !canClose ? "At least one day must remain open." : localDay.enabled ? "Customers can choose times on this day." : "No new times will be offered."} onChange={(checked) => setLocalDay({ ...localDay, enabled: checked, openings: checked && localDay.openings.length === 0 ? [opening] : localDay.openings })} />
    {localDay.enabled && <>
      <div className="grid grid-cols-2 gap-3"><Field label="Opens"><input className="field-input" type="time" value={opening.start} onChange={(event) => setLocalDay({ ...localDay, openings: [{ ...opening, start: event.target.value }] })} /></Field><Field label="Closes"><input className="field-input" type="time" value={opening.end} onChange={(event) => setLocalDay({ ...localDay, openings: [{ ...opening, end: event.target.value }] })} /></Field></div>
      <ToggleRow checked={localDay.breaks.length > 0} label="Add a break" description="Appointments cannot overlap this time." onChange={(checked) => setLocalDay({ ...localDay, breaks: checked ? [breakRange] : [] })} />
      {localDay.breaks.length > 0 && <div className="grid grid-cols-2 gap-3"><Field label="Break starts"><input className="field-input" type="time" value={breakRange.start} onChange={(event) => setLocalDay({ ...localDay, breaks: [{ ...breakRange, start: event.target.value }] })} /></Field><Field label="Break ends"><input className="field-input" type="time" value={breakRange.end} onChange={(event) => setLocalDay({ ...localDay, breaks: [{ ...breakRange, end: event.target.value }] })} /></Field></div>}
      <div className="rounded-xl bg-[#f2f8f7] p-3"><div className="flex h-3 overflow-hidden rounded-full bg-slate-200"><span className="flex-1 bg-emerald-500" />{localDay.breaks.length > 0 && <span className="w-8 bg-amber-300" />}{localDay.breaks.length > 0 && <span className="flex-1 bg-emerald-500" />}</div><p className="mt-2 text-xs font-black uppercase tracking-wide text-[#637a7d]">Bookable windows</p>{windows.map((window) => <span className="mt-1 mr-2 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700" key={window}>{window}</span>)}</div>
    </>}
    {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
    <details className="rounded-xl border border-[#d9e7e4] bg-white p-3"><summary className="cursor-pointer text-sm font-bold text-[#334b50]"><span className="inline-flex items-center gap-2"><Copy size={15} />Apply to other days</span></summary><div className="mt-3 grid grid-cols-2 gap-2">{weekdayNames.map((name, index) => <label className="flex min-h-10 items-center gap-2 rounded-lg bg-[#f2f8f7] px-2 text-xs font-bold text-[#334b50]" key={name}><input checked={selectedDays.includes(index + 1)} disabled={index + 1 === day.weekday} type="checkbox" onChange={() => toggleTargetDay(index + 1)} />{name}</label>)}</div></details>
    <button className="min-h-12 w-full rounded-xl bg-[#0f4c5c] text-sm font-black text-white disabled:opacity-40" disabled={!valid || selectedDays.length === 0} onClick={() => onCommit(localDay, selectedDays)} type="button">Apply schedule</button>
  </div></DialogShell>;
}

function BlackoutEditor({ blackout, existing, onCommit, onDelete, onClose }: { blackout: BlackoutDate; existing: boolean; onCommit: (value: BlackoutDate) => void; onDelete: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState({ ...blackout });
  const valid = Boolean(draft.startDate && draft.endDate && draft.startDate <= draft.endDate);
  const presets = ["Holiday", "Vacation", "Closed"];
  return <DialogShell title={existing ? "Edit time off" : "Add time off"} onClose={onClose}><div className="space-y-4">
    <div className="grid grid-cols-2 gap-3"><Field label="Starts"><input className="field-input" required type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></Field><Field label="Ends"><input className="field-input" required type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></Field></div>
    <div><span className="mb-2 block text-sm font-bold text-[#28251f]">Reason</span><div className="flex flex-wrap gap-2">{presets.map((reason) => <button aria-pressed={draft.reason === reason} className={`min-h-10 rounded-full px-4 text-xs font-black ${draft.reason === reason ? "bg-amber-100 text-amber-800" : "bg-[#f2f8f7] text-[#637a7d]"}`} key={reason} onClick={() => setDraft({ ...draft, reason })} type="button">{reason}</button>)}</div><input aria-label="Custom time off reason" className="field-input mt-3" maxLength={160} placeholder="Other reason" value={draft.reason || ""} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} /></div>
    {!valid && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">End date cannot be before the start date.</p>}
    <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold leading-relaxed text-amber-800">Existing bookings are not canceled or moved when time off is added.</p>
    <div className={`grid gap-2 ${existing ? "grid-cols-2" : "grid-cols-1"}`}>{existing && <button className="min-h-12 rounded-xl text-sm font-bold text-rose-700" onClick={onDelete} type="button">Delete</button>}<button className="min-h-12 rounded-xl bg-[#0f4c5c] text-sm font-black text-white disabled:opacity-40" disabled={!valid} onClick={() => onCommit(draft)} type="button">{existing ? "Save time off" : "Add time off"}</button></div>
  </div></DialogShell>;
}
