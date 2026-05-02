import AppShell from "../components/AppShell";
import WorkbookTemplateStudio from "../components/WorkbookTemplateStudio";

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
            Edits to a template do not retroactively change project
            workbooks already created from it.
          </p>
        </div>

        <WorkbookTemplateStudio />
      </div>
    </AppShell>
  );
}
