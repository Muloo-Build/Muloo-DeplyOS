import SettingsShell from "../../components/SettingsShell";
import { StandaloneProductsCatalog } from "../../components/ProductsCatalog";

export default function SettingsProductsPage() {
  return (
    <SettingsShell
      title="Products"
      subtitle="Manage the commercial catalog of one-off services, retainers, and add-ons that can be pulled into quotes and approvals."
    >
      <section className="bg-ink-1 border border-ink-4 rounded-[14px] p-2">
        <StandaloneProductsCatalog />
      </section>
    </SettingsShell>
  );
}
