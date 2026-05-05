import SettingsShell from "../../../components/SettingsShell";
import HubSpotIntegrationSettings from "../../../components/HubSpotIntegrationSettings";

export default function SettingsIntegrationsHubSpotPage() {
  return (
    <SettingsShell
      title="HubSpot"
      subtitle="Connect Muloo's portal via private app, then cherry-pick the companies, contacts, and deals to bring into DeployOS as Clients."
    >
      <HubSpotIntegrationSettings />
    </SettingsShell>
  );
}
