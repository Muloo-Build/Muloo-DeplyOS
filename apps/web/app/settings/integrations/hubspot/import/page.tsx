import SettingsShell from "../../../../components/SettingsShell";
import HubSpotImportWorkspace from "../../../../components/HubSpotImportWorkspace";

export default function SettingsIntegrationsHubSpotImportPage() {
  return (
    <SettingsShell
      title="Import from HubSpot"
      subtitle="Search your portal, preview related records, and import only the companies you want as Clients in DeployOS."
    >
      <HubSpotImportWorkspace />
    </SettingsShell>
  );
}
