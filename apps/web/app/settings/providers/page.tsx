import SettingsShell from "../../components/SettingsShell";
import ProviderConnectionsSettings from "../../components/ProviderConnectionsSettings";

export default function SettingsProvidersPage() {
  return (
    <SettingsShell
      title="Providers"
      subtitle="Store provider API keys, default models, and integration settings so agents can be tested against different models and tasks."
    >
      <ProviderConnectionsSettings />
    </SettingsShell>
  );
}
