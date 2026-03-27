"use client";

export default function ProjectError({
  error,
  reset
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-background-primary p-6 text-white sm:p-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-status-error/30 bg-status-error/10 p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
          Project Detail Error
        </p>
        <h1 className="mt-3 text-2xl font-semibold">This project page hit a render error.</h1>
        <p className="mt-3 text-sm text-text-secondary">
          {error.message || "Something unexpected went wrong while loading the project workspace."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-xl bg-muloo-gradient px-4 py-3 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
