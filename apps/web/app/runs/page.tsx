import AppShell from '../components/AppShell'

export default function RunsPage() {
  return (
    <AppShell>
      <div className="p-8">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
          <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
            Runs
          </p>
          <h1 className="mt-3 text-3xl font-bold font-heading text-white">
            Execution History
          </h1>
          <p className="mt-3 max-w-2xl text-text-secondary">
            Execution records still exist on the backend. This route now keeps the
            sidebar flow intact while the dedicated runs interface is rebuilt.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
