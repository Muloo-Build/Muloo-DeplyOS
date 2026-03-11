import AppShell from '../components/AppShell'

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="p-8">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
          <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
            Settings
          </p>
          <h1 className="mt-3 text-3xl font-bold font-heading text-white">
            Workspace Settings
          </h1>
          <p className="mt-3 max-w-2xl text-text-secondary">
            Environment and integration settings are still served by the backend
            API. A dedicated settings UI can be layered on next without breaking
            the navigation shell.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
