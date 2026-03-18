import AppShell from "../components/AppShell";
import AgentStudio from "../components/AgentStudio";

export default function AgentsPage() {
  return (
    <AppShell>
      <div className="p-8">
        <div className="space-y-6">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
            <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
              Agents
            </p>
            <h1 className="mt-3 text-3xl font-bold font-heading text-white">
              Agent Studio
            </h1>
            <p className="mt-3 max-w-3xl text-text-secondary">
              Create and manage the agents that shape discovery, planning,
              quoting, and later deployment work across DeployOS.
            </p>
          </div>

          <AgentStudio />
        </div>
      </div>
    </AppShell>
  );
}
