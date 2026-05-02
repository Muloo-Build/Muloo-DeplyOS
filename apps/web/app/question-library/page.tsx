import AppShell from "../components/AppShell";
import QuestionLibraryStudio from "../components/QuestionLibraryStudio";

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
            The master bank of reusable discovery questions. Workbooks and
            workbook templates pull from here. Edit a question once and every
            future workbook picks up the change. Use this page to keep
            categorisation clean — technology, integrations, security and
            data questions belong in their right home, not mixed into website
            discovery.
          </p>
        </div>

        <QuestionLibraryStudio />
      </div>
    </AppShell>
  );
}
