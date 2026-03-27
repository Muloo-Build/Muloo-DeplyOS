"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { markPendingHubSpotPortalLogin } from "./hubspotClientTracking";
import {
  type PortalExperience,
  getPortalLabel,
  getPortalLoginPath,
  getPortalProjectsPath
} from "./portalExperience";

export default function ClientActivateForm({
  token,
  portalExperience = "client"
}: {
  token: string;
  portalExperience?: PortalExperience;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portalLabel = getPortalLabel(portalExperience);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      setError("Use at least 8 characters for the password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/client-auth/set-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          token,
          password
        })
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to set password");
      }

      markPendingHubSpotPortalLogin();
      router.replace(getPortalProjectsPath(portalExperience));
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to set password"
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
            Set your password
          </h1>
          <p className="mt-3 text-text-secondary">
            Use this link to activate your Muloo portal access or reset your
            password.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm text-text-secondary">
                New password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-text-secondary">
                Confirm password
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
              />
            </label>

            {error ? <p className="text-sm text-[#ff8f9c]">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting || !token}
              className="w-full rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Set password"}
            </button>
          </form>

          <div className="mt-6 text-sm text-text-secondary">
            Already have access?{" "}
            <Link
              href={getPortalLoginPath(portalExperience)}
              className="text-white underline"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
