import SettingsShell from "../../components/SettingsShell";
import WorkspaceUsersSettings from "../../components/WorkspaceUsersSettings";

export default function SettingsTeamPage() {
  return (
    <SettingsShell
      title="Team"
      subtitle="Manage workspace users, roles, and the people available for project ownership and delivery."
    >
      <section className="bg-ink-1 border border-ink-4 rounded-[14px] p-6">
        <WorkspaceUsersSettings />
      </section>
    </SettingsShell>
  );
}
