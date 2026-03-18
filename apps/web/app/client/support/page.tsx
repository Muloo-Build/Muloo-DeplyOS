import ClientShell from "../../components/ClientShell";
import HubSpotSupportForm from "../../components/HubSpotSupportForm";

export default function ClientSupportPage() {
  return (
    <ClientShell
      title="Support"
      subtitle="Log a support request with Muloo and we will route it into our support workflow."
    >
      <div className="grid gap-6">
        <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
            Support Desk
          </p>
          <h3 className="mt-3 text-2xl font-bold font-heading text-white">
            Submit a support request
          </h3>
          <p className="mt-3 max-w-3xl text-sm text-text-secondary">
            Use this form for fixes, support questions, portal issues, or
            anything that needs Muloo assistance. Your request will create a
            support ticket in our system so we can track it properly.
          </p>
        </section>

        <HubSpotSupportForm />
      </div>
    </ClientShell>
  );
}
