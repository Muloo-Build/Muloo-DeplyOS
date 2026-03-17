import AppShell from "../components/AppShell";

export default function AgentsPage() {
  return (
    <AppShell>
      <div className="p-8">
        <div className="space-y-6">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
            <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
              Agents
            </p>
            <h1 className="mt-3 text-3xl font-bold font-heading text-white">
              Agent Studio
            </h1>
            <p className="mt-3 max-w-3xl text-text-secondary">
              This is where DeployOS should manage operational agents: what each
              agent does, which model it uses, what inputs it expects, and when
              it is allowed to act.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                    Agent catalogue
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Core agents for Muloo delivery
                  </h2>
                </div>
                <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs font-medium text-text-secondary">
                  Planned
                </span>
              </div>

              <div className="mt-5 grid gap-4">
                {[
                  [
                    "Discovery Structuring Agent",
                    "Turns meeting notes, docs, and summaries into structured discovery records."
                  ],
                  [
                    "Delivery Planner Agent",
                    "Converts approved discovery into phased implementation plans and role splits."
                  ],
                  [
                    "Scoping Agent",
                    "Supports pricing, effort bands, and commercial scope framing."
                  ],
                  [
                    "Change Request Agent",
                    "Compares new asks against approved scope and flags commercial impact."
                  ]
                ].map(([label, description]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                  >
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                Provider strategy
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Multiple models, one operating layer
              </h2>

              <div className="mt-5 space-y-4">
                {[
                  [
                    "Model routing",
                    "Choose Claude, OpenAI, or Gemini per agent instead of locking the whole workspace to one provider."
                  ],
                  [
                    "Prompt controls",
                    "Store system prompts, allowed actions, escalation rules, and approval boundaries by agent."
                  ],
                  [
                    "Execution policy",
                    "Later we can add human approval for commercial, destructive, or client-facing actions."
                  ]
                ].map(([label, description]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                  >
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
