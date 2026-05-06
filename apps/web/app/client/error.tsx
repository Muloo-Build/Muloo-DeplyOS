"use client";

import Link from "next/link";

export default function ClientPortalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-0 p-6 text-white">
      <div className="w-full max-w-lg rounded-[14px] border border-ink-4 bg-ink-1 p-6 text-center">
        <img
          src="/muloo-mark.svg"
          alt="Muloo"
          className="mx-auto h-10 w-10"
        />
        <h1 className="mt-4 text-2xl font-semibold">
          We hit a snag loading your portal.
        </h1>
        <p className="mt-3 text-sm text-text-2">
          The Muloo team has been notified. Try refreshing — if it keeps
          happening, drop us a message and we'll sort it out.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-text-3">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-muloo-gradient px-4 py-3 text-sm font-medium text-white"
          >
            Try again
          </button>
          <Link
            href="/client"
            className="rounded-xl border border-ink-4 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:border-[rgba(255,255,255,0.2)]"
          >
            Back to portal home
          </Link>
        </div>
      </div>
    </div>
  );
}
