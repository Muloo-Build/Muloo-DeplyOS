"use client";

import Link from "next/link";
import { useState } from "react";

export default function WorkspaceForgotPasswordView() {
  const [identifier, setIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          identifier: identifier.trim()
        })
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to request password reset");
      }

      setSuccess(
        "If the account exists, we have emailed a reset link to the address on file."
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to request password reset"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-primary px-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-text-muted">
          Business admin
        </p>
        <h1 className="mt-3 text-3xl font-bold font-heading text-white">
          Reset your password
        </h1>
        <p className="mt-3 text-text-secondary">
          Enter your work email or username and we&apos;ll send you a secure link
          to set a new password.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm text-text-secondary">
              Email or username
            </span>
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
              placeholder="name@company.com"
            />
          </label>

          {error ? <p className="text-sm text-[#ff8f9c]">{error}</p> : null}
          {success ? <p className="text-sm text-[#7be2ef]">{success}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Email reset link"}
          </button>
        </form>

        <div className="mt-6">
          <Link
            href="/login"
            className="text-sm text-text-secondary underline-offset-4 hover:text-white hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
