import Link from "next/link";
import AppShell from "../components/AppShell";

const exampleTemplates = [
  "HubSpot Discovery Workbook",
  "Website Discovery Workbook",
  "Tech Stack and Access Workbook",
  "Reporting Discovery Workbook",
  "Sales Process Workbook",
  "Service Hub Workbook",
  "CMS Migration Workbook",
  "Marketing Campaign Readiness Workbook",
  "Stakeholder Interview Workbook"
];

export default function WorkbooksPage() {
  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
          <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
            Operations
          </p>
          <h1 className="mt-3 text-3xl font-bold font-heading text-white">
            Workbooks
          </h1>
          <p className="mt-3 max-w-3xl text-text-secondary">
            Reusable workbook templates that projects can pull from. Build the
            structure once here, then add it to any project — each project
            gets its own editable copy without touching the source template.
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <h2 className="text-lg font-semibold text-white">
            What will live here
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
            <li>
              • <span className="text-white">List of workbook templates</span>{" "}
              with search and filter (category, hub, project type, contributor
              role).
            </li>
            <li>
              • <span className="text-white">Create / edit / duplicate /
              archive</span> templates with sections, questions (pulled from
              the Question Library), tags, default visibility and suggested
              contributor roles.
            </li>
            <li>
              •{" "}
              <span className="text-white">Preview as a contributor</span>{" "}
              before publishing.
            </li>
            <li>
              •{" "}
              <span className="text-white">
                "Add workbook from library"
              </span>{" "}
              flow on each project — pulls a template into the project as a
              new editable copy.
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <h2 className="text-lg font-semibold text-white">
            Planned templates
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            Initial template library being designed:
          </p>
          <ul className="mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
            {exampleTemplates.map((name) => (
              <li
                key={name}
                className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-background-elevated px-4 py-3 text-white"
              >
                {name}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-text-muted">
            Coming soon — schema and template editor in a follow-up slice.
            Existing project workbooks under{" "}
            <Link
              href="/projects"
              className="text-brand-teal hover:underline"
            >
              Projects
            </Link>{" "}
            continue to work as before.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
