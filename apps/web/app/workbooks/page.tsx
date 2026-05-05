import AppShell from "../components/AppShell";
import WorkbookTemplateStudio from "../components/WorkbookTemplateStudio";
import { PageHead } from "../components/ui/PageHead";

export default function WorkbooksPage() {
  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow="Library"
          title="Workbooks"
          lede="Reusable workbook templates that projects can pull from. Build the structure once here, then add it to any project — each project gets its own editable copy without touching the source template."
        />
        <WorkbookTemplateStudio />
      </div>
    </AppShell>
  );
}
