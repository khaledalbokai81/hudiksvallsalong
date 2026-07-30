import {
  AlertCircle,
  CheckCircle2,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Clock,
  Mail,
  Phone,
  RotateCcw,
  Trash2
} from "lucide-react";
import { useState } from "react";
import type { Booking } from "../../types";
import { formatBusinessDateTime } from "../../lib/time";

type BookingTableProps = {
  bookings: Booking[];
  emptyMessage: string;
  mode: "active" | "resolved" | "canceled";
  onResolve?: (bookingId: string) => void;
  onReopen?: (bookingId: string) => void;
  onDelete: (bookingId: string, customerName: string) => void;
  busyBookingId?: string;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
};

function formatDate(value: string) {
  return formatBusinessDateTime(value);
}

function isSameLocalDay(value: string | undefined, reference: Date) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

function isNewLead(value: string) {
  return Date.now() - new Date(value).getTime() <= 24 * 60 * 60 * 1000;
}

function isPastAppointment(value: string | undefined) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

function getLeadBadges(booking: Booking) {
  const badges: Array<{ label: string; className: string }> = [];
  const today = new Date();

  if (booking.status === "resolved") {
    badges.push({ label: "Avslutad", className: "bg-emerald-50 text-emerald-700" });
  } else if (booking.status === "canceled") {
    badges.push({ label: "Avbokad", className: "bg-rose-50 text-rose-700" });
  } else {
    badges.push({ label: "Aktiv", className: "bg-blue-50 text-blue-700" });
  }

  if (booking.status === "open" && isNewLead(booking.createdAt)) {
    badges.push({ label: "Ny", className: "bg-indigo-50 text-indigo-700" });
  }

  if (booking.status === "open" && isSameLocalDay(booking.appointmentAt, today)) {
    badges.push({ label: "I dag", className: "bg-sky-50 text-sky-700" });
  }

  if (!booking.emailVerified) {
    badges.push({ label: "Overifierad", className: "bg-amber-50 text-amber-700" });
  }

  if (booking.status === "open" && isPastAppointment(booking.appointmentAt)) {
    badges.push({ label: "Försenad", className: "bg-red-50 text-red-700" });
  }

  return badges;
}

function previewNotes(notes?: string) {
  if (!notes) {
    return "Inga anteckningar";
  }

  return notes.length > 110 ? `${notes.slice(0, 110)}...` : notes;
}

function compactAppointmentLabel(value?: string) {
  if (!value) {
    return "Inte schemalagd";
  }

  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function BookingTable({
  bookings,
  emptyMessage,
  mode,
  onResolve,
  onReopen,
  onDelete,
  busyBookingId,
  hasActiveFilters,
  onResetFilters
}: BookingTableProps) {
  const [expandedMobileLeadId, setExpandedMobileLeadId] = useState<string>();

  if (bookings.length === 0) {
    return (
      <div className="p-8 text-center text-sm font-semibold text-slate-500">
        <AlertCircle className="mx-auto mb-3 text-slate-400" size={24} aria-hidden="true" />
        <p>{hasActiveFilters ? "No leads match the current view." : emptyMessage}</p>
        {hasActiveFilters && onResetFilters && (
          <button className="classic-button mt-4" onClick={onResetFilters} type="button">
            Reset filters
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-2 md:hidden">
        {bookings.map((booking) => (
          <MobileLeadCard
            key={booking._id}
            booking={booking}
            busy={busyBookingId === booking._id}
            expanded={expandedMobileLeadId === booking._id}
            mode={mode}
            onDelete={onDelete}
            onExpandedChange={() =>
              setExpandedMobileLeadId((current) =>
                current === booking._id ? undefined : booking._id
              )
            }
            onReopen={onReopen}
            onResolve={onResolve}
          />
        ))}
      </div>

    <div className="hidden overflow-x-auto md:block">
      <table className="min-w-[1040px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-4 py-3 font-bold">Lead</th>
            <th className="px-4 py-3 font-bold">Bokad tid</th>
            <th className="px-4 py-3 font-bold">Kontakt</th>
            <th className="px-4 py-3 font-bold">
              {mode === "resolved" ? "Avslutad" : mode === "canceled" ? "Avbokad" : "Inkommen"}
            </th>
            <th className="px-4 py-3 font-bold">Anteckningar</th>
            <th className="px-4 py-3 font-bold">Åtgärder</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {bookings.map((booking) => {
            const isBusy = busyBookingId === booking._id;
            const badges = getLeadBadges(booking);

            return (
              <tr key={booking._id} className="queue-row">
                <td className="px-4 py-4 align-top">
                  <div className="font-bold text-ink">{booking.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {badges.map((badge) => (
                      <span
                        key={badge.label}
                        className={`inline-flex rounded px-2 py-0.5 text-[11px] font-bold uppercase ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-xs font-semibold text-slate-500">
                    Boknings-ID {booking._id.slice(-8)}
                  </div>
                </td>
                <td className="px-4 py-4 align-top">
                  <span className="inline-flex rounded bg-aqua px-3 py-1 text-xs font-bold text-ink">
                    {booking.serviceName}
                  </span>
                  {booking.appointmentAt && (
                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <CalendarClock size={14} aria-hidden="true" />
                      {formatDate(booking.appointmentAt)}
                    </div>
                  )}
                  {!booking.appointmentAt && (
                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <CalendarClock size={14} aria-hidden="true" />
                      Not scheduled
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail size={15} aria-hidden="true" />
                    {booking.email}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-slate-700">
                    <Phone size={15} aria-hidden="true" />
                    {booking.phone}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a className="classic-button" href={`mailto:${booking.email}`}>
                      <Mail size={14} aria-hidden="true" />
                      E-post
                    </a>
                    <a className="classic-button" href={`tel:${booking.phone}`}>
                      <Phone size={14} aria-hidden="true" />
                      Ring
                    </a>
                  </div>
                  <div className="mt-3">
                    <span
                      className={`inline-flex items-center rounded px-2.5 py-1 text-xs font-bold ${
                        booking.emailVerified
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                      title={
                        booking.emailVerifiedAt
                          ? `Verified ${formatDate(booking.emailVerifiedAt)}`
                          : "Customer has not verified their email yet"
                      }
                    >
                      {booking.emailVerified ? "E-post verifierad" : "E-post inte verifierad"}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4 align-top font-semibold text-slate-600">
                  <div className="flex items-center gap-2">
                    <Clock size={14} aria-hidden="true" />
                    {formatDate(
                      mode === "resolved" && booking.resolvedAt
                        ? booking.resolvedAt
                        : mode === "canceled" && booking.canceledAt
                          ? booking.canceledAt
                          : booking.createdAt
                    )}
                  </div>
                  {mode !== "active" && (
                    <div className="mt-2 text-xs font-semibold text-slate-400">
                      Inkommen {formatDate(booking.createdAt)}
                    </div>
                  )}
                </td>
                <td className="max-w-xs px-4 py-4 align-top text-slate-600" title={booking.notes || undefined}>
                  {previewNotes(booking.notes)}
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="flex flex-wrap gap-2">
                    {mode === "active" && onResolve && (
                      <button
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                        onClick={() => onResolve(booking._id)}
                        disabled={isBusy}
                        type="button"
                      >
                        <CheckCircle2 size={15} aria-hidden="true" />
                        Avsluta
                      </button>
                    )}
                    {(mode === "resolved" || mode === "canceled") && onReopen && (
                      <button
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
                        onClick={() => onReopen(booking._id)}
                        disabled={isBusy}
                        type="button"
                      >
                        <RotateCcw size={15} aria-hidden="true" />
                        Reopen
                      </button>
                    )}
                    <button
                      className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                      onClick={() => onDelete(booking._id, booking.name)}
                      disabled={isBusy}
                      type="button"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      Radera
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

function MobileLeadCard({
  booking,
  busy,
  expanded,
  mode,
  onDelete,
  onExpandedChange,
  onReopen,
  onResolve
}: {
  booking: Booking;
  busy: boolean;
  expanded: boolean;
  mode: "active" | "resolved" | "canceled";
  onDelete: (bookingId: string, customerName: string) => void;
  onExpandedChange: () => void;
  onReopen?: (bookingId: string) => void;
  onResolve?: (bookingId: string) => void;
}) {
  const badges = getLeadBadges(booking)
    .filter((badge) => badge.label !== "Open")
    .slice(0, 1);
  const mobileDetailsId = `mobile-lead-details-${booking._id}`;

  return (
    <article className="overflow-hidden rounded-xl border border-[#e1d8c5] bg-white shadow-sm">
      <button
        aria-expanded={expanded}
        aria-controls={mobileDetailsId}
        aria-label={`${expanded ? "Hide" : "Show"} details for ${booking.name}`}
        className="flex w-full items-center gap-3 p-3 text-left"
        onClick={onExpandedChange}
        type="button"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-bold text-[#171614]">{booking.name}</h3>
            {badges[0] && (
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${badges[0].className}`}>
                {badges[0].label}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs font-semibold text-[#746d61]">{booking.serviceName}</p>
          <span className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-[#8a7652]">
            <CalendarClock size={13} aria-hidden="true" />
            {compactAppointmentLabel(booking.appointmentAt)}
          </span>
        </div>
        <span className="shrink-0 text-[#a3833d]">
          {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        </span>
      </button>

      {expanded && (
        <div id={mobileDetailsId} className="border-t border-[#eee7d8] bg-white px-3 pb-3 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <a
              className="flex min-h-14 min-w-0 items-center gap-2 rounded-lg bg-[#171614] px-3 text-[#f8f2dd]"
              href={`tel:${booking.phone}`}
            >
              <Phone className="shrink-0 text-[#f1d48a]" size={17} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[9px] font-bold uppercase text-[#cfc6b4]">Call</span>
                <strong className="block truncate text-xs">{booking.phone}</strong>
              </span>
            </a>
            <a
              className="flex min-h-14 min-w-0 items-center gap-2 rounded-lg bg-[#171614] px-3 text-[#f8f2dd]"
              href={`mailto:${booking.email}`}
            >
              <Mail className="shrink-0 text-[#f1d48a]" size={17} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[9px] font-bold uppercase text-[#cfc6b4]">Email</span>
                <strong className="block truncate text-xs">{booking.email}</strong>
              </span>
            </a>
          </div>

          <div className="mt-3 divide-y divide-[#e8dcc2] rounded-lg bg-[#f7f3ea] px-3">
            <div className="flex items-start justify-between gap-3 py-2.5">
              <span className="text-[10px] font-bold uppercase text-[#8a7652]">Appointment</span>
              <strong className="text-right text-xs text-[#171614]">
                {booking.appointmentAt ? formatDate(booking.appointmentAt) : "Not scheduled"}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[10px] font-bold uppercase text-[#8a7652]">Email status</span>
              <strong className={`text-xs ${booking.emailVerified ? "text-emerald-700" : "text-amber-700"}`}>
                {booking.emailVerified ? "Verified" : "Not verified"}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[10px] font-bold uppercase text-[#8a7652]">Submitted</span>
              <strong className="text-right text-xs text-[#171614]">{formatDate(booking.createdAt)}</strong>
            </div>
          </div>

          {booking.notes && (
            <div className="mt-3 rounded-lg border border-[#e8dcc2] px-3 py-2.5">
              <span className="text-[9px] font-bold uppercase text-[#8a7652]">Notes</span>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#5d574d]">{booking.notes}</p>
            </div>
          )}

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-[#eee7d8] pt-3">
            {mode === "active" && onResolve && (
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busy}
                onClick={() => onResolve(booking._id)}
                type="button"
              >
                <CheckCircle2 size={17} aria-hidden="true" />
                {busy ? "Updating..." : "Mark resolved"}
              </button>
            )}
            {(mode === "resolved" || mode === "canceled") && onReopen && (
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#171614] px-4 text-sm font-bold text-[#f8f2dd] shadow-sm transition hover:bg-[#2a2823] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busy}
                onClick={() => onReopen(booking._id)}
                type="button"
              >
                <RotateCcw size={17} aria-hidden="true" />
                {busy ? "Updating..." : "Reopen lead"}
              </button>
            )}
            <button
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 text-xs font-bold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
              onClick={() => onDelete(booking._id, booking.name)}
              type="button"
              aria-label={`Delete ${booking.name}'s lead`}
            >
              <Trash2 size={16} aria-hidden="true" />
              Delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
