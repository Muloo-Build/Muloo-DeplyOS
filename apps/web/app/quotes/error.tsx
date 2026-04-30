"use client";

import Link from "next/link";

export default function QuotesError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-background-primary p-6 text-white sm:p-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-status-error/30 bg-status-error/10 p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
          Quotes
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          The quote workspace hit a render error.
        </h1>
        <p className="mt-3 text-sm text-text-secondary">
          {error.message ||
            "Something unexpected went wrong while loading this quote view."}
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-text-muted">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-muloo-gradient px-4 py-3 text-sm font-medium text-white"
          >
            Try again
          </button>
          <Link
            href="/quotes"
            className="rounded-xl border border-[rgba(255,255,255,0.12)] bg-white/5 px-4 py-3 text-sm font-medium text-white hover:border-[rgba(255,255,255,0.2)]"
          >
            Back to all quotes
          </Link>
        </div>
      </div>
    </div>
  );
}
