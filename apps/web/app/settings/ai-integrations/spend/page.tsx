import AIIntegrationsShell from "../../../components/AIIntegrationsShell";
import AISpendDashboard from "../../../components/AISpendDashboard";

export default function SettingsAISpendPage() {
  return (
    <AIIntegrationsShell
      title="AI Spend"
      subtitle="Cost and token usage by provider, model, agent, and project. Costs computed at write time from the catalog."
    >
      <AISpendDashboard />
    </AIIntegrationsShell>
  );
}
