import AppShell from "../components/AppShell";
import AgentDirectory from "../components/AgentDirectory";
import HubSpotAgentWorkbench from "../components/HubSpotAgentWorkbench";
import { PageHead } from "../components/ui/PageHead";

export default function AgentsPage() {
  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow="Library"
          title="Agents"
          lede="Search, filter, and manage every operational agent. Click a row to edit; use the side panel to create new agents or adjust existing ones without losing your place."
        />
        <div className="space-y-6">
          <AgentDirectory />
          <HubSpotAgentWorkbench />
        </div>
      </div>
    </AppShell>
  );
}
