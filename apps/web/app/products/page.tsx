import AppShell from "../components/AppShell";
import { StandaloneProductsCatalog } from "../components/ProductsCatalog";
import { Panel } from "../components/ui/Panel";
import { PageHead } from "../components/ui/PageHead";

export default function ProductsPage() {
  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow="Library"
          title="Product catalogue"
          lede="One-off services, retainers and add-ons that can be pulled into quotes. Edit prices, billing models and descriptions in one place."
        />
        <Panel>
          <div className="p-2">
            <StandaloneProductsCatalog />
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
