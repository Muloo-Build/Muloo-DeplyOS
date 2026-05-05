import AppShell from "../components/AppShell";
import QuestionLibraryStudio from "../components/QuestionLibraryStudio";
import { PageHead } from "../components/ui/PageHead";

export default function QuestionLibraryPage() {
  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow="Library"
          title="Question library"
          lede="The master bank of reusable discovery questions. Workbooks and templates pull from here. Edit a question once and every future workbook picks up the change."
        />
        <QuestionLibraryStudio />
      </div>
    </AppShell>
  );
}
