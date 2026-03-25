import AuthGate from "../../components/AuthGate";
import SettingsShell from "../../components/SettingsShell";
import WorkspaceSettings from "../../components/WorkspaceSettings";

export default function SettingsWorkspacePage() {
  return (
    <AuthGate>
      <SettingsShell
        title="Workspace"
        subtitle="Manage Command Centre connections for Google Calendar, Xero, and the AI routing used for the daily briefing."
      >
        <WorkspaceSettings />
      </SettingsShell>
    </AuthGate>
  );
}
