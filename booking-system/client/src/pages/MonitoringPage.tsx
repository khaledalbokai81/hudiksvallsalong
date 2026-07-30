import { AlertCircle, Download, Lock, LogOut, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  getMonitorSession,
  getMonitoringDashboard,
  monitorLogin,
  monitorLogout,
  retryMonitorEmailJob,
  sendMonitorTestEmail,
  updateMonitorOperationalControls,
  unlockMonitorEmailJob,
  verifyMonitorLogin
} from "../api";
import type { MonitoringDashboard, OperationalControls } from "../types";
import { MonitoringDashboardView } from "./monitoring/MonitoringPageParts";
import {
  bookingPausePreset,
  buildIncidentSummary,
  describeOperationalChanges,
  downloadDiagnostics,
  formatDateTime,
  maintenanceBannerPreset,
  statusTone
} from "./monitoring/MonitoringPanels";

export function MonitoringPage() {
  const dashboardRequestId = useRef(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [mfaChallengeId, setMfaChallengeId] = useState("");
  const [mfaExpiresAt, setMfaExpiresAt] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [dashboard, setDashboard] = useState<MonitoringDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<string>();
  const [unlockingJobId, setUnlockingJobId] = useState<string>();
  const [testEmail, setTestEmail] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [savingControls, setSavingControls] = useState(false);
  const [controlsDraft, setControlsDraft] = useState<OperationalControls | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [clock, setClock] = useState(() => Date.now());

  async function loadDashboard() {
    const requestId = ++dashboardRequestId.current;
    setLoading(true);
    setError("");

    try {
      const response = await getMonitoringDashboard();
      if (requestId !== dashboardRequestId.current) return;
      setDashboard(response);
      setControlsDraft(response.operationalControls);
    } catch (requestError) {
      if (requestId !== dashboardRequestId.current) return;
      const nextError =
        requestError instanceof Error ? requestError.message : "Could not load monitoring data.";
      setError(nextError);

      if (nextError.toLowerCase().includes("monitor login")) {
        setAuthenticated(false);
      }
    } finally {
      if (requestId === dashboardRequestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await getMonitorSession();
        setAuthenticated(response.authenticated);
      } catch (requestError) {
        setError(
          requestError instanceof Error ? requestError.message : "Could not check monitor session."
        );
      } finally {
        setAuthChecking(false);
      }
    }

    void checkSession();
  }, []);

  useEffect(() => {
    if (authenticated) {
      void loadDashboard();
      const refreshTimer = window.setInterval(() => void loadDashboard(), 30_000);
      return () => {
        window.clearInterval(refreshTimer);
        dashboardRequestId.current += 1;
      };
    }
  }, [authenticated]);

  useEffect(() => {
    const clockTimer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(clockTimer);
  }, []);

  const overallStatus = useMemo(() => {
    if (!dashboard) {
      return { label: "Unknown", tone: "warn" as const };
    }

    if (dashboard.incidents.some((incident) => incident.severity === "critical")) {
      return { label: "Bad", tone: "bad" as const };
    }

    if (dashboard.incidents.length > 0) {
      return { label: "Needs attention", tone: "warn" as const };
    }

    return { label: "Healthy", tone: "good" as const };
  }, [dashboard]);
  const snapshotAgeSeconds = dashboard
    ? Math.max(0, Math.round((clock - new Date(dashboard.status.generatedAt).getTime()) / 1000))
    : undefined;

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await monitorLogin(password);
      setPassword("");

      if (response.mfaRequired && response.challengeId) {
        setMfaChallengeId(response.challengeId);
        setMfaExpiresAt(response.expiresAt || "");
        setMfaCode("");
        setMessage("Verification code sent to your monitoring alert email.");
        return;
      }

      setAuthenticated(response.authenticated);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Monitor login failed.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleVerifyLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMfaBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await verifyMonitorLogin(mfaChallengeId, mfaCode);
      setMfaCode("");
      setMfaChallengeId("");
      setMfaExpiresAt("");
      setAuthenticated(response.authenticated);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Monitor code failed.");
    } finally {
      setMfaBusy(false);
    }
  }

  function resetMonitorLoginChallenge() {
    setMfaChallengeId("");
    setMfaExpiresAt("");
    setMfaCode("");
    setMessage("");
    setError("");
  }

  async function handleLogout() {
    try {
      await monitorLogout();
    } finally {
      setAuthenticated(false);
      setDashboard(null);
    }
  }

  async function handleRetry(jobId: string) {
    const confirmed = window.confirm("Retry this failed email job now?");

    if (!confirmed) {
      return;
    }

    setRetryingJobId(jobId);
    setError("");
    setMessage("");

    try {
      await retryMonitorEmailJob(jobId);
      await loadDashboard();
      setMessage("Email job queued for retry.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not retry email job.");
    } finally {
      setRetryingJobId(undefined);
    }
  }

  async function handleUnlock(jobId: string) {
    const confirmed = window.confirm(
      "Unlock this stale email job and put it back into the queue?"
    );

    if (!confirmed) {
      return;
    }

    setUnlockingJobId(jobId);
    setError("");
    setMessage("");

    try {
      await unlockMonitorEmailJob(jobId);
      await loadDashboard();
      setMessage("Stale email job unlocked.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not unlock email job.");
    } finally {
      setUnlockingJobId(undefined);
    }
  }

  async function handleSendTestEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const recipient = testEmail.trim() || "the configured business owner email";
    const confirmed = window.confirm(`Send a test email to ${recipient}?`);

    if (!confirmed) {
      return;
    }

    setSendingTestEmail(true);
    setError("");
    setMessage("");

    try {
      const response = await sendMonitorTestEmail(testEmail.trim() || undefined);
      setMessage(`Test email sent to ${response.to}.`);
      await loadDashboard();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send test email.");
    } finally {
      setSendingTestEmail(false);
    }
  }

  async function handleSaveOperationalControls(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!controlsDraft) {
      return;
    }

    const currentControls = dashboard?.operationalControls;
    const changes = currentControls
      ? describeOperationalChanges(currentControls, controlsDraft)
      : ["Save operational controls"];

    if (changes.length === 0) {
      setMessage("No operational control changes to save.");
      return;
    }

    const confirmed = window.confirm(
      [
        "Apply these public operational changes?",
        "",
        ...changes.map((change) => `- ${change}`),
        "",
        controlsDraft.maintenanceBannerEnabled
          ? `Banner text: ${controlsDraft.maintenanceBannerMessage || maintenanceBannerPreset}`
          : "",
        controlsDraft.bookingsPaused
          ? `Booking pause text: ${controlsDraft.bookingPauseMessage || bookingPausePreset}`
          : ""
      ]
        .filter(Boolean)
        .join("\n")
    );

    if (!confirmed) {
      return;
    }

    setSavingControls(true);
    setError("");
    setMessage("");

    try {
      const response = await updateMonitorOperationalControls(controlsDraft);
      setControlsDraft(response.operationalControls);
      await loadDashboard();
      setMessage("Operational controls saved.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save operational controls."
      );
    } finally {
      setSavingControls(false);
    }
  }

  async function handleCopyIncidentSummary() {
    if (!dashboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildIncidentSummary(dashboard));
      setMessage("Incident summary copied.");
    } catch {
      setError("Could not copy incident summary.");
    }
  }

  if (authChecking) {
    return (
      <div className="admin-shell min-h-screen bg-[#eceff3] px-5 py-16 text-ink">
        <div className="mx-auto max-w-xl rounded-lg bg-white p-6 text-center text-sm font-semibold text-slate-600 shadow-soft">
          Checking monitor session...
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="admin-shell min-h-screen bg-[#eceff3] px-5 py-16 text-ink">
        <section className="mx-auto max-w-xl rounded-lg bg-white p-6 shadow-soft sm:p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-aqua text-ink">
              <Lock size={24} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold uppercase tracking-[0.16em] text-mint">
                Monitoring
              </span>
              <h1 className="mt-2 text-3xl font-bold text-ink">Operator login</h1>
              {mfaChallengeId ? (
                <form className="mt-6 space-y-4" onSubmit={handleVerifyLogin}>
                  <label className="block">
                    <span className="field-label">Verification code</span>
                    <input
                      autoComplete="one-time-code"
                      className="field-input"
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) =>
                        setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      pattern="[0-9]{6}"
                      required
                      type="text"
                      value={mfaCode}
                    />
                  </label>
                  {mfaExpiresAt && (
                    <p className="text-sm font-semibold text-slate-600">
                      Code expires {formatDateTime(mfaExpiresAt)}.
                    </p>
                  )}
                  <button
                    className="classic-button primary w-full justify-center"
                    disabled={mfaBusy || mfaCode.length !== 6}
                    type="submit"
                  >
                    <Lock size={17} aria-hidden="true" />
                    {mfaBusy ? "Verifying..." : "Verify code"}
                  </button>
                  <button
                    className="classic-button w-full justify-center"
                    disabled={mfaBusy}
                    onClick={resetMonitorLoginChallenge}
                    type="button"
                  >
                    Use password again
                  </button>
                </form>
              ) : (
                <form className="mt-6 space-y-4" onSubmit={handleLogin}>
                  <label className="block">
                    <span className="field-label">Password</span>
                    <input
                      autoComplete="current-password"
                      className="field-input"
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      type="password"
                      value={password}
                    />
                  </label>
                  <button
                    className="classic-button primary w-full justify-center"
                    disabled={loginBusy}
                    type="submit"
                  >
                    <Lock size={17} aria-hidden="true" />
                    {loginBusy ? "Signing in..." : "Sign in"}
                  </button>
                </form>
              )}
              {error && <div className="admin-alert" role="alert">{error}</div>}
              {message && (
                <div aria-live="polite" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700" role="status">
                  {message}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-shell min-h-screen bg-[#eceff3] text-ink">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 text-white shadow-sm">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-8">
          <div className="flex items-center gap-3 font-semibold">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-400 text-slate-950">
              <Server size={19} aria-hidden="true" />
            </span>
            <span className="leading-tight">
              Monitoring
              <span className="block text-xs font-medium uppercase text-slate-400">
                Private operator console
              </span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="classic-button"
              disabled={loading}
              onClick={() => void loadDashboard()}
              type="button"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
              Refresh
            </button>
            {dashboard && (
              <button
                className="classic-button"
                onClick={() => downloadDiagnostics(dashboard)}
                type="button"
              >
                <Download size={16} aria-hidden="true" />
                Diagnostics
              </button>
            )}
            <button className="classic-button" onClick={() => void handleLogout()} type="button">
              <LogOut size={16} aria-hidden="true" />
              Logout
            </button>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-3 pb-10 pt-5 sm:px-5 lg:px-8">
        <div className="classic-admin-header">
          <div>
            <span>System status</span>
            <h1>Monitoring dashboard</h1>
            <p>
              {dashboard
                ? `Updated ${snapshotAgeSeconds! < 60 ? `${snapshotAgeSeconds}s ago` : `${Math.floor(snapshotAgeSeconds! / 60)}m ago`} - auto-refreshes every 30s`
                : "No dashboard snapshot loaded"}
            </p>
          </div>
          <div className="classic-admin-actions">
            <span className={`rounded px-3 py-2 text-sm font-bold ${statusTone(overallStatus.tone)}`}>
              {overallStatus.label}
            </span>
          </div>
        </div>

        {error && (
          <div className="admin-alert" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            {error}
          </div>
        )}
        {message && (
          <div aria-live="polite" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700" role="status">
            {message}
          </div>
        )}

        {loading && !dashboard ? (
          <div className="admin-empty-state">Loading monitoring...</div>
        ) : dashboard ? (
          <MonitoringDashboardView
            dashboard={dashboard}
            controlsDraft={controlsDraft}
            onCopyIncidentSummary={() => void handleCopyIncidentSummary()}
            retryingJobId={retryingJobId}
            savingControls={savingControls}
            sendingTestEmail={sendingTestEmail}
            testEmail={testEmail}
            unlockingJobId={unlockingJobId}
            onRetry={(jobId) => void handleRetry(jobId)}
            onSaveOperationalControls={(event) => void handleSaveOperationalControls(event)}
            onSendTestEmail={(event) => void handleSendTestEmail(event)}
            onControlsDraftChange={setControlsDraft}
            onTestEmailChange={setTestEmail}
            onUnlock={(jobId) => void handleUnlock(jobId)}
          />
        ) : (
          <div className="admin-empty-state">Monitoring data is not available.</div>
        )}
      </main>
    </div>
  );
}
