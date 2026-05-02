import AppShell from "../components/AppShell";
import AgentDirectory from "../components/AgentDirectory";
import HubSpotAgentWorkbench from "../components/HubSpotAgentWorkbench";

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
              Agent Directory
            </h1>
            <p className="mt-3 max-w-3xl text-text-secondary">
              Search, filter, and manage every operational agent. Click a row to
              edit; use the side panel to create new agents or adjust existing
              ones without losing your place.
            </p>
          </div>

          <AgentDirectory />
          <HubSpotAgentWorkbench />
        </div>
      </div>
    </AppShell>
  );
}
