import EmailSettings from "../../components/EmailSettings";
import SettingsShell from "../../components/SettingsShell";

export default function SettingsEmailPage() {
  return (
    <SettingsShell
      title="Email"
      subtitle="Connect SMTP so project updates and notifications can send from your own domain."
    >
      <EmailSettings />
    </SettingsShell>
  );
}
