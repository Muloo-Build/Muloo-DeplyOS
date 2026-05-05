import AIIntegrationsShell from "../../../components/AIIntegrationsShell";
import AIBudgetsSettings from "../../../components/AIBudgetsSettings";

export default function SettingsAIBudgetsPage() {
  return (
    <AIIntegrationsShell
      title="AI Budgets"
      subtitle="Soft monthly caps per provider. Alerts surface at 50, 80, and 100% of the cap. Calls are not blocked."
    >
      <AIBudgetsSettings />
    </AIIntegrationsShell>
  );
}
