import EmailSettings from "../../components/EmailSettings";
import SettingsShell from "../../components/SettingsShell";

export default function SettingsEmailPage() {
  return (
    <SettingsShell
      title="Email"
      subtitle="Configure SMTP relay for system mail and connect a Google mailbox when you want OAuth-based sending."
    >
      <EmailSettings />
    </SettingsShell>
  );
}
