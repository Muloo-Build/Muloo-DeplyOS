"use client";

import Link from "next/link";
import { useState } from "react";

import {
  type PortalExperience,
  getPortalLabel,
  getPortalLoginPath,
  getPortalSupportPath
} from "./portalExperience";

export default function PortalForgotPasswordView({
  portalExperience
}: {
  portalExperience: PortalExperience;
}) {
  const portalLabel = getPortalLabel(portalExperience);
  const lowerPortalLabel = portalLabel.toLowerCase();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/client-auth/request-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email.trim()
        })
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to request password reset");
      }

      setSuccess(
        "If the email exists in the portal, we have sent a secure reset link."
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
    <div className="min-h-screen bg-background-primary px-6 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center py-10">
        <div className="w-full rounded-[32px] border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
          <img src="/muloo-logo.svg" alt="Muloo" className="h-10 w-auto" />
          <p className="mt-6 text-sm uppercase tracking-[0.3em] text-text-muted">
            {portalLabel} access
          </p>
          <h1 className="mt-3 text-3xl font-bold font-heading text-white">
            Need a reset link?
          </h1>
          <p className="mt-3 text-text-secondary">
            Enter the email address used for your {lowerPortalLabel} portal and
            we&apos;ll send you a fresh reset link. This portal stays invite-only,
            so only approved users can receive access.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm text-text-secondary">
                Portal email
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                placeholder="name@company.com"
              />
            </label>

            {error ? <p className="text-sm text-[#ff8f9c]">{error}</p> : null}
            {success ? (
              <p className="text-sm text-[#7be2ef]">{success}</p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Sending..." : "Email reset link"}
            </button>
          </form>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={getPortalSupportPath(portalExperience)}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white"
            >
              Contact support
            </Link>
            <Link
              href={getPortalLoginPath(portalExperience)}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
