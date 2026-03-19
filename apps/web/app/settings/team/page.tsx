import SettingsShell from "../../components/SettingsShell";
import WorkspaceUsersSettings from "../../components/WorkspaceUsersSettings";

export default function SettingsTeamPage() {
  return (
    <SettingsShell
      title="Team"
      subtitle="Manage workspace users, roles, and the people available for project ownership and delivery."
    >
      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <WorkspaceUsersSettings />
      </section>
    </SettingsShell>
  );
}
