"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort client-side error reporting. Server logs the same via
    // Next.js's built-in error reporting; this is a soft hook for future
    // wiring to /api/client-error or a third-party logger.
    if (typeof window !== "undefined") {
      const surface = window.location.pathname.startsWith("/client")
        ? "client"
        : window.location.pathname.startsWith("/share")
          ? "public"
          : "internal";
      try {
        void fetch("/api/client-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: error.message,
            stack: error.stack ?? null,
            digest: error.digest ?? null,
            url: window.location.href,
            surface
          })
        });
      } catch {
        // ignore — best effort only
      }
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-0 p-6 text-white">
      <div className="w-full max-w-md rounded-[14px] border border-status-error/30 bg-status-error/10 p-6 text-center">
        <p className="text-xs uppercase tracking-[0.14em] text-text-3">
          Unexpected error
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Something went wrong.</h1>
        <p className="mt-3 text-sm text-text-2">
          {error.message ||
            "We've logged the issue. Try again, or head back to your Command Centre."}
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
            href="/command-centre"
            className="rounded-xl border border-ink-4 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:border-[rgba(255,255,255,0.2)]"
          >
            Back to Command Centre
          </Link>
        </div>
      </div>
    </div>
  );
}
