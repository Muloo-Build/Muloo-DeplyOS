import SettingsShell from "../../components/SettingsShell";
import { StandaloneProductsCatalog } from "../../components/ProductsCatalog";

export default function SettingsProductsPage() {
  return (
    <SettingsShell
      title="Products"
      subtitle="Manage the commercial catalog of one-off services, retainers, and add-ons that can be pulled into quotes and approvals."
    >
      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-2">
        <StandaloneProductsCatalog />
      </section>
    </SettingsShell>
  );
}
