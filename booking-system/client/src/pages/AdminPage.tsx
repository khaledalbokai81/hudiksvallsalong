import { AlertCircle, Lock } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  adminLogin,
  adminLogout,
  deleteBooking,
  getAdminSession,
  getBusinessSettings,
  getBookings,
  getEmailAutomations,
  getLeadSummary,
  reopenBooking,
  resolveBooking,
  retryEmailJob,
  updateBusinessSettings,
  updateEmailAutomations
} from "../api";
import {
  AdminNavbar,
  CalendarView,
  EmailsView,
  LeadsView,
  MobileAdminBottomNav,
} from "./admin/AdminPageParts";
import { AdminSettingsView } from "./admin/AdminSettingsView";
import { SalonMapFooter } from "../components/SalonMapFooter";
import type {
  Booking,
  BusinessSettings,
  EmailAutomationDashboard,
  EmailAutomationSettings,
  LeadSummary,
  Pagination
} from "../types";

type AdminSection = "bookings" | "leads" | "emails" | "settings";
type QueueView = "active" | "resolved" | "canceled";
type QuickFilter = "all" | "new" | "today" | "upcoming" | "unverified" | "needs-follow-up";

const LEADS_PAGE_SIZE = 10;
const EMPTY_PAGINATION: Pagination = { page: 1, limit: LEADS_PAGE_SIZE, total: 0, totalPages: 0 };

function getAdminSection(pathname: string): AdminSection | null {
  if (pathname === "/admin" || pathname === "/admin/") {
    return "bookings";
  }

  if (pathname === "/admin/leads") {
    return "leads";
  }

  if (pathname === "/admin/emails") {
    return "emails";
  }

  if (pathname === "/admin/settings") {
    return "settings";
  }

  return null;
}

export function AdminPage() {
  const location = useLocation();
  const section = getAdminSection(location.pathname);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [leadSummary, setLeadSummary] = useState<LeadSummary | null>(null);
  const [emailDashboard, setEmailDashboard] = useState<EmailAutomationDashboard | null>(null);
  const [emailDraft, setEmailDraft] = useState<EmailAutomationSettings | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingEmails, setSavingEmails] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<string>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [view, setView] = useState<QueueView>("active");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [leadPage, setLeadPage] = useState(1);
  const [leadPagination, setLeadPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const [showLeadCategories, setShowLeadCategories] = useState(false);
  const [showLeadTracking, setShowLeadTracking] = useState(false);
  const [busyBookingId, setBusyBookingId] = useState<string>();

  async function loadBookingData(signal?: AbortSignal) {
    const [bookingsResponse, summaryResponse] = await Promise.all([
      getBookings({
        status: view === "active" ? "open" : view,
        quickFilter: view === "active" ? quickFilter : "all",
        query: debouncedQuery,
        page: leadPage,
        limit: LEADS_PAGE_SIZE,
        signal
      }),
      getLeadSummary(signal)
    ]);

    setBookings(bookingsResponse.bookings);
    setLeadPagination(bookingsResponse.pagination);
    setLeadSummary(summaryResponse.summary);
  }

  async function loadEmailData() {
    const response = await getEmailAutomations();

    setEmailDashboard(response);
    setEmailDraft(response.settings);
  }

  async function loadSectionData(targetSection = section, signal?: AbortSignal) {
    if (!targetSection || !authenticated) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (targetSection === "emails") {
        await loadEmailData();
      } else if (targetSection === "settings") {
        const response = await getBusinessSettings();
        setBusinessSettings(response.settings);
      } else if (targetSection === "leads") {
        await loadBookingData(signal);
      } else {
        await Promise.resolve();
      }
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") {
        return;
      }

      const nextError =
        requestError instanceof Error ? requestError.message : "Could not load admin data.";
      setError(nextError);

      if (nextError.toLowerCase().includes("admin login")) {
        setAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await getAdminSession();
        setAuthenticated(response.authenticated);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Could not check admin session.");
      } finally {
        setAuthChecking(false);
      }
    }

    void checkSession();
  }, []);

  useEffect(() => {
    if (authenticated && section && section !== "leads") {
      void loadSectionData(section);
    }
  }, [authenticated, section]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setLeadPage(1);
  }, [debouncedQuery, quickFilter, view]);

  useEffect(() => {
    if (!authenticated || section !== "leads") {
      return;
    }

    const controller = new AbortController();
    void loadSectionData("leads", controller.signal);
    return () => controller.abort();
  }, [authenticated, section, debouncedQuery, quickFilter, view, leadPage]);

  const activeCount = leadSummary?.openLeads ?? 0;
  const resolvedCount = leadSummary?.resolvedLeads ?? 0;
  const canceledCount = leadSummary?.canceledLeads ?? 0;
  const today = new Date();
  const todayCount = leadSummary?.todayOpen ?? 0;
  const newCount = leadSummary?.newOpenLast24Hours ?? 0;
  const upcomingCount = leadSummary?.upcomingOpen ?? 0;
  const unverifiedCount = leadSummary?.unverifiedOpen ?? 0;
  const followUpCount = leadSummary?.needsFollowUp ?? 0;
  async function runBookingAction(bookingId: string, action: () => Promise<unknown>) {
    setBusyBookingId(bookingId);
    setError("");
    setMessage("");

    try {
      await action();
      await loadBookingData();
      setMessage("Booking updated.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Booking action failed.");
    } finally {
      setBusyBookingId(undefined);
    }
  }

  function handleResolve(bookingId: string) {
    void runBookingAction(bookingId, () => resolveBooking(bookingId));
  }

  function handleReopen(bookingId: string) {
    void runBookingAction(bookingId, () => reopenBooking(bookingId));
  }

  function handleDelete(bookingId: string, customerName: string) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${customerName}'s booking? This cannot be undone.`
    );

    if (confirmed) {
      void runBookingAction(bookingId, () => deleteBooking(bookingId));
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginBusy(true);
    setError("");

    try {
      await adminLogin(password);
      setPassword("");
      setAuthenticated(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Admin login failed.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    setError("");

    try {
      await adminLogout();
    } finally {
      setAuthenticated(false);
      setBookings([]);
      setLeadSummary(null);
      setEmailDashboard(null);
      setEmailDraft(null);
      setBusinessSettings(null);
      setLoading(false);
    }
  }

  async function handleSaveEmailSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!emailDraft) {
      return;
    }

    setSavingEmails(true);
    setError("");
    setMessage("");

    try {
      await updateEmailAutomations({
        ownerBookingNoticeEnabled: emailDraft.ownerBookingNoticeEnabled,
        bookingReminderEnabled: emailDraft.bookingReminderEnabled,
        reviewRequestEnabled: emailDraft.reviewRequestEnabled,
        reminderLeadHours: emailDraft.reminderLeadHours,
        reviewRequestDelayHours: emailDraft.reviewRequestDelayHours,
        reviewUrl: emailDraft.reviewUrl || undefined,
        waitlistEnabled: emailDraft.waitlistEnabled,
        waitlistOfferMinutes: emailDraft.waitlistOfferMinutes
      });
      await loadEmailData();
      setMessage("Email automation settings saved.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save email settings.");
    } finally {
      setSavingEmails(false);
    }
  }

  async function handleRetryEmailJob(jobId: string) {
    setRetryingJobId(jobId);
    setError("");
    setMessage("");

    try {
      await retryEmailJob(jobId);
      await loadEmailData();
      setMessage("Email job queued for retry.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not retry email job.");
    } finally {
      setRetryingJobId(undefined);
    }
  }

  async function handleSaveBusinessSettings(input: Partial<BusinessSettings>, successMessage: string) {
    setSavingSettings(true);
    setError("");
    setMessage("");

    try {
      const response = await updateBusinessSettings(input);
      setBusinessSettings(response.settings);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save business settings.");
      return false;
    } finally {
      setSavingSettings(false);
    }
  }

  if (!section) {
    return <Navigate to="/admin" replace />;
  }

  if (authChecking) {
    return (
      <div className="salon-admin-root min-h-screen bg-cloud text-ink">
        <AdminNavbar loading={false} section={section} />
        <section className="admin-shell mx-auto max-w-3xl px-5 py-16 lg:px-8">
          <div className="rounded-lg bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-soft">
            Checking admin session...
          </div>
        </section>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="salon-admin-root salon-admin-login min-h-screen bg-cloud text-ink">
        <AdminNavbar loading={false} section={section} />
        <section className="admin-shell mx-auto max-w-xl px-5 py-16 lg:px-8">
          <div className="rounded-lg bg-white p-6 shadow-soft sm:p-8">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-aqua text-ink">
                <Lock size={24} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-mint">
                  Hudiksvalls Salong
                </span>
                <h1 className="mt-2 text-3xl font-bold text-ink">Admininloggning</h1>
                <form onSubmit={handleLogin} className="mt-6 space-y-4">
                  <label className="block">
                    <span className="field-label">Lösenord</span>
                    <input
                      className="field-input"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </label>
                  <button
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={loginBusy}
                    type="submit"
                  >
                    <Lock size={18} aria-hidden="true" />
                    {loginBusy ? "Loggar in..." : "Logga in"}
                  </button>
                </form>
                {error && (
                  <div className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="salon-admin-root mobile-admin-palette min-h-screen bg-[#f4f3ef] text-ink">
      <AdminNavbar
        loading={loading}
        section={section}
        onLogout={() => void handleLogout()}
        onRefresh={section === "bookings" || section === "settings" ? undefined : () => void loadSectionData(section)}
      />
      <section className="admin-shell mx-auto max-w-7xl bg-[#f4f3ef] px-2.5 pb-28 pt-3 md:bg-[#eceff3] md:px-5 md:pb-6 md:pt-6 lg:px-8">
        <div className="classic-admin-header hidden md:flex">
          <div>
            <span>Hudiksvalls Salong · Admin</span>
            <h1>
              {section === "bookings"
                ? "Bokningskalender"
                : section === "leads"
                  ? "Bokningar & kunder"
                  : section === "emails"
                    ? "E-postutskick"
                    : "Salongsinställningar"}
            </h1>
            <p>{new Intl.DateTimeFormat("sv-SE", { dateStyle: "full" }).format(today)}</p>
          </div>
        </div>

      {error && (
        <div className="admin-alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          {error}
        </div>
      )}

      {message && (
        <div aria-live="polite" className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700" role="status">
          {message}
        </div>
      )}

      {section === "bookings" && <CalendarView />}

      {section === "leads" && (
        <LeadsView
          activeCount={activeCount}
          canceledCount={canceledCount}
          filteredBookings={bookings}
          loading={loading}
          pagination={leadPagination}
          query={query}
          quickFilter={quickFilter}
          showCategories={showLeadCategories}
          showTracking={showLeadTracking}
          resolvedCount={resolvedCount}
          summary={leadSummary}
          newCount={newCount}
          upcomingCount={upcomingCount}
          followUpCount={followUpCount}
          todayCount={todayCount}
          unverifiedCount={unverifiedCount}
          view={view}
          busyBookingId={busyBookingId}
          onDelete={handleDelete}
          onQueryChange={setQuery}
          onPageChange={setLeadPage}
          onQuickFilterChange={setQuickFilter}
          onShowCategoriesChange={setShowLeadCategories}
          onShowTrackingChange={setShowLeadTracking}
          onReopen={handleReopen}
          onResolve={handleResolve}
          onResetFilters={() => {
            setQuery("");
            setQuickFilter("all");
            setView("active");
          }}
          onViewChange={setView}
        />
      )}

      {section === "emails" && (
        <EmailsView
          dashboard={emailDashboard}
          draft={emailDraft}
          loading={loading}
          retryingJobId={retryingJobId}
          saving={savingEmails}
          onDraftChange={setEmailDraft}
          onRetry={handleRetryEmailJob}
          onSave={handleSaveEmailSettings}
        />
      )}

      {section === "settings" && (
        <AdminSettingsView
          settings={businessSettings}
          loading={loading}
          saving={savingSettings}
          onSave={handleSaveBusinessSettings}
        />
      )}

      </section>
      <SalonMapFooter />
      <MobileAdminBottomNav section={section} />
    </div>
  );
}
