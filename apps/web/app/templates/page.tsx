import AppShell from "../components/AppShell";
import DeliveryTemplatesStudio from "../components/DeliveryTemplatesStudio";

export default function TemplatesPage() {
  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
          <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
            Templates
          </p>
          <h1 className="mt-3 text-3xl font-bold font-heading text-white">
            Delivery Template Library
          </h1>
          <p className="mt-3 max-w-3xl text-text-secondary">
            Use approved templates to prefill repeatable delivery plans,
            anticipated hours, and default working patterns for common Muloo job
            types.
          </p>
        </div>

        <DeliveryTemplatesStudio />
      </div>
    </AppShell>
  );
}
