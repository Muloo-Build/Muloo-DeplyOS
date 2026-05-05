import Link from "next/link";

import SettingsShell from "../../../components/SettingsShell";

export default function SettingsIntegrationsGooglePage() {
  return (
    <SettingsShell
      title="Google Workspace"
      subtitle="Sign in with Google, send mailbox-routed email, and surface meeting notes from connected calendars."
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
            Live today
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Email mailbox
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            Workspace email is already configured under Settings → Email. We
            keep that flow there for now and will fold it under Integrations
            in a future pass.
          </p>
          <div className="mt-4">
            <Link
              href="/settings/email"
              className="rounded-xl border border-[rgba(255,255,255,0.18)] px-4 py-3 text-sm font-medium text-white"
            >
              Open email settings →
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
            Coming soon
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Calendar + Drive
          </h2>
          <p className="mt-3 text-sm text-text-secondary">
            Pull meeting notes, attach Drive files to projects, and surface
            upcoming sessions in the Command Centre.
          </p>
        </section>
      </div>
    </SettingsShell>
  );
}
