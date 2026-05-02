export const dynamic = "force-dynamic";

export default function ContributorWorkbookPlaceholder({
  params
}: {
  params: { token: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-12">
      <div className="brand-surface w-full rounded-3xl border border-white/10 p-8 text-center">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-white">
          Contributor workbook coming soon
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-secondary">
          You don&apos;t need a portal account to contribute. When this
          workbook is ready, you&apos;ll be able to open it from this link, fill
          in just the sections assigned to you, and submit your answers — no
          login required.
        </p>

        <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-left">
          <p className="text-[11px] uppercase tracking-wide text-text-secondary">
            Your secure link reference
          </p>
          <code className="mt-1 block break-all text-xs text-white">
            {params.token}
          </code>
        </div>

        <p className="mt-6 text-xs text-text-secondary">
          If you were expecting to fill something in today, please contact the
          person who shared this link with you.
        </p>
      </div>
    </main>
  );
}
