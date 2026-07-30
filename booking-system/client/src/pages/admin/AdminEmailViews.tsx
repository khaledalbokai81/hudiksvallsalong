import { AlertTriangle, CheckCircle2, Clock, RotateCcw, Send, Settings, Users } from "lucide-react";
import { FormEvent, useState } from "react";
import { formatBusinessDateTime } from "../../lib/time";
import type { EmailAutomationDashboard, EmailAutomationSettings, EmailJob } from "../../types";

function formatShortDateTime(value?: string) {
  return value ? formatBusinessDateTime(value) : "Not scheduled";
}

function formatJobType(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatJobError(value: string) {
  if (value.includes("Expected string") && value.includes("notes")) {
    return "Utskicket saknar en giltig anteckning. Öppna bokningen och försök sedan igen.";
  }

  if (value.trim().startsWith("[") || value.trim().startsWith("{")) {
    return "Utskicket innehåller ogiltiga uppgifter och kunde inte skickas.";
  }

  return value;
}

function statusClasses(status: EmailJob["status"]) {
  if (status === "sent") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "failed") {
    return "bg-rose-50 text-rose-700";
  }

  if (status === "processing") {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-amber-50 text-amber-700";
}

type EmailsViewProps = {
  dashboard: EmailAutomationDashboard | null;
  draft: EmailAutomationSettings | null;
  loading: boolean;
  retryingJobId?: string;
  saving: boolean;
  onDraftChange: (value: EmailAutomationSettings) => void;
  onRetry: (jobId: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
};

export function EmailsView({
  dashboard,
  draft,
  loading,
  retryingJobId,
  saving,
  onDraftChange,
  onRetry,
  onSave
}: EmailsViewProps) {
  if (loading && !dashboard) {
    return <div className="admin-empty-state">Loading email automations...</div>;
  }

  if (!dashboard || !draft) {
    return <div className="admin-empty-state">Email automation data is not available.</div>;
  }

  const statusCounts = dashboard.summary.byStatus;
  const visibleRecentJobs = dashboard.recentJobs.filter((job) => job.status !== "failed");
  return (
    <div className="space-y-6">
      <div className="md:hidden">
        <MobileEmailsView
          dashboard={dashboard}
          draft={draft}
          retryingJobId={retryingJobId}
          saving={saving}
          onDraftChange={onDraftChange}
          onRetry={onRetry}
          onSave={onSave}
        />
      </div>

      <div className="hidden space-y-6 md:block">
      <div className="classic-summary-grid hidden grid-cols-2 md:grid md:grid-cols-3">
        <div className="classic-summary-box border-[#e1d8c5] bg-white">
          <span className="classic-summary-icon">
            <Send size={19} aria-hidden="true" />
          </span>
          <strong>{statusCounts.sent ?? 0}</strong>
          <span>Sent</span>
        </div>
        <div className="classic-summary-box border-[#e1d8c5] bg-white">
          <span className="classic-summary-icon">
            <Clock size={19} aria-hidden="true" />
          </span>
          <strong>{(statusCounts.pending ?? 0) + (statusCounts.processing ?? 0)}</strong>
          <span>Queued</span>
        </div>
        <div className="classic-summary-box border-[#e1d8c5] bg-white">
          <span className="classic-summary-icon">
            <Settings size={19} aria-hidden="true" />
          </span>
          <strong>{dashboard.runtime.maxAttempts}</strong>
          <span>Max attempts</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <fieldset className="classic-fieldset border-0 bg-transparent p-0 shadow-none md:border md:bg-white md:p-4">
          <legend className="hidden md:block">Automatisering</legend>
          <form className="space-y-3 md:space-y-5" onSubmit={onSave}>
            <div className="md:hidden">
              <h2 className="text-sm font-bold text-[#171614]">Automations</h2>
              <p className="mt-1 text-xs font-semibold text-[#746d61]">
                Customer, owner, reminder, and review emails.
              </p>
            </div>
            <ReadonlyAutomation
              enabled={draft.customerVerificationEnabled}
              title="Customer manage link"
              description="Always sends the customer a secure verification and booking-management link."
            />
            <AutomationToggle
              checked={draft.ownerBookingNoticeEnabled}
              description="Send the business owner an email every time a new booking request arrives."
              title="Owner booking notice"
              onChange={(checked) => onDraftChange({ ...draft, ownerBookingNoticeEnabled: checked })}
            />
            <AutomationToggle
              checked={draft.bookingReminderEnabled}
              description="Send verified customers a reminder before their appointment."
              title="Booking reminders"
              onChange={(checked) => onDraftChange({ ...draft, bookingReminderEnabled: checked })}
            />
            <div className="block">
              <span className="field-label">Reminder stages, hours</span>
              <div className="space-y-2">
                {draft.reminderLeadHours.map((hours, index) => (
                  <div className="flex gap-2" key={index}>
                    <input
                      aria-label={`Reminder stage ${index + 1} hours`}
                      className="field-input email-field-input"
                      min={1}
                      max={168}
                      type="number"
                      value={hours}
                      onChange={(event) => {
                        const reminderLeadHours = [...draft.reminderLeadHours];
                        reminderLeadHours[index] = Number(event.target.value) || 1;
                        onDraftChange({ ...draft, reminderLeadHours });
                      }}
                    />
                    <button
                      className="classic-button"
                      disabled={draft.reminderLeadHours.length === 1}
                      onClick={() =>
                        onDraftChange({
                          ...draft,
                          reminderLeadHours: draft.reminderLeadHours.filter(
                            (_value, stageIndex) => stageIndex !== index
                          )
                        })
                      }
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="classic-button mt-2"
                disabled={draft.reminderLeadHours.length >= 6}
                onClick={() =>
                  onDraftChange({
                    ...draft,
                    reminderLeadHours: [...draft.reminderLeadHours, 1]
                  })
                }
                type="button"
              >
                Add reminder stage
              </button>
              <small className="mt-1 block text-xs font-semibold text-[#746d61]">
                Up to six reminders between 1 and 168 hours before the appointment.
              </small>
            </div>
            <AutomationToggle
              checked={draft.waitlistEnabled}
              description="Let customers join unavailable times and notify them in first-come order."
              title="Slot waitlists"
              onChange={(checked) => onDraftChange({ ...draft, waitlistEnabled: checked })}
            />
            <label className="block">
              <span className="field-label">Waitlist offer window, minutes</span>
              <input
                className="field-input email-field-input"
                min={5}
                max={1440}
                type="number"
                value={draft.waitlistOfferMinutes}
                onChange={(event) =>
                  onDraftChange({ ...draft, waitlistOfferMinutes: Number(event.target.value) })
                }
              />
            </label>
            <AutomationToggle
              checked={draft.reviewRequestEnabled}
              description="Send review requests after a booking has been marked resolved."
              title="Review requests"
              onChange={(checked) => onDraftChange({ ...draft, reviewRequestEnabled: checked })}
            />
            <label className="block">
              <span className="field-label">Review request delay, hours</span>
              <input
                className="field-input email-field-input"
                min={0}
                max={720}
                type="number"
                value={draft.reviewRequestDelayHours}
                onChange={(event) =>
                  onDraftChange({ ...draft, reviewRequestDelayHours: Number(event.target.value) })
                }
              />
            </label>
            <label className="block">
              <span className="field-label">Review URL</span>
              <input
                className="field-input email-field-input"
                placeholder="https://g.page/your-review-link"
                type="url"
                value={draft.reviewUrl || ""}
                onChange={(event) => onDraftChange({ ...draft, reviewUrl: event.target.value })}
              />
            </label>
            <button className="classic-button primary w-full justify-center" disabled={saving} type="submit">
              <Settings size={17} aria-hidden="true" />
              {saving ? "Saving..." : "Save email settings"}
            </button>
          </form>
        </fieldset>

        <div className="flex flex-col gap-6">
          <EmailJobsTable
            jobs={dashboard.failedJobs}
            retryingJobId={retryingJobId}
            title="Failed email jobs"
            emptyMessage="No failed email jobs."
            onRetry={onRetry}
          />

          <div className="order-1 lg:order-2">
            <EmailJobsTable
              jobs={visibleRecentJobs}
              retryingJobId={retryingJobId}
              title="Recent email activity"
              emptyMessage="No email jobs yet."
              onRetry={onRetry}
            />
          </div>

          <fieldset className="classic-fieldset compact email-panel order-2 lg:order-1">
            <legend>Systemstatus</legend>
            <div className="admin-signal-grid grid-cols-1 sm:grid-cols-3">
              <div>
                <span>Scheduler</span>
                <strong>{dashboard.runtime.automatedSchedulerEnabled ? "On" : "Off"}</strong>
                <small>Reminder and review scans</small>
              </div>
              <div>
                <span>Worker</span>
                <strong>{dashboard.runtime.emailJobWorkerEnabled ? "On" : "Off"}</strong>
                <small>Queued email sender</small>
              </div>
              <div>
                <span>Sender</span>
                <strong className="truncate">{dashboard.runtime.mailFrom}</strong>
                <small className="truncate">{dashboard.runtime.smtpHost}</small>
              </div>
            </div>
          </fieldset>

          <fieldset className="classic-fieldset compact email-panel order-3">
            <legend>Senaste väntelistan</legend>
            {dashboard.waitlist.recentEntries.length === 0 ? (
              <div className="admin-empty-state small">No waitlist entries yet.</div>
            ) : (
              <div className="admin-list">
                {dashboard.waitlist.recentEntries.slice(0, 12).map((entry) => (
                  <div className="admin-list-item" key={entry._id}>
                    <div>
                      <strong>{entry.name} / {entry.serviceName}</strong>
                      <small>{formatBusinessDateTime(entry.slotStartAt)} / {entry.email}</small>
                    </div>
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold uppercase text-slate-600">
                      {entry.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </fieldset>
        </div>
      </div>
      </div>
    </div>
  );
}

type MobileEmailsViewProps = Omit<EmailsViewProps, "dashboard" | "draft" | "loading"> & {
  dashboard: EmailAutomationDashboard;
  draft: EmailAutomationSettings;
};

function MobileEmailsView({
  dashboard,
  draft,
  retryingJobId,
  saving,
  onDraftChange,
  onRetry,
  onSave
}: MobileEmailsViewProps) {
  const failedCount = dashboard.failedJobs.length;
  const queuedCount =
    (dashboard.summary.byStatus.pending ?? 0) + (dashboard.summary.byStatus.processing ?? 0);
  const deliveryHealthy =
    failedCount === 0 &&
    dashboard.runtime.automatedSchedulerEnabled &&
    dashboard.runtime.emailJobWorkerEnabled;
  const [activityTab, setActivityTab] = useState<"issues" | "activity" | "waitlist">(
    failedCount > 0 ? "issues" : "activity"
  );
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(dashboard.settings);
  const recentJobs = dashboard.recentJobs.filter((job) => job.status !== "failed").slice(0, 5);

  return (
    <div className="space-y-3 pb-5">
      <section
        className={`rounded-xl border p-4 shadow-sm ${
          deliveryHealthy
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-300 bg-amber-50"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
              deliveryHealthy
                ? "bg-emerald-600 text-white"
                : "bg-amber-500 text-amber-950"
            }`}
          >
            {deliveryHealthy ? (
              <CheckCircle2 size={20} aria-hidden="true" />
            ) : (
              <AlertTriangle size={20} aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[#171614]">
              {deliveryHealthy ? "Email delivery is healthy" : "Email delivery needs attention"}
            </h2>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-[#655f55]">
              {deliveryHealthy
                ? "Automations are running and there are no failed messages."
                : `${failedCount} failed · ${queuedCount} queued. Review issues below.`}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 divide-x divide-black/10 rounded-lg bg-white/70 py-2 text-center">
          <MobileInlineStat label="Sent" value={dashboard.summary.byStatus.sent ?? 0} />
          <MobileInlineStat label="Queued" value={queuedCount} />
          <MobileInlineStat label="Failed" value={failedCount} alert={failedCount > 0} />
        </div>
      </section>

      <form
        className="rounded-xl border border-[#e1d8c5] bg-white p-3 shadow-sm"
        id="mobile-email-settings"
        onSubmit={onSave}
      >
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <div>
            <h2 className="text-sm font-bold text-[#171614]">Automations</h2>
            <p className="mt-0.5 text-xs font-semibold text-[#746d61]">Tap a switch to enable or disable.</p>
          </div>
          <span className="rounded-full bg-[#f4f0e6] px-2.5 py-1 text-[10px] font-bold uppercase text-[#746d61]">
            {[
              draft.customerVerificationEnabled,
              draft.ownerBookingNoticeEnabled,
              draft.bookingReminderEnabled,
              draft.reviewRequestEnabled,
              draft.waitlistEnabled
            ].filter(Boolean).length}/5 on
          </span>
        </div>

        <div className="divide-y divide-[#eee7d8]">
          <MobileAutomationSwitch
            checked={draft.customerVerificationEnabled}
            description="Secure customer confirmation and manage link"
            disabled
            title="Customer manage link"
            onChange={() => undefined}
          />
          <MobileAutomationSwitch
            checked={draft.ownerBookingNoticeEnabled}
            description="Notify the owner about every new request"
            title="Owner booking notice"
            onChange={(checked) => onDraftChange({ ...draft, ownerBookingNoticeEnabled: checked })}
          />
          <MobileAutomationSwitch
            checked={draft.bookingReminderEnabled}
            description={
              draft.bookingReminderEnabled
                ? `${draft.reminderLeadHours.join("h, ")}h before appointments`
                : "Appointment reminders are off"
            }
            title="Booking reminders"
            onChange={(checked) => onDraftChange({ ...draft, bookingReminderEnabled: checked })}
          />
          <MobileAutomationSwitch
            checked={draft.waitlistEnabled}
            description={
              draft.waitlistEnabled
                ? `${draft.waitlistOfferMinutes}-minute offer window`
                : "Customers cannot join unavailable slots"
            }
            title="Slot waitlist"
            onChange={(checked) => onDraftChange({ ...draft, waitlistEnabled: checked })}
          />
          <MobileAutomationSwitch
            checked={draft.reviewRequestEnabled}
            description={
              draft.reviewRequestEnabled
                ? `Send ${draft.reviewRequestDelayHours}h after resolution`
                : "Post-appointment review requests are off"
            }
            title="Review requests"
            onChange={(checked) => onDraftChange({ ...draft, reviewRequestEnabled: checked })}
          />
        </div>

        <details className="mt-2 rounded-lg bg-[#f7f3ea] open:pb-3">
          <summary className="cursor-pointer list-none px-3 py-3 text-xs font-bold text-[#5c4720]">
            Advanced timing and links
            <span className="float-right text-[#a3833d]">Edit</span>
          </summary>
          <div className="space-y-4 border-t border-[#e8dcc2] px-3 pt-3">
            {draft.bookingReminderEnabled && (
              <div>
                <span className="field-label">Reminder stages</span>
                <div className="space-y-2">
                  {draft.reminderLeadHours.map((hours, index) => (
                    <div className="flex items-center gap-2" key={index}>
                      <input
                        aria-label={`Reminder stage ${index + 1} hours`}
                        className="field-input min-w-0 flex-1"
                        min={1}
                        max={168}
                        type="number"
                        value={hours}
                        onChange={(event) => {
                          const reminderLeadHours = [...draft.reminderLeadHours];
                          reminderLeadHours[index] = Number(event.target.value) || 1;
                          onDraftChange({ ...draft, reminderLeadHours });
                        }}
                      />
                      <span className="text-xs font-bold text-[#746d61]">hours before</span>
                      <button
                        className="text-xs font-bold text-rose-700 disabled:opacity-40"
                        disabled={draft.reminderLeadHours.length === 1}
                        onClick={() =>
                          onDraftChange({
                            ...draft,
                            reminderLeadHours: draft.reminderLeadHours.filter((_, itemIndex) => itemIndex !== index)
                          })
                        }
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="mt-2 text-xs font-bold text-[#5c4720] disabled:opacity-40"
                  disabled={draft.reminderLeadHours.length >= 6}
                  onClick={() => onDraftChange({ ...draft, reminderLeadHours: [...draft.reminderLeadHours, 1] })}
                  type="button"
                >
                  + Add reminder
                </button>
              </div>
            )}

            {draft.waitlistEnabled && (
              <label className="block">
                <span className="field-label">Waitlist offer window</span>
                <div className="flex items-center gap-2">
                  <input
                    className="field-input min-w-0 flex-1"
                    min={5}
                    max={1440}
                    type="number"
                    value={draft.waitlistOfferMinutes}
                    onChange={(event) => onDraftChange({ ...draft, waitlistOfferMinutes: Number(event.target.value) })}
                  />
                  <span className="text-xs font-bold text-[#746d61]">minutes</span>
                </div>
              </label>
            )}

            {draft.reviewRequestEnabled && (
              <div className="space-y-3">
                <label className="block">
                  <span className="field-label">Review request delay</span>
                  <div className="flex items-center gap-2">
                    <input
                      className="field-input min-w-0 flex-1"
                      min={0}
                      max={720}
                      type="number"
                      value={draft.reviewRequestDelayHours}
                      onChange={(event) => onDraftChange({ ...draft, reviewRequestDelayHours: Number(event.target.value) })}
                    />
                    <span className="text-xs font-bold text-[#746d61]">hours</span>
                  </div>
                </label>
                <label className="block">
                  <span className="field-label">Review URL</span>
                  <input
                    className="field-input"
                    placeholder="https://g.page/your-review-link"
                    type="url"
                    value={draft.reviewUrl || ""}
                    onChange={(event) => onDraftChange({ ...draft, reviewUrl: event.target.value })}
                  />
                </label>
              </div>
            )}
          </div>
        </details>
      </form>

      <section className="rounded-xl border border-[#e1d8c5] bg-white p-3 shadow-sm">
        <div className="grid grid-cols-3 rounded-lg bg-[#f4f0e6] p-1" aria-label="Email activity views">
          {([
            ["issues", "Issues", failedCount],
            ["activity", "Activity", dashboard.recentJobs.length],
            ["waitlist", "Waitlist", dashboard.waitlist.recentEntries.length]
          ] as const).map(([value, label, count]) => (
            <button
              className={`rounded-md px-2 py-2 text-xs font-bold ${
                activityTab === value ? "bg-[#171614] text-[#f1d48a] shadow-sm" : "text-[#746d61]"
              }`}
              key={value}
              onClick={() => setActivityTab(value)}
              type="button"
            >
              {label} <span className="opacity-70">{count}</span>
            </button>
          ))}
        </div>

        <div className="mt-3">
          {activityTab === "issues" && (
            <EmailJobsTable
              jobs={dashboard.failedJobs}
              retryingJobId={retryingJobId}
              title="Failed messages"
              emptyMessage="No delivery issues."
              onRetry={onRetry}
            />
          )}
          {activityTab === "activity" && (
            <EmailJobsTable
              jobs={recentJobs}
              retryingJobId={retryingJobId}
              title="Latest messages"
              emptyMessage="No email activity yet."
              onRetry={onRetry}
            />
          )}
          {activityTab === "waitlist" && (
            <MobileWaitlist entries={dashboard.waitlist.recentEntries.slice(0, 5)} />
          )}
        </div>
      </section>

      {hasChanges && (
        <div className="sticky bottom-20 z-30 flex items-center gap-2 rounded-xl border border-[#d6b46a] bg-[#171614] p-2.5 text-white shadow-xl">
          <div className="min-w-0 flex-1 px-1">
            <strong className="block text-xs">Unsaved changes</strong>
            <span className="block text-[10px] text-[#cfc6b4]">Save before leaving this page.</span>
          </div>
          <button
            className="rounded-lg px-3 py-2 text-xs font-bold text-[#f1d48a]"
            disabled={saving}
            onClick={() => onDraftChange(dashboard.settings)}
            type="button"
          >
            Reset
          </button>
          <button
            className="rounded-lg bg-[#d6b46a] px-3 py-2 text-xs font-bold text-[#171614] disabled:opacity-60"
            disabled={saving}
            form="mobile-email-settings"
            type="submit"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

function MobileInlineStat({
  alert,
  label,
  value
}: {
  alert?: boolean;
  label: string;
  value: number;
}) {
  return (
    <div>
      <strong className={`block text-base ${alert ? "text-rose-700" : "text-[#171614]"}`}>{value}</strong>
      <span className="text-[10px] font-bold uppercase text-[#746d61]">{label}</span>
    </div>
  );
}

function MobileAutomationSwitch({
  checked,
  description,
  disabled,
  title,
  onChange
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  title: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`relative flex items-center gap-3 px-1 py-3 ${disabled ? "cursor-default" : "cursor-pointer"}`}>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm font-bold text-[#171614]">{title}</strong>
        <span className="mt-0.5 block text-[11px] font-semibold leading-snug text-[#746d61]">{description}</span>
      </span>
      <input
        checked={checked}
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        role="switch"
        type="checkbox"
      />
      <span className="pointer-events-none relative h-6 w-11 shrink-0 rounded-full bg-[#d8d0c1] transition peer-checked:bg-[#171614] peer-focus-visible:ring-2 peer-focus-visible:ring-[#d6b46a] peer-focus-visible:ring-offset-2 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

function MobileWaitlist({ entries }: { entries: EmailAutomationDashboard["waitlist"]["recentEntries"] }) {
  if (entries.length === 0) {
    return <div className="rounded-lg bg-[#f7f3ea] px-3 py-4 text-center text-xs font-semibold text-[#746d61]">No waitlist activity yet.</div>;
  }

  return (
    <div className="divide-y divide-[#eee7d8]">
      {entries.map((entry) => (
        <article className="flex items-start gap-3 py-3" key={entry._id}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f4f0e6] text-[#8a7652]">
            <Users size={15} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-xs text-[#171614]">{entry.name} · {entry.serviceName}</strong>
            <span className="mt-0.5 block truncate text-[11px] font-semibold text-[#746d61]">{formatBusinessDateTime(entry.slotStartAt)}</span>
          </div>
          <span className="rounded bg-[#f4f0e6] px-2 py-1 text-[9px] font-bold uppercase text-[#746d61]">{entry.status}</span>
        </article>
      ))}
    </div>
  );
}

function AutomationToggle({
  checked,
  description,
  title,
  onChange
}: {
  checked: boolean;
  description: string;
  title: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="email-automation-card">
      <span className="min-w-0">
        <strong className="block text-sm font-bold text-[#171614]">{title}</strong>
        <span className="mt-1 block text-xs font-semibold leading-relaxed text-[#746d61] md:text-sm">
          {description}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        <span
          className={`email-toggle-state ${checked ? "active" : "inactive"}`}
        >
          {checked ? "On" : "Off"}
        </span>
        <input
          checked={checked}
          className="h-5 w-5 accent-[#d6b46a]"
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
      </span>
    </label>
  );
}

function ReadonlyAutomation({
  description,
  enabled,
  title
}: {
  description: string;
  enabled: boolean;
  title: string;
}) {
  return (
    <div className="email-automation-card readonly">
      <div className="flex items-start justify-between gap-3 md:gap-4">
        <span className="min-w-0">
          <strong className="block text-sm font-bold text-[#171614]">{title}</strong>
          <span className="mt-1 block text-xs font-semibold leading-relaxed text-[#746d61] md:text-sm">
            {description}
          </span>
        </span>
        <span className="email-toggle-state active">
          {enabled ? "On" : "Off"}
        </span>
      </div>
    </div>
  );
}

function EmailJobsTable({
  emptyMessage,
  jobs,
  retryingJobId,
  title,
  onRetry
}: {
  emptyMessage: string;
  jobs: EmailJob[];
  retryingJobId?: string;
  title: string;
  onRetry: (jobId: string) => void;
}) {
  return (
    <fieldset className="classic-fieldset compact email-panel">
      <legend>{title}</legend>
      {jobs.length === 0 ? (
        <div className="admin-empty-state small">{emptyMessage}</div>
      ) : (
        <>
        <div className="grid gap-2 md:hidden">
          {jobs.map((job) => (
            <article key={job._id} className="email-job-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-[#171614]">{formatJobType(job.type)}</h3>
                  <p className="mt-1 truncate text-xs font-semibold text-[#746d61]">
                    {job.to || "Recipient not available"}
                  </p>
                </div>
                <span className={`shrink-0 rounded px-2 py-1 text-[11px] font-bold uppercase ${statusClasses(job.status)}`}>
                  {job.status}
                </span>
              </div>

              {job.lastError && (
                <p className="mt-2 line-clamp-2 text-xs font-semibold text-rose-600">
                  {formatJobError(job.lastError)}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#eee7d8] pt-3">
                <div className="text-xs font-semibold text-[#746d61]">
                  <span className="block">Attempts {job.attempts}/{job.maxAttempts}</span>
                  <span className="block">{formatShortDateTime(job.updatedAt || job.createdAt)}</span>
                </div>
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
              </div>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 font-bold">Type</th>
                <th className="px-4 py-3 font-bold">Recipient</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Attempts</th>
                <th className="px-4 py-3 font-bold">Updated</th>
                <th className="px-4 py-3 font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {jobs.map((job) => (
                <tr key={job._id} className="queue-row">
                  <td className="px-4 py-4 font-bold text-ink">{formatJobType(job.type)}</td>
                  <td className="px-4 py-4 text-slate-600">{job.to || "Not available"}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${statusClasses(job.status)}`}>
                      {job.status}
                    </span>
                    {job.lastError && (
                      <div className="mt-2 max-w-xs text-xs font-semibold text-rose-600">
                        {formatJobError(job.lastError)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {job.attempts}/{job.maxAttempts}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                    {formatShortDateTime(job.updatedAt || job.createdAt)}
                  </td>
                  <td className="px-4 py-4">
                    {job.status === "failed" ? (
                      <button
                        className="classic-button"
                        disabled={retryingJobId === job._id}
                        onClick={() => onRetry(job._id)}
                        type="button"
                      >
                        <RotateCcw size={15} aria-hidden="true" />
                        Retry
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">No action</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </fieldset>
  );
}
