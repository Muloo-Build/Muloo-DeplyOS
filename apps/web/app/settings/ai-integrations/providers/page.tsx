import AIIntegrationsShell from "../../../components/AIIntegrationsShell";
import AIProvidersSettings from "../../../components/AIProvidersSettings";

export default function SettingsAIProvidersPage() {
  return (
    <AIIntegrationsShell
      title="AI Providers"
      subtitle="Pick the default model per provider from a curated catalog. Costs shown per 1M tokens."
    >
      <AIProvidersSettings />
    </AIIntegrationsShell>
  );
}
