import AIIntegrationsShell from "../../../components/AIIntegrationsShell";
import AIAgentsLens from "../../../components/AIAgentsLens";

export default function SettingsAIAgentsPage() {
  return (
    <AIIntegrationsShell
      title="AI Agents"
      subtitle="Every named AI agent in DeployOS, the model it runs on by default, and its 7-day spend."
    >
      <AIAgentsLens />
    </AIIntegrationsShell>
  );
}
