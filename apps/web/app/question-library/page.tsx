import AppShell from "../components/AppShell";

const categories = [
  "Business Goals",
  "Current State",
  "CRM and Sales",
  "Marketing",
  "Website and CMS",
  "Service and Support",
  "Reporting",
  "Data and Migration",
  "Integrations",
  "Security and Access",
  "Operations",
  "Handover"
];

export default function QuestionLibraryPage() {
  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
          <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
            Operations
          </p>
          <h1 className="mt-3 text-3xl font-bold font-heading text-white">
            Question Library
          </h1>
          <p className="mt-3 max-w-3xl text-text-secondary">
            The master bank of reusable discovery questions. Workbook templates
            pull from here. Edit a question once and every workbook template
            picks up the change. This is also where the messy categorisation
            gets fixed for good.
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <h2 className="text-lg font-semibold text-white">
            What will live here
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
            <li>
              •{" "}
              <span className="text-white">
                Searchable, filterable question list
              </span>{" "}
              with category, section, suggested workbook, suggested contributor
              role and HubSpot area.
            </li>
            <li>
              •{" "}
              <span className="text-white">
                Question metadata
              </span>
              : type (text / long text / yes-no / multiple choice / file upload
              / link), required vs optional, internal vs client-facing, tags,
              active/archived status.
            </li>
            <li>
              •{" "}
              <span className="text-white">
                Categorisation overhaul
              </span>{" "}
              — technology stack, hosting, DNS, integrations, costs, access,
              permissions and data security questions get moved out of website
              discovery and into their right home (technical, integrations,
              data, security).
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <h2 className="text-lg font-semibold text-white">
            Planned categories
          </h2>
          <ul className="mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((name) => (
              <li
                key={name}
                className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-background-elevated px-4 py-3 text-white"
              >
                {name}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-text-muted">
            Coming soon — full library editor and the categorisation migration
            in a follow-up slice. Existing questions inside project workbooks
            keep working as they are today.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
