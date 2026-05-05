import Link from "next/link";

import SettingsShell from "../../../components/SettingsShell";

export default function SettingsIntegrationsGooglePage() {
  return (
    <SettingsShell
      title="Google Workspace"
      subtitle="Sign in with Google, send mailbox-routed email, and pull calendar context into the Command Centre."
    >
      <div className="space-y-5">
        <section className="bg-ink-1 border border-ink-4 rounded-[14px] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                Live today
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Email + calendar
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-text-secondary">
                Gmail mailbox routing and Google Calendar are configured
                today. The OAuth connect lives under Email settings (mailbox
                + filter label) and Workspace settings (calendar). Opening
                from here jumps to the existing flow.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/settings/email"
                className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white"
              >
                Open email settings →
              </Link>
              <Link
                href="/settings/workspace#calendar"
                className="rounded-xl border border-[rgba(255,255,255,0.18)] px-4 py-3 text-sm font-medium text-white"
              >
                Open calendar connect →
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-ink-1 border border-ink-4 rounded-[14px] p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
            Roadmap
          </p>
          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
            <li>✓ Gmail mailbox routing (send-as / reply-to)</li>
            <li>✓ Calendar context in Command Centre + project meetings</li>
            <li>· Drive — attach files to projects, search across client docs</li>
            <li>· Workspace audit log + 2SV enforcement check (feeds Security profile)</li>
          </ul>
        </section>
      </div>
    </SettingsShell>
  );
}
