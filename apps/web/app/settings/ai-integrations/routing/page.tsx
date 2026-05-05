import AIIntegrationsShell from "../../../components/AIIntegrationsShell";
import AiRoutingSettings from "../../../components/AiRoutingSettings";

export default function SettingsAIRoutingPage() {
  return (
    <AIIntegrationsShell
      title="AI Routing"
      subtitle="Map workflows (discovery extraction, daily summary, blueprint, etc.) to a specific provider + model."
    >
      <AiRoutingSettings />
    </AIIntegrationsShell>
  );
}
