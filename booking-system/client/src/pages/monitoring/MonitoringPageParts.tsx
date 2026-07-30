import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  ExternalLink,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  RotateCcw,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Unlock,
  XCircle
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { MonitoringDashboard, OperationalControls } from "../../types";
import {
  EmailJobsPanel,
  OperationalControlsPanel,
  TrendList,
  formatAuditAction,
  formatDateTime,
  formatUptime,
  getHealthChecks,
  healthLabel,
  healthTone,
  type HealthCheck
} from "./MonitoringPanels";

export function MonitoringDashboardView({
  dashboard,
  controlsDraft,
  onCopyIncidentSummary,
  retryingJobId,
  savingControls,
  sendingTestEmail,
  testEmail,
  unlockingJobId,
  onRetry,
  onControlsDraftChange,
  onSaveOperationalControls,
  onSendTestEmail,
  onTestEmailChange,
  onUnlock
}: {
  dashboard: MonitoringDashboard;
  controlsDraft: OperationalControls | null;
  onCopyIncidentSummary: () => void;
  retryingJobId?: string;
  savingControls: boolean;
  sendingTestEmail: boolean;
  testEmail: string;
  unlockingJobId?: string;
  onRetry: (jobId: string) => void;
  onControlsDraftChange: (value: OperationalControls) => void;
  onSaveOperationalControls: (event: FormEvent<HTMLFormElement>) => void;
  onSendTestEmail: (event: FormEvent<HTMLFormElement>) => void;
  onTestEmailChange: (value: string) => void;
  onUnlock: (jobId: string) => void;
}) {
  const healthChecks = getHealthChecks(dashboard);
  const problemChecks = healthChecks.filter((check) => check.level === "bad" || check.level === "attention");

  return (
    <div className="space-y-6">
      <div className="classic-summary-grid monitoring-summary-grid">
        <SummaryBox
          icon={<Server size={19} aria-hidden="true" />}
          label={`Uptime ${formatUptime(dashboard.status.uptimeSeconds)}`}
          value={dashboard.status.api}
        />
        <SummaryBox
          icon={<Activity size={19} aria-hidden="true" />}
          label={`${dashboard.traffic.errorRate}% error rate`}
          value={dashboard.traffic.httpRequestsTotal}
        />
        <SummaryBox
          icon={<Clock size={19} aria-hidden="true" />}
          label={`${dashboard.bookings.next24Hours} next 24h`}
          value={dashboard.bookings.today}
        />
        <SummaryBox
          icon={<Mail size={19} aria-hidden="true" />}
          label={`${dashboard.emails.queued} queued, ${dashboard.emails.staleProcessing} stale`}
          value={dashboard.emails.failed}
        />
      </div>

      <fieldset className="classic-fieldset compact">
        <legend>Plain English Health</legend>
        {problemChecks.length === 0 ? (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
            Everything important looks healthy. No action needed right now.
          </div>
        ) : (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
            {problemChecks.length} area{problemChecks.length === 1 ? "" : "s"} need your attention.
            Start with anything marked Bad.
          </div>
        )}
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {healthChecks.map((check) => (
            <HealthCard key={check.key} check={check} />
          ))}
        </div>
      </fieldset>

      <fieldset className="classic-fieldset compact">
        <legend>Operator Shortcuts</legend>
        <div className="flex flex-wrap gap-2">
          <button className="classic-button" onClick={onCopyIncidentSummary} type="button">
            <Copy size={16} aria-hidden="true" />
            Copy incident summary
          </button>
          <a className="classic-button" href="/" target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden="true" />
            Open website
          </a>
          <a className="classic-button" href="/admin" target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden="true" />
            Open owner admin
          </a>
        </div>
      </fieldset>

      {dashboard.incidents.length > 0 && (
        <fieldset className="classic-fieldset compact">
          <legend>Incident Queue</legend>
          <div className="grid gap-2">
            {dashboard.incidents.map((incident) => (
              <div
                key={`${incident.severity}-${incident.message}`}
                className={`rounded border p-3 text-sm font-semibold ${
                  incident.severity === "critical"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <strong className="block">{incident.message}</strong>
                <span className="mt-1 block opacity-80">{incident.action}</span>
              </div>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <fieldset className="classic-fieldset compact">
            <legend>System Health</legend>
            <div className="admin-signal-grid grid-cols-1 sm:grid-cols-3">
              <Signal label="Database" value={dashboard.status.database} detail={dashboard.status.databaseName || "Database name unavailable"} />
              <Signal label="Response Time" value={`${dashboard.status.averageRequestDurationMs}ms`} detail="Average API request" />
              <Signal label="Memory" value={`${dashboard.status.memoryRssMb} MB`} detail="Server RSS memory" />
              <Signal label="Environment" value={dashboard.status.environment} detail={dashboard.status.appBaseUrl} />
              <Signal label="Worker" value={dashboard.status.emailJobWorkerEnabled ? "On" : "Off"} detail="Queued email sender" />
              <Signal label="Scheduler" value={dashboard.status.automatedSchedulerEnabled ? "On" : "Off"} detail="Reminders and reviews" />
              <Signal label="Release" value={dashboard.release.version} detail={dashboard.release.commit || "No commit metadata"} />
              <Signal label="Node" value={dashboard.release.nodeVersion} detail={dashboard.release.buildTime || "No build timestamp"} />
              <Signal label="Alerting" value={dashboard.alerting.enabled ? "On" : "Off"} detail={dashboard.alerting.recipient} />
            </div>
          </fieldset>

          <fieldset className="classic-fieldset compact">
            <legend>Email Alerts</legend>
            <div className="admin-signal-grid grid-cols-1 sm:grid-cols-3">
              <Signal label="Recipient" value={dashboard.alerting.recipient} detail="Critical and warning alerts" />
              <Signal label="Check Interval" value={`${Math.round(dashboard.alerting.checkIntervalMs / 1000)}s`} detail={`${dashboard.alerting.lookbackMinutes}m lookback`} />
              <Signal label="Cooldown" value={`${Math.round(dashboard.alerting.cooldownMs / 60000)}m`} detail="Per alert type" />
            </div>
            <div className="admin-list mt-3">
              {dashboard.alerting.recentStates.length === 0 ? (
                <div className="admin-empty-state small">No alert emails have been recorded yet.</div>
              ) : (
                dashboard.alerting.recentStates.map((state) => (
                  <div key={state._id} className="admin-list-item">
                    <div className="min-w-0">
                      <strong className="truncate">{state.key}</strong>
                      <small className="truncate">{state.lastMessage || "No message recorded"}</small>
                    </div>
                    <time>
                      {state.status} - {formatDateTime(state.lastSentAt || state.updatedAt)}
                    </time>
                  </div>
                ))
              )}
            </div>
          </fieldset>

          <fieldset className="classic-fieldset compact">
            <legend>Synthetic Checks</legend>
            <div className="admin-list">
              {dashboard.syntheticChecks.map((check) => (
                <div key={check.name} className="admin-list-item">
                  <div className="min-w-0">
                    <strong className="truncate">{check.name}</strong>
                    <small className="truncate">{check.message}</small>
                  </div>
                  <span className={`rounded px-2 py-1 text-xs font-bold uppercase ${check.status === "pass" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {check.status} {check.durationMs}ms
                  </span>
                </div>
              ))}
            </div>
          </fieldset>

          {controlsDraft && (
            <OperationalControlsPanel
              controls={controlsDraft}
              saving={savingControls}
              onChange={onControlsDraftChange}
              onSave={onSaveOperationalControls}
            />
          )}

          <fieldset className="classic-fieldset compact">
            <legend>Email Recovery</legend>
            <div className="admin-signal-grid grid-cols-1 sm:grid-cols-4">
              <Signal label="Sent" value={dashboard.emails.sent} detail={`Last ${formatDateTime(dashboard.emails.lastSentAt)}`} />
              <Signal label="Failed" value={dashboard.emails.failed} detail="Can be retried below" />
              <Signal label="Old Pending" value={dashboard.emails.oldPending} detail={`${dashboard.emails.oldestPendingAgeMinutes}m oldest pending`} />
              <Signal label="Stale Processing" value={dashboard.emails.staleProcessing} detail="Can be unlocked below" />
            </div>
            <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={onSendTestEmail}>
              <input
                className="field-input"
                onChange={(event) => onTestEmailChange(event.target.value)}
                placeholder="test email recipient, optional"
                type="email"
                value={testEmail}
              />
              <button className="classic-button primary shrink-0" disabled={sendingTestEmail} type="submit">
                <Send size={16} aria-hidden="true" />
                {sendingTestEmail ? "Sending..." : "Send test email"}
              </button>
            </form>
          </fieldset>

          <EmailJobsPanel
            jobs={dashboard.emails.staleJobs}
            retryingJobId={retryingJobId}
            title="Stale Processing Jobs"
            unlockingJobId={unlockingJobId}
            onRetry={onRetry}
            onUnlock={onUnlock}
          />

          <EmailJobsPanel
            jobs={dashboard.emails.failedJobs}
            retryingJobId={retryingJobId}
            title="Failed Email Jobs"
            unlockingJobId={unlockingJobId}
            onRetry={onRetry}
            onUnlock={onUnlock}
          />

          <fieldset className="classic-fieldset compact">
            <legend>Recent Errors</legend>
            {dashboard.recentErrors.length === 0 ? (
              <div className="admin-empty-state small">No recent warning or error events.</div>
            ) : (
              <div className="admin-list">
                {dashboard.recentErrors.map((event) => (
                  <div key={event._id} className="admin-list-item">
                    <div className="min-w-0">
                      <strong className="truncate">
                        {event.statusCode || event.severity} {event.code || event.type}
                      </strong>
                      <small className="truncate">
                        {event.method || "REQUEST"} {event.path || "unknown path"} - {event.message}
                      </small>
                      {event.requestId && <small className="truncate">Request {event.requestId}</small>}
                    </div>
                    <time>{formatDateTime(event.createdAt)}</time>
                  </div>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="classic-fieldset compact">
            <legend>Recent API Requests</legend>
            <div className="admin-list">
              {dashboard.traffic.recentRequests.slice(0, 12).map((requestLog) => (
                <div key={requestLog._id} className="admin-list-item">
                  <div className="min-w-0">
                    <strong className="truncate">
                      {requestLog.statusCode} {requestLog.method} {requestLog.path}
                    </strong>
                    <small className="truncate">
                      {requestLog.durationMs}ms {requestLog.requestId ? `- ${requestLog.requestId}` : ""}
                    </small>
                  </div>
                  <time>{formatDateTime(requestLog.createdAt)}</time>
                </div>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="space-y-6">
          <fieldset className="classic-fieldset compact">
            <legend>Database</legend>
            <div className="admin-signal-grid">
              <Signal label="Stats" value={dashboard.database.available ? "Available" : "Unavailable"} detail={`${dashboard.database.collections} collections`} />
              <Signal label="Objects" value={dashboard.database.objects} detail={`${dashboard.database.connections ?? "unknown"} connections`} />
              <Signal label="Data / Storage" value={`${dashboard.database.dataSizeMb} / ${dashboard.database.storageSizeMb} MB`} detail={`${dashboard.database.indexSizeMb} MB indexes`} />
            </div>
          </fieldset>

          <fieldset className="classic-fieldset compact">
            <legend>Frontend Health</legend>
            <div className="admin-signal-grid">
              <Signal label="JS Errors" value={(dashboard.frontend.eventsLast24Hours.javascript_error || 0) + (dashboard.frontend.eventsLast24Hours.unhandled_rejection || 0)} detail="Last 24 hours" />
              <Signal label="Poor Vitals" value={dashboard.frontend.poorWebVitals} detail="Last 24 hours" />
              <Signal label="Page Loads" value={dashboard.frontend.eventsLast24Hours.page_load || 0} detail="Telemetry events" />
            </div>
            <div className="admin-list mt-3">
              {dashboard.frontend.recentEvents.slice(0, 6).map((event) => (
                <div key={event._id} className="admin-list-item">
                  <div className="min-w-0">
                    <strong className="truncate">
                      {event.type} {event.metricName ? `- ${event.metricName}` : ""}
                    </strong>
                    <small className="truncate">
                      {event.path} {event.message || event.rating || ""}
                    </small>
                  </div>
                  <time>{formatDateTime(event.createdAt)}</time>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="classic-fieldset compact">
            <legend>24h Trends</legend>
            <TrendList
              rows={dashboard.trends.requests.slice(-8).map((row) => ({
                label: formatDateTime(row.bucket),
                value: `${row.requests} req / ${row.errors} err / ${row.averageDurationMs}ms`
              }))}
              emptyMessage="No request trend data yet."
            />
            <TrendList
              rows={dashboard.trends.bookings.slice(-8).map((row) => ({
                label: formatDateTime(row.bucket),
                value: `${row.created} bookings`
              }))}
              emptyMessage="No booking trend data yet."
            />
            <TrendList
              rows={dashboard.trends.emailFailures.slice(-8).map((row) => ({
                label: formatDateTime(row.bucket),
                value: `${row.failed} email failures`
              }))}
              emptyMessage="No email failure trend data yet."
            />
          </fieldset>

          <fieldset className="classic-fieldset compact">
            <legend>Booking Health</legend>
            <div className="admin-signal-grid">
              <Signal label="Open Bookings" value={dashboard.bookings.open} detail={`${dashboard.bookings.unverifiedOpen} unverified open`} />
              <Signal label="Past Open" value={dashboard.bookings.pastOpen} detail="Needs owner follow-up" />
              <Signal label="Last 7 Days" value={dashboard.bookings.last7Days} detail={`${dashboard.bookings.total} total records`} />
              <Signal label="Resolved / Canceled" value={`${dashboard.bookings.resolved} / ${dashboard.bookings.canceled}`} detail="Handled outcomes" />
            </div>
          </fieldset>

          <fieldset className="classic-fieldset compact">
            <legend>Recent Bookings</legend>
            {dashboard.bookings.recent.length === 0 ? (
              <div className="admin-empty-state small">No bookings yet.</div>
            ) : (
              <div className="admin-list">
                {dashboard.bookings.recent.map((booking) => (
                  <div key={booking._id} className="admin-list-item">
                    <div className="min-w-0">
                      <strong className="truncate">{booking.name || "Unnamed customer"}</strong>
                      <small className="truncate">
                        {booking.serviceName || "Service not available"} - {booking.status} -{" "}
                        {booking.emailVerified ? "verified" : "unverified"}
                      </small>
                    </div>
                    <time>{formatDateTime(booking.createdAt)}</time>
                  </div>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="classic-fieldset compact">
            <legend>Recent Operator Changes</legend>
            {dashboard.auditLogs.length === 0 ? (
              <div className="admin-empty-state small">No changes recorded.</div>
            ) : (
              <div className="admin-list">
                {dashboard.auditLogs.map((log) => (
                  <div key={log._id} className="admin-list-item">
                    <div className="min-w-0">
                      <strong className="truncate">{formatAuditAction(log.action)}</strong>
                      <small className="truncate">
                        {log.targetType}
                        {log.targetId ? ` - ${log.targetId}` : ""}
                      </small>
                    </div>
                    <time>{formatDateTime(log.createdAt)}</time>
                  </div>
                ))}
              </div>
            )}
          </fieldset>
        </div>
      </div>
    </div>
  );
}

function SummaryBox({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="classic-summary-box">
      <span className="classic-summary-icon">{icon}</span>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function HealthCard({ check }: { check: HealthCheck }) {
  return (
    <article className={`rounded border p-3 ${healthTone(check.level)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">{check.label}</h3>
          <p className="mt-1 text-xs font-semibold leading-relaxed opacity-90">{check.reason}</p>
        </div>
        <span className="shrink-0 rounded bg-white/70 px-2 py-1 text-[11px] font-black uppercase">
          {healthLabel(check.level)}
        </span>
      </div>
      <p className="mt-3 border-t border-current/15 pt-2 text-xs font-bold opacity-90">
        {check.action}
      </p>
    </article>
  );
}

function Signal({
  detail,
  label,
  value
}: {
  detail: string;
  label: string;
  value: number | string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small className="truncate">{detail}</small>
    </div>
  );
}
