import AppShell from "../components/AppShell";
import { EmbeddedProductsCatalog } from "../components/ProductsCatalog";
import WorkspaceUsersSettings from "../components/WorkspaceUsersSettings";
import WorkRequestsInbox from "../components/WorkRequestsInbox";
import Link from "next/link";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="p-8">
        <div className="space-y-6">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
            <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
              Settings
            </p>
            <h1 className="mt-3 text-3xl font-bold font-heading text-white">
              Workspace Settings
            </h1>
            <p className="mt-3 max-w-3xl text-text-secondary">
              This will become the operating layer for workspace management:
              team access, model providers, HubSpot OAuth, templates, and
              default delivery rules. Auth can land later without changing the
              overall structure.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                    Team
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Users and access levels
                  </h2>
                </div>
                <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs font-medium text-text-secondary">
                  Planned
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <WorkspaceUsersSettings />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                    Providers
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    AI and integration connections
                  </h2>
                </div>
                <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs font-medium text-text-secondary">
                  Planned
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {[
                  [
                    "HubSpot OAuth",
                    "Primary auth layer later for user sign-in and account linking."
                  ],
                  [
                    "Anthropic / Claude",
                    "Discovery drafting, project summaries, and blueprint generation."
                  ],
                  [
                    "OpenAI / ChatGPT",
                    "Alternative agent workflows, QA passes, summarisation, and future assistants."
                  ],
                  [
                    "Google Gemini",
                    "Meeting-summary workflows and discovery ingestion from call outputs."
                  ]
                ].map(([label, description]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-2 py-1 text-xs font-medium text-text-secondary">
                        Not connected
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-text-secondary">
                      {description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                Near-term roadmap
              </p>
              <div className="mt-5 space-y-3">
                {[
                  "Move the current hardcoded team list into persisted workspace settings.",
                  "Add role labels and default owner routing by service line.",
                  "Store multiple model providers and per-agent model preferences.",
                  "Add HubSpot OAuth as the future login and connection layer."
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-3 text-sm text-text-secondary"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                Design principle
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Settings owns workspace configuration. Agents owns operational
                agent design.
              </h2>
              <p className="mt-3 text-text-secondary">
                That split keeps admin concerns like users, permissions,
                providers, and OAuth out of day-to-day agent authoring. It also
                gives us a cleaner path to multi-model agent orchestration later
                on.
              </p>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                    Work Intake
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Request review inbox
                  </h2>
                  <p className="mt-2 max-w-2xl text-text-secondary">
                    Client-submitted quote requests, job briefs, and change
                    requests land here for triage.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <WorkRequestsInbox />
              </div>
            </section>

            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                Delivery Templates
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Reusable delivery patterns
              </h2>
              <p className="mt-3 text-text-secondary">
                Theme installs, onboarding, migrations, and other repeatable
                jobs should begin from approved templates rather than scratch.
              </p>
              <Link
                href="/templates"
                className="mt-5 inline-flex rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
              >
                Open template library
              </Link>
            </section>
          </div>

          <section
            id="products"
            className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                  Commercial Catalog
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Products, retainers, and add-ons
                </h2>
                <p className="mt-2 max-w-3xl text-text-secondary">
                  Keep one-off services, recurring retainers, and bundled add-on
                  products here so quotes can be built from approved discovery
                  scope or quoted as standalone jobs.
                </p>
              </div>
              <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs font-medium text-text-secondary">
                Live
              </span>
            </div>

            <div className="-mx-8 mt-6">
              <EmbeddedProductsCatalog />
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
