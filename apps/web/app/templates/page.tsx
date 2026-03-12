import AppShell from "../components/AppShell";

export default function TemplatesPage() {
  return (
    <AppShell>
      <div className="p-8">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
          <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
            Templates
          </p>
          <h1 className="mt-3 text-3xl font-bold font-heading text-white">
            Template Library
          </h1>
          <p className="mt-3 max-w-2xl text-text-secondary">
            The existing template data is available through the API and can be
            wired into a dedicated Next.js UI next. The current priority was the
            project overview and discovery workflow.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
