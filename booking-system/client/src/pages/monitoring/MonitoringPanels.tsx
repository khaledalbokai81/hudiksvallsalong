import { RotateCcw, Unlock } from "lucide-react";
import { FormEvent } from "react";
import type { EmailJob, MonitoringDashboard, OperationalControls } from "../../types";

export type HealthLevel = "healthy" | "moderate" | "attention" | "bad";

export type HealthCheck = {
  key: string;
  label: string;
  level: HealthLevel;
  reason: string;
  action: string;
};

export function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

export function formatDateTime(value?: string) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatJobType(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function formatAuditAction(value: string) {
  return value
    .replaceAll(".", " ")
    .replace(/(^|\s)\w/g, (letter) => letter.toUpperCase());
}

export function statusTone(value: "good" | "warn" | "bad") {
  if (value === "good") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (value === "bad") {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-amber-50 text-amber-700";
}

export function healthTone(level: HealthLevel) {
  if (level === "healthy") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (level === "moderate") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }

  if (level === "bad") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function healthLabel(level: HealthLevel) {
  if (level === "healthy") return "Healthy";
  if (level === "moderate") return "Moderate";
  if (level === "bad") return "Bad";
  return "Needs attention";
}

function getFrontendErrorCount(dashboard: MonitoringDashboard) {
  return (
    (dashboard.frontend.eventsLast24Hours.javascript_error || 0) +
    (dashboard.frontend.eventsLast24Hours.unhandled_rejection || 0)
  );
}

export function getHealthChecks(dashboard: MonitoringDashboard): HealthCheck[] {
  const criticalIncidents = dashboard.incidents.filter((incident) => incident.severity === "critical");
  const warningIncidents = dashboard.incidents.filter((incident) => incident.severity === "warning");
  const frontendErrors = getFrontendErrorCount(dashboard);
  const failedSyntheticChecks = dashboard.syntheticChecks.filter((check) => check.status === "fail");
  const failedEmails = dashboard.emails.failed;
  const staleEmails = dashboard.emails.staleProcessing;
  const oldPendingEmails = dashboard.emails.oldPending;
  const backendErrors = dashboard.traffic.httpErrorsTotal;
  const errorRate = dashboard.traffic.errorRate;
  const averageResponse = dashboard.status.averageRequestDurationMs;

  return [
    {
      key: "overall",
      label: "Overall",
      level: criticalIncidents.length > 0 ? "bad" : warningIncidents.length > 0 ? "attention" : "healthy",
      reason:
        criticalIncidents.length > 0
          ? `${criticalIncidents.length} critical incident${criticalIncidents.length === 1 ? "" : "s"} active.`
          : warningIncidents.length > 0
            ? `${warningIncidents.length} warning${warningIncidents.length === 1 ? "" : "s"} need review.`
            : "No active incidents detected.",
      action:
        criticalIncidents.length > 0 || warningIncidents.length > 0
          ? "Start with the incident queue below."
          : "No action needed."
    },
    {
      key: "api",
      label: "API",
      level:
        backendErrors > 0 || errorRate >= 10
          ? "bad"
          : errorRate > 0 || averageResponse >= 1000
            ? "attention"
            : averageResponse >= 500
              ? "moderate"
              : "healthy",
      reason:
        backendErrors > 0
          ? `${backendErrors} server error${backendErrors === 1 ? "" : "s"} since startup.`
          : averageResponse >= 1000
            ? `Average response time is high at ${averageResponse}ms.`
            : averageResponse >= 500
              ? `Average response time is acceptable but elevated at ${averageResponse}ms.`
              : `Average response time is ${averageResponse}ms.`,
      action:
        backendErrors > 0
          ? "Check Recent Errors and Recent API Requests."
          : averageResponse >= 500
            ? "Watch response time and request trends."
            : "No action needed."
    },
    {
      key: "database",
      label: "Database",
      level: dashboard.status.database !== "ready" || !dashboard.database.available ? "bad" : "healthy",
      reason:
        dashboard.status.database !== "ready" || !dashboard.database.available
          ? "Database is not ready or stats are unavailable."
          : `${dashboard.database.collections} collections, ${dashboard.database.objects} records.`,
      action:
        dashboard.status.database !== "ready" || !dashboard.database.available
          ? "Check MongoDB connection, credentials, and provider status."
          : "No action needed."
    },
    {
      key: "email",
      label: "Email",
      level:
        failedEmails > 0 || staleEmails > 0
          ? "bad"
          : oldPendingEmails > 0
            ? "attention"
            : dashboard.emails.queued > 0
              ? "moderate"
              : "healthy",
      reason:
        failedEmails > 0
          ? `${failedEmails} failed email job${failedEmails === 1 ? "" : "s"}.`
          : staleEmails > 0
            ? `${staleEmails} email job${staleEmails === 1 ? "" : "s"} stuck processing.`
            : oldPendingEmails > 0
              ? `${oldPendingEmails} pending email job${oldPendingEmails === 1 ? "" : "s"} are old.`
              : dashboard.emails.queued > 0
                ? `${dashboard.emails.queued} email job${dashboard.emails.queued === 1 ? "" : "s"} queued.`
                : "No email queue problems detected.",
      action:
        failedEmails > 0
          ? "Retry failed jobs after checking the error."
          : staleEmails > 0
            ? "Unlock stale jobs."
            : oldPendingEmails > 0
              ? "Confirm the email worker is running."
              : "No action needed."
    },
    {
      key: "bookings",
      label: "Bookings",
      level:
        dashboard.bookings.pastOpen > 0
          ? "attention"
          : dashboard.bookings.unverifiedOpen > 5
            ? "moderate"
            : "healthy",
      reason:
        dashboard.bookings.pastOpen > 0
          ? `${dashboard.bookings.pastOpen} open booking${dashboard.bookings.pastOpen === 1 ? "" : "s"} are in the past.`
          : dashboard.bookings.unverifiedOpen > 5
            ? `${dashboard.bookings.unverifiedOpen} open booking${dashboard.bookings.unverifiedOpen === 1 ? "" : "s"} are unverified.`
            : `${dashboard.bookings.open} open booking${dashboard.bookings.open === 1 ? "" : "s"} tracked.`,
      action:
        dashboard.bookings.pastOpen > 0
          ? "Ask the owner to resolve, cancel, or follow up."
          : dashboard.bookings.unverifiedOpen > 5
            ? "Watch verification email delivery."
            : "No action needed."
    },
    {
      key: "frontend",
      label: "Frontend",
      level:
        frontendErrors > 0
          ? "attention"
          : dashboard.frontend.poorWebVitals > 0
            ? "moderate"
            : "healthy",
      reason:
        frontendErrors > 0
          ? `${frontendErrors} browser error${frontendErrors === 1 ? "" : "s"} in the last 24h.`
          : dashboard.frontend.poorWebVitals > 0
            ? `${dashboard.frontend.poorWebVitals} poor performance event${dashboard.frontend.poorWebVitals === 1 ? "" : "s"} in the last 24h.`
            : "No frontend error signals detected.",
      action:
        frontendErrors > 0
          ? "Check Frontend Health for affected page paths."
          : dashboard.frontend.poorWebVitals > 0
            ? "Check large assets or recent UI changes."
            : "No action needed."
    },
    {
      key: "synthetic",
      label: "Customer Flows",
      level: failedSyntheticChecks.length > 0 ? "bad" : "healthy",
      reason:
        failedSyntheticChecks.length > 0
          ? `${failedSyntheticChecks.length} synthetic check${failedSyntheticChecks.length === 1 ? "" : "s"} failed.`
          : "Services, availability, and booking readiness checks pass.",
      action:
        failedSyntheticChecks.length > 0
          ? "Open Synthetic Checks and fix the failed customer path."
          : "No action needed."
    },
    {
      key: "alerting",
      label: "Alerting",
      level: dashboard.alerting.enabled ? "healthy" : "attention",
      reason: dashboard.alerting.enabled
        ? `Emails go to ${dashboard.alerting.recipient}.`
        : "Email alerting is turned off.",
      action: dashboard.alerting.enabled ? "No action needed." : "Enable alerting before production."
    },
    {
      key: "operations",
      label: "Operations",
      level:
        dashboard.operationalControls.bookingsPaused ||
        dashboard.operationalControls.maintenanceBannerEnabled
          ? "moderate"
          : "healthy",
      reason:
        dashboard.operationalControls.bookingsPaused
          ? "Customer bookings are intentionally paused."
          : dashboard.operationalControls.maintenanceBannerEnabled
            ? "A public maintenance banner is active."
            : "No emergency controls are active.",
      action:
        dashboard.operationalControls.bookingsPaused ||
        dashboard.operationalControls.maintenanceBannerEnabled
          ? "Remember to return to normal operation when done."
          : "No action needed."
    }
  ];
}

export function downloadDiagnostics(dashboard: MonitoringDashboard) {
  const blob = new Blob([JSON.stringify(dashboard, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `monitoring-diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export const maintenanceBannerPreset =
  "The website is currently undergoing maintenance. Some features may be temporarily unavailable.";
export const bookingPausePreset =
  "Online booking is temporarily paused while we perform maintenance. Please contact us directly.";

export function describeOperationalChanges(
  current: OperationalControls,
  next: OperationalControls
) {
  const changes: string[] = [];

  if (current.bookingsPaused !== next.bookingsPaused) {
    changes.push(next.bookingsPaused ? "Pause customer bookings" : "Resume customer bookings");
  }

  if ((current.bookingPauseMessage || "") !== (next.bookingPauseMessage || "")) {
    changes.push("Change the booking pause message");
  }

  if (current.maintenanceBannerEnabled !== next.maintenanceBannerEnabled) {
    changes.push(
      next.maintenanceBannerEnabled
        ? "Show the public maintenance banner"
        : "Hide the public maintenance banner"
    );
  }

  if ((current.maintenanceBannerMessage || "") !== (next.maintenanceBannerMessage || "")) {
    changes.push("Change the public maintenance banner text");
  }

  return changes;
}

export function buildIncidentSummary(dashboard: MonitoringDashboard) {
  const incidents =
    dashboard.incidents.length === 0
      ? "No active incidents."
      : dashboard.incidents
          .map((incident) => `- ${incident.severity.toUpperCase()}: ${incident.message}`)
          .join("\n");

  return [
    `Monitoring snapshot: ${new Date(dashboard.status.generatedAt).toLocaleString()}`,
    `Overall API: ${dashboard.status.api}`,
    `Database: ${dashboard.status.database}`,
    `Requests: ${dashboard.traffic.httpRequestsTotal}, errors: ${dashboard.traffic.httpErrorsTotal}, error rate: ${dashboard.traffic.errorRate}%`,
    `Emails: ${dashboard.emails.failed} failed, ${dashboard.emails.queued} queued, ${dashboard.emails.staleProcessing} stale`,
    `Bookings: ${dashboard.bookings.open} open, ${dashboard.bookings.pastOpen} past-open, ${dashboard.bookings.unverifiedOpen} unverified`,
    "",
    incidents
  ].join("\n");
}

export function OperationalControlsPanel({
  controls,
  saving,
  onChange,
  onSave
}: {
  controls: OperationalControls;
  saving: boolean;
  onChange: (value: OperationalControls) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  function applyPreset(kind: "banner" | "pause" | "normal") {
    const labels = {
      banner: "prepare a public maintenance banner",
      pause: "prepare booking pause mode",
      normal: "prepare normal operation"
    };
    const confirmed = window.confirm(`Use preset to ${labels[kind]}? You still need to save after this.`);

    if (!confirmed) {
      return;
    }

    if (kind === "banner") {
      onChange({
        ...controls,
        maintenanceBannerEnabled: true,
        maintenanceBannerMessage: maintenanceBannerPreset
      });
      return;
    }

    if (kind === "pause") {
      onChange({
        ...controls,
        bookingsPaused: true,
        bookingPauseMessage: bookingPausePreset,
        maintenanceBannerEnabled: true,
        maintenanceBannerMessage: maintenanceBannerPreset
      });
      return;
    }

    onChange({
      ...controls,
      bookingsPaused: false,
      maintenanceBannerEnabled: false
    });
  }

  return (
    <fieldset className="classic-fieldset compact">
      <legend>Emergency Controls</legend>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <button className="classic-button justify-center" onClick={() => applyPreset("banner")} type="button">
          Maintenance banner
        </button>
        <button className="classic-button justify-center" onClick={() => applyPreset("pause")} type="button">
          Pause bookings
        </button>
        <button className="classic-button justify-center" onClick={() => applyPreset("normal")} type="button">
          Normal operation
        </button>
      </div>
      <form className="space-y-4" onSubmit={onSave}>
        <label className="email-automation-card">
          <span className="min-w-0">
            <strong className="block text-sm font-bold text-[#171614]">Pause customer bookings</strong>
            <span className="mt-1 block text-xs font-semibold leading-relaxed text-[#746d61] md:text-sm">
              Blocks new customer booking requests and customer reschedules.
            </span>
          </span>
          <input
            checked={controls.bookingsPaused}
            className="h-5 w-5 accent-[#d6b46a]"
            onChange={(event) => onChange({ ...controls, bookingsPaused: event.target.checked })}
            type="checkbox"
          />
        </label>
        <label className="block">
          <span className="field-label">Booking pause message</span>
          <textarea
            className="field-input min-h-20 resize-y"
            maxLength={240}
            onChange={(event) =>
              onChange({ ...controls, bookingPauseMessage: event.target.value })
            }
            value={controls.bookingPauseMessage || ""}
          />
        </label>
        <label className="email-automation-card">
          <span className="min-w-0">
            <strong className="block text-sm font-bold text-[#171614]">Maintenance banner</strong>
            <span className="mt-1 block text-xs font-semibold leading-relaxed text-[#746d61] md:text-sm">
              Shows a public banner on customer-facing pages.
            </span>
          </span>
          <input
            checked={controls.maintenanceBannerEnabled}
            className="h-5 w-5 accent-[#d6b46a]"
            onChange={(event) =>
              onChange({ ...controls, maintenanceBannerEnabled: event.target.checked })
            }
            type="checkbox"
          />
        </label>
        <label className="block">
          <span className="field-label">Maintenance banner message</span>
          <textarea
            className="field-input min-h-20 resize-y"
            maxLength={240}
            onChange={(event) =>
              onChange({ ...controls, maintenanceBannerMessage: event.target.value })
            }
            value={controls.maintenanceBannerMessage || ""}
          />
        </label>
        <button className="classic-button primary w-full justify-center" disabled={saving} type="submit">
          {saving ? "Saving..." : "Save emergency controls"}
        </button>
      </form>
    </fieldset>
  );
}

export function TrendList({
  emptyMessage,
  rows
}: {
  emptyMessage: string;
  rows: Array<{ label: string; value: string }>;
}) {
  if (rows.length === 0) {
    return <div className="admin-empty-state small">{emptyMessage}</div>;
  }

  return (
    <div className="admin-list mb-3">
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`} className="admin-list-item">
          <strong>{row.label}</strong>
          <small>{row.value}</small>
        </div>
      ))}
    </div>
  );
}

export function EmailJobsPanel({
  jobs,
  retryingJobId,
  title,
  unlockingJobId,
  onRetry,
  onUnlock
}: {
  jobs: EmailJob[];
  retryingJobId?: string;
  title: string;
  unlockingJobId?: string;
  onRetry: (jobId: string) => void;
  onUnlock: (jobId: string) => void;
}) {
  return (
    <fieldset className="classic-fieldset compact">
      <legend>{title}</legend>
      {jobs.length === 0 ? (
        <div className="admin-empty-state small">No jobs in this state.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 font-bold">Type</th>
                <th className="px-3 py-2 font-bold">Recipient</th>
                <th className="px-3 py-2 font-bold">Attempts</th>
                <th className="px-3 py-2 font-bold">Updated</th>
                <th className="px-3 py-2 font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {jobs.map((job) => (
                <tr key={job._id} className="queue-row">
                  <td className="px-3 py-3 font-bold text-ink">
                    {formatJobType(job.type)}
                    {job.lastError && (
                      <div className="mt-1 max-w-xs text-xs font-semibold text-rose-600">
                        {job.lastError}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{job.to || "Not available"}</td>
                  <td className="px-3 py-3 font-semibold text-slate-600">
                    {job.attempts}/{job.maxAttempts}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                    {formatDateTime(job.updatedAt || job.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {job.status === "failed" && (
                        <button
                          className="classic-button"
                          disabled={retryingJobId === job._id}
                          onClick={() => onRetry(job._id)}
                          type="button"
                        >
                          <RotateCcw size={15} aria-hidden="true" />
                          Retry
                        </button>
                      )}
                      {job.status === "processing" && (
                        <button
                          className="classic-button"
                          disabled={unlockingJobId === job._id}
                          onClick={() => onUnlock(job._id)}
                          type="button"
                        >
                          <Unlock size={15} aria-hidden="true" />
                          Unlock
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </fieldset>
  );
}
