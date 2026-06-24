import AppShell from "../components/AppShell";
import DeliveryTemplatesStudio from "../components/DeliveryTemplatesStudio";
import { PageHead } from "../components/ui/PageHead";

export default function TemplatesPage() {
  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow="Operations"
          title="Implementation templates"
          lede="Reusable HubSpot delivery patterns — prefill plans, anticipated hours, QA checks, handover tasks, and default working patterns for common Muloo job types. Discovery questionnaires live under Workbooks + Question library."
        />
        <DeliveryTemplatesStudio />
      </div>
    </AppShell>
  );
}
