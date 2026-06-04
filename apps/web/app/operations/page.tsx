import Link from "next/link";
import AppShell from "../components/AppShell";
import { PageHead } from "../components/ui/PageHead";

const operationsAssets = [
  {
    href: "/workbooks",
    title: "Workbooks",
    eyebrow: "Discovery structure",
    description:
      "Reusable workbook templates for CRM, sales, marketing, service, reporting, integrations, migration and website discovery.",
    principle:
      "Templates are global Muloo IP. Projects get their own copied workbook instances."
  },
  {
    href: "/question-library",
    title: "Question library",
    eyebrow: "Reusable intelligence",
    description:
      "The master bank of discovery questions, guidance, tags, client/internal visibility and implementation mapping.",
    principle:
      "Questions feed templates; client answers still need Muloo review before becoming delivery truth."
  },
  {
    href: "/templates",
    title: "Implementation templates",
    eyebrow: "Delivery patterns",
    description:
      "Reusable HubSpot delivery patterns for setups, reports, workflows, permissions, QA checks and handover tasks.",
    principle:
      "Discovery evidence should drive implementation plans, not vibes and caffeine."
  },
  {
    href: "/runs",
    title: "Agent runs",
    eyebrow: "Auditable assistance",
    description:
      "Review AI-assisted work, recommendations, run outputs and approval-gated execution history.",
    principle:
      "Agents must use scoped project context and stay auditable before they touch client systems."
  }
];

const productRules = [
  "Keep platform assets global: workbook templates, question library and implementation templates do not belong inside one project.",
  "Copy templates into projects before clients or contributors use them, so historical project work stays stable.",
  "Keep contributor access assignment-scoped. Contributors should see only what they need to complete.",
  "Review submissions before converting them into discovery evidence, tasks, risks or recommendations.",
  "Expose only useful contribution and progress views to clients; keep Muloo delivery control internal."
];

export default function OperationsPage() {
  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full space-y-8">
        <PageHead
          eyebrow="Operations"
          title="Operations control centre"
          lede="Reusable delivery assets for Deploy OS. Build the structure once, copy it into projects, then use reviewed evidence to drive planning, delivery and QA."
        />

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {operationsAssets.map((asset) => (
            <Link
              key={asset.href}
              href={asset.href}
              className="group rounded-2xl border border-ink-4 bg-ink-2/70 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-from/60 hover:bg-ink-3/80"
            >
              <div className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold mb-2">
                {asset.eyebrow}
              </div>
              <h2 className="text-[18px] font-semibold text-text-1 m-0 mb-2 group-hover:text-white">
                {asset.title}
              </h2>
              <p className="text-[13px] leading-5 text-text-3 m-0 mb-4">
                {asset.description}
              </p>
              <div className="rounded-xl border border-ink-4 bg-ink-1/70 px-3 py-2 text-[12px] leading-5 text-text-2">
                {asset.principle}
              </div>
            </Link>
          ))}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5">
          <div className="rounded-2xl border border-ink-4 bg-ink-2/70 p-6">
            <div className="text-[11px] uppercase tracking-[0.14em] text-text-3 font-semibold mb-2">
              Recommended workflow
            </div>
            <h2 className="text-[20px] font-semibold text-text-1 m-0 mb-4">
              Discovery to delivery spine
            </h2>
            <ol className="grid grid-cols-1 md:grid-cols-2 gap-3 m-0 p-0 list-none">
              {[
                "Select reusable workbook templates",
                "Copy them into a project as project workbook instances",
                "Assign scoped contributors to workbooks, sections or questions",
                "Collect answers, uploads and links without exposing internal admin",
                "Review submissions into accepted discovery evidence",
                "Convert accepted evidence into implementation plan items and QA checks"
              ].map((step, index) => (
                <li
                  key={step}
                  className="rounded-xl border border-ink-4 bg-ink-1/70 p-4 text-[13px] leading-5 text-text-2"
                >
                  <span className="text-brand-from font-semibold mr-2">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-ink-4 bg-ink-2/70 p-6">
            <div className="text-[11px] uppercase tracking-[0.14em] text-text-3 font-semibold mb-2">
              Product guardrails
            </div>
            <h2 className="text-[20px] font-semibold text-text-1 m-0 mb-4">
              Keep the spaghetti out
            </h2>
            <ul className="space-y-3 m-0 p-0 list-none">
              {productRules.map((rule) => (
                <li key={rule} className="flex gap-3 text-[13px] leading-5 text-text-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-from" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
