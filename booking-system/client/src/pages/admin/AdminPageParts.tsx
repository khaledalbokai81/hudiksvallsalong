import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  Inbox,
  LogOut,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  Trash2,
  X,
  XCircle
} from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { ActiveBookings } from "../../components/admin/ActiveBookings";
import { AvailabilityCalendar } from "../../components/admin/AvailabilityCalendar";
import { LeadTracker } from "../../components/admin/LeadTracker";
import { ResolvedBookings } from "../../components/admin/ResolvedBookings";
import { templateConfig } from "../../template";
import type { Booking, LeadSummary, Pagination } from "../../types";

type AdminSection = "bookings" | "leads" | "emails" | "settings";
type QueueView = "active" | "resolved" | "canceled";
type QuickFilter = "all" | "new" | "today" | "upcoming" | "unverified" | "needs-follow-up";

function getSectionTitle(section: AdminSection) {
  if (section === "bookings") {
    return "Kalender";
  }

  if (section === "leads") {
    return "Bokningar";
  }

  return section === "emails" ? "E-post" : "Inställningar";
}

function formatMobileHeaderDate() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date());
}

export function AdminNavbar({
  loading,
  section,
  onLogout,
  onRefresh
}: {
  loading: boolean;
  section: AdminSection;
  onLogout?: () => void;
  onRefresh?: () => void;
}) {
  return (
    <header className="salon-admin-nav sticky top-0 z-40 hidden md:block">
      <nav className="salon-admin-navbar-inner">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/admin" className="salon-admin-brand">
            <img src="/hudiksvalls-salong-wordmark.svg" alt="Hudiksvalls Salong" />
            <span>ADMIN</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 lg:hidden"
          >
            <ExternalLink size={16} aria-hidden="true" />
            Visa webbplats
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { to: "/admin/leads", label: "Bokningar", icon: BarChart3 },
            { to: "/admin", label: "Kalender", icon: CalendarDays },
            { to: "/admin/emails", label: "E-post", icon: Mail },
            { to: "/admin/settings", label: "Inställningar", icon: Settings }
          ].map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/admin"}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-white text-slate-950"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white"
                  }`
                }
              >
                <Icon size={16} aria-hidden="true" />
                {item.label}
              </NavLink>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/"
            className="hidden items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 lg:inline-flex"
          >
            <ExternalLink size={16} aria-hidden="true" />
            Visa webbplats
          </Link>
          {onRefresh && (
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"
              disabled={loading}
              onClick={onRefresh}
              type="button"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
              Uppdatera
            </button>
          )}
          {onLogout && (
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              onClick={onLogout}
              type="button"
            >
              <LogOut size={16} aria-hidden="true" />
              Logga ut
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}

export function MobileAdminTopbar({
  loading,
  section,
  stats,
  onLogout,
  onRefresh
}: {
  loading: boolean;
  section: AdminSection;
  stats?: Array<{ label: string; value: number }>;
  onLogout?: () => void;
  onRefresh?: () => void;
}) {
  const SectionIcon =
    section === "leads"
      ? Inbox
      : section === "emails"
        ? Mail
        : section === "settings"
          ? Settings
          : CalendarDays;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#3a3020] bg-gradient-to-b from-[#211f1b] to-[#141311] px-3 py-2.5 text-white shadow-[0_10px_26px_rgba(17,16,14,0.24)] md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#d6b46a]/30 bg-[#d6b46a] text-[#171614] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
            <SectionIcon size={19} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-white">
              {getSectionTitle(section)}
            </h1>
            <p className="mt-0.5 truncate text-xs font-semibold text-[#d6b46a]">
              {formatMobileHeaderDate()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            to="/"
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/10 text-[#f1d48a] transition hover:bg-white/15"
            aria-label="View website"
          >
            <ExternalLink size={18} aria-hidden="true" />
          </Link>
          {onRefresh && (
            <button
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/10 text-[#f1d48a] transition hover:bg-white/15 disabled:opacity-60"
              disabled={loading}
              onClick={onRefresh}
              type="button"
              aria-label="Refresh"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          )}
          {onLogout && (
            <button
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/10 text-[#f1d48a] transition hover:bg-white/15"
              onClick={onLogout}
              type="button"
              aria-label="Log out"
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {stats && stats.length > 0 && (
        <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
          {stats.map((item, index) => (
            <div
              key={item.label}
              className={`rounded-lg border px-2 py-1.5 ${
                index === 0
                  ? "border-[#d6b46a]/50 bg-[#d6b46a] text-[#171614]"
                  : "border-white/10 bg-white/5 text-[#cfc6b4]"
              }`}
            >
              <strong className="block text-sm leading-none">{item.value}</strong>
              <span className={`mt-0.5 block truncate text-[10px] font-bold uppercase ${
                index === 0 ? "text-[#5c4720]" : "text-[#a99f8e]"
              }`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}

export function MobileAdminBottomNav({ section }: { section: AdminSection }) {
  const items = [
    { to: "/admin/leads", label: "Bokningar", icon: Inbox, active: section === "leads" },
    { to: "/admin", label: "Kalender", icon: CalendarDays, active: section === "bookings" },
    { to: "/admin/emails", label: "E-post", icon: Mail, active: section === "emails" },
    { to: "/admin/settings", label: "Inställningar", icon: Settings, active: section === "settings" }
  ];

  return (
    <nav className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 rounded-2xl border border-[#2b2822] bg-[#171614] p-2 shadow-[0_16px_38px_rgba(17,16,14,0.34)] md:hidden">
        <div className="grid grid-cols-4 gap-1.5">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin"}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold transition ${
                item.active
                  ? "bg-[#d6b46a] text-[#171614]"
                  : "bg-white/5 text-[#cfc6b4] hover:bg-white/10 hover:text-[#f1d48a]"
              }`}
            >
              <Icon size={19} aria-hidden="true" />
              {item.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

type BookingsViewProps = {
  activeCount: number;
  canceledCount: number;
  filteredBookings: Booking[];
  loading: boolean;
  pagination: Pagination;
  query: string;
  quickFilter: QuickFilter;
  showCategories: boolean;
  showTracking: boolean;
  newCount: number;
  upcomingCount: number;
  followUpCount: number;
  resolvedCount: number;
  todayCount: number;
  unverifiedCount: number;
  view: QueueView;
  busyBookingId?: string;
  onDelete: (bookingId: string, customerName: string) => void;
  onQueryChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onQuickFilterChange: (value: QuickFilter) => void;
  onShowCategoriesChange: (value: boolean) => void;
  onShowTrackingChange: (value: boolean) => void;
  onReopen: (bookingId: string) => void;
  onResolve: (bookingId: string) => void;
  onResetFilters: () => void;
  onViewChange: (value: QueueView) => void;
};

export function CalendarView() {
  return (
    <fieldset className="classic-fieldset border-0 bg-transparent p-0 shadow-none md:border md:bg-white md:p-4">
      <legend className="hidden md:block">Bokningskalender</legend>
      <AvailabilityCalendar />
    </fieldset>
  );
}

function BookingsView({
  activeCount,
  canceledCount,
  filteredBookings,
  loading,
  pagination,
  newCount,
  query,
  quickFilter,
  showCategories,
  showTracking,
  upcomingCount,
  followUpCount,
  resolvedCount,
  todayCount,
  unverifiedCount,
  view,
  busyBookingId,
  onDelete,
  onQueryChange,
  onPageChange,
  onQuickFilterChange,
  onShowCategoriesChange,
  onShowTrackingChange,
  onReopen,
  onResolve,
  onResetFilters,
  onViewChange
}: BookingsViewProps) {
  const hasActiveFilters = view !== "active" || quickFilter !== "all" || query.trim().length > 0;
  const activeQuickFilters: Array<[QuickFilter, string, number]> = [
    ["all", "Alla", activeCount],
    ["new", "Nya", newCount],
    ["today", "I dag", todayCount],
    ["upcoming", "Kommande", upcomingCount],
    ["unverified", "Overifierade", unverifiedCount],
    ["needs-follow-up", "Behöver följas upp", followUpCount]
  ];
  const activeFilterLabel =
    activeQuickFilters.find(([value]) => value === quickFilter)?.[1] || "Alla";
  const activeQuickFilterValues = activeQuickFilters.filter(([value]) => value !== "all");
  const totalPages = Math.max(1, pagination.totalPages);
  const currentPage = Math.min(pagination.page, totalPages);
  const shownStart = pagination.total === 0 ? 0 : (currentPage - 1) * pagination.limit + 1;
  const shownEnd = pagination.total === 0 ? 0 : Math.min(shownStart + filteredBookings.length - 1, pagination.total);

  return (
    <>
      <fieldset className="classic-fieldset border-0 bg-transparent p-0 shadow-none md:border md:bg-white md:p-4">
        <legend className="hidden md:block">Bokningsöversikt</legend>
        <div className="classic-section-toolbar border-b-0 pb-0 md:border-b md:pb-3">
          <div>
            <h2 className="hidden md:block">Kundbokningar</h2>
            <p className="text-xs font-semibold text-slate-500 md:text-sm">
              Visar {shownStart}–{shownEnd} av {pagination.total} träffar, totalt {activeCount + resolvedCount + canceledCount} bokningar
              {quickFilter !== "all" && view === "active" ? ` - ${activeFilterLabel}` : ""}
            </p>
          </div>
          <div className="hidden md:block">
            <label className="classic-search">
              <Search size={18} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Sök namn, telefon, e-post eller behandling"
              />
            </label>
          </div>
        </div>

        <div className="mt-2 md:hidden">
          <div className="flex h-11 items-center gap-2 rounded-xl border border-[#d8caa6] bg-white px-3 text-[#a3833d] shadow-sm">
            <Search size={15} aria-hidden="true" />
            <input
              aria-label="Search leads"
              className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-[#171614] outline-none placeholder:text-[#a8a197]"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search leads"
            />
            {query && (
              <button
                aria-label="Clear lead search"
                className="grid h-7 w-7 place-items-center rounded-full bg-[#f4f0e6] text-[#746d61]"
                onClick={() => onQueryChange("")}
                type="button"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-[#24211c] p-1 shadow-sm md:hidden">
          {([
            ["active", "Active", activeCount],
            ["resolved", "Resolved", resolvedCount],
            ["canceled", "Canceled", canceledCount]
          ] as Array<[QueueView, string, number]>).map(([value, label, count]) => (
            <button
              key={value}
              aria-pressed={view === value}
              className={`min-h-9 rounded-md px-2 text-xs font-bold transition ${
                view === value
                  ? "bg-[#d6b46a] text-[#171614] shadow-sm"
                  : "text-[#cfc6b4]"
              }`}
              onClick={() => onViewChange(value)}
              type="button"
            >
              {label} <span className={view === value ? "text-[#5c4720]" : "text-[#8f8677]"}>{count}</span>
            </button>
          ))}
        </div>

        {view === "active" && (
          <details className="mt-2 rounded-xl border border-[#e1d8c5] bg-white shadow-sm md:hidden">
            <summary className="cursor-pointer list-none px-3 py-3 text-xs font-bold text-[#5c4720]">
              Filter: {activeFilterLabel}
              <span className="float-right text-[#a3833d]">Change</span>
            </summary>
            <div className="grid grid-cols-2 gap-2 border-t border-[#eee7d8] p-2.5">
              {activeQuickFilterValues.map(([value, label, count]) => (
                <button
                  key={value}
                  aria-pressed={quickFilter === value}
                  className={`rounded-lg border px-3 py-2.5 text-left text-xs font-bold transition ${
                    quickFilter === value
                      ? "border-[#171614] bg-[#171614] text-[#f1d48a]"
                      : value === "needs-follow-up" && count > 0
                        ? "border-[#d6b46a] bg-[#fbf2d9] text-[#5c4720]"
                        : "border-[#e1d8c5] bg-white text-[#5d574d]"
                  }`}
                  onClick={() => onQuickFilterChange(quickFilter === value ? "all" : value)}
                  type="button"
                >
                  {label} <span className={quickFilter === value ? "text-[#d6b46a]/75" : "text-[#a8a197]"}>{count}</span>
                </button>
              ))}
              {hasActiveFilters && (
                <button
                  className="col-span-2 rounded-lg bg-[#f4f0e6] px-3 py-2 text-xs font-bold text-[#746d61]"
                  onClick={onResetFilters}
                  type="button"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </details>
        )}

        <div className="mt-3 hidden border-b border-slate-200 pb-3 md:block">
          <button
            className="classic-button w-full justify-center md:w-auto"
            onClick={() => onShowCategoriesChange(!showCategories)}
            type="button"
          >
            {showCategories ? (
              <ChevronUp size={16} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} aria-hidden="true" />
            )}
            {showCategories ? "Dölj kategorier" : "Visa kategorier"}
          </button>

          {showCategories && (
            <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              {activeQuickFilters.map(([value, label, count]) => (
                <button
                  key={value}
                  className={`rounded border px-3 py-2 text-left text-sm font-bold transition ${
                    quickFilter === value && view === "active"
                      ? "border-slate-700 bg-slate-800 text-white"
                      : value === "needs-follow-up" && count > 0
                        ? "border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  onClick={() => {
                    onViewChange("active");
                    onQuickFilterChange(value);
                  }}
                  type="button"
                >
                  <span className="block text-lg leading-none">{count}</span>
                  <span className="mt-1 block text-xs uppercase">{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="classic-filter-row mt-2 hidden border-b-0 pb-0 md:flex md:mt-3 md:border-b md:pb-3">
          <div className="classic-tabs grid w-full grid-cols-3 md:flex md:w-auto">
            <button
              className={`queue-tab ${view === "active" ? "active" : ""}`}
              onClick={() => onViewChange("active")}
              type="button"
            >
              Aktiva
              <span>{activeCount}</span>
            </button>
            <button
              className={`queue-tab ${view === "resolved" ? "active" : ""}`}
              onClick={() => onViewChange("resolved")}
              type="button"
            >
              Avslutade
              <span>{resolvedCount}</span>
            </button>
            <button
              className={`queue-tab ${view === "canceled" ? "active" : ""}`}
              onClick={() => onViewChange("canceled")}
              type="button"
            >
              Avbokade
              <span>{canceledCount}</span>
            </button>
          </div>
          <div className="classic-filter-buttons" aria-label="Quick filters">
            {hasActiveFilters && (
              <button className="classic-filter-button" onClick={onResetFilters} type="button">
                Återställ vy
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="admin-empty-state">Laddar bokningar...</div>
        ) : view === "active" ? (
          <ActiveBookings
            bookings={filteredBookings}
            busyBookingId={busyBookingId}
            hasActiveFilters={hasActiveFilters}
            onResolve={onResolve}
            onDelete={onDelete}
            onResetFilters={onResetFilters}
          />
        ) : view === "resolved" ? (
          <ResolvedBookings
            bookings={filteredBookings}
            busyBookingId={busyBookingId}
            hasActiveFilters={hasActiveFilters}
            mode="resolved"
            onReopen={onReopen}
            onDelete={onDelete}
            onResetFilters={onResetFilters}
          />
        ) : (
          <ResolvedBookings
            bookings={filteredBookings}
            busyBookingId={busyBookingId}
            hasActiveFilters={hasActiveFilters}
            mode="canceled"
            onReopen={onReopen}
            onDelete={onDelete}
            onResetFilters={onResetFilters}
          />
        )}

        {!loading && pagination.totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
            <p className="text-xs font-bold text-slate-500">
              Sida {currentPage} av {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                className="classic-button"
                disabled={currentPage === 1}
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                type="button"
              >
                <ChevronLeft size={15} aria-hidden="true" />
                Föregående
              </button>
              <button
                className="classic-button"
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                type="button"
              >
                Nästa
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </fieldset>

      <div className="classic-summary-grid hidden md:grid">
        <button className="classic-summary-box interactive" onClick={() => onViewChange("active")} type="button">
          <span className="classic-summary-icon">
            <Clock size={19} aria-hidden="true" />
          </span>
          <strong>{activeCount}</strong>
          <span>Aktiva bokningar</span>
        </button>
        <button className="classic-summary-box interactive" onClick={() => onViewChange("resolved")} type="button">
          <span className="classic-summary-icon">
            <CheckCircle2 size={19} aria-hidden="true" />
          </span>
          <strong>{resolvedCount}</strong>
          <span>Avslutade</span>
        </button>
        <button className="classic-summary-box interactive" onClick={() => onViewChange("canceled")} type="button">
          <span className="classic-summary-icon">
            <XCircle size={19} aria-hidden="true" />
          </span>
          <strong>{canceledCount}</strong>
          <span>Avbokade</span>
        </button>
        <button
          className="classic-summary-box interactive"
          onClick={() => {
            onViewChange("active");
            onQuickFilterChange("needs-follow-up");
          }}
          type="button"
        >
          <span className="classic-summary-icon">
            <Inbox size={19} aria-hidden="true" />
          </span>
          <strong>{followUpCount}</strong>
          <span>Behöver följas upp</span>
        </button>
      </div>
    </>
  );
}

export function LeadsView({
  summary,
  ...bookingProps
}: BookingsViewProps & { summary: LeadSummary | null }) {
  return (
    <div className="space-y-6">
      <BookingsView {...bookingProps} />

      <details className="salon-admin-insights">
        <summary>Visa fördjupad statistik och tjänstefördelning</summary>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <fieldset className="classic-fieldset border-0 bg-transparent p-0 shadow-none md:border md:bg-white md:p-4">
          <legend className="hidden md:block">Bokningsstatistik</legend>
          <LeadTracker summary={summary} />
        </fieldset>
        <fieldset className="classic-fieldset compact hidden md:block">
          <legend>Snabböversikt</legend>
          <div className="admin-signal-grid">
            <div>
              <span>Total leads</span>
              <strong>{summary?.totalLeads ?? 0}</strong>
              <small>All captured booking requests</small>
            </div>
            <div>
              <span>Open leads</span>
              <strong>{summary?.openLeads ?? 0}</strong>
              <small>Need owner follow-up</small>
            </div>
            <div>
              <span>Last 7 days</span>
              <strong>{summary?.newLeadsLast7Days ?? 0}</strong>
              <small>Recent demand signal</small>
            </div>
          </div>
          <Link className="classic-button primary mt-4 w-full justify-center" to="/admin">
            <Inbox size={17} aria-hidden="true" />
            Öppna kalendern
          </Link>
        </fieldset>
      </div>
      </details>
    </div>
  );
}

function formatAuditAction(value: string) {
  return value
    .replaceAll(".", " ")
    .replace(/(^|\s)\w/g, (letter) => letter.toUpperCase());
}

export { EmailsView } from "./AdminEmailViews";
