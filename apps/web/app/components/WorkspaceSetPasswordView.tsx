"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export default function WorkspaceSetPasswordView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("This reset link is missing its token.");
      return;
    }

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
      const response = await fetch("/api/auth/set-password", {
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

      router.replace("/business");
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
    <div className="flex min-h-screen items-center justify-center bg-background-primary px-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-text-muted">
          Business admin
        </p>
        <h1 className="mt-3 text-3xl font-bold font-heading text-white">
          Set your password
        </h1>
        <p className="mt-3 text-text-secondary">
          Choose a new password for the business admin workspace. This secure
          link can only be used once.
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
            disabled={submitting}
            className="w-full rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Set password"}
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
