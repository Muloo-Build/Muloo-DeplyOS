"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ClientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/client-auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password
        })
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Login failed");
      }

      router.replace("/client/projects");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Login failed"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background-primary px-6 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center py-10">
        <div className="grid w-full items-stretch gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="hidden rounded-[32px] border border-[rgba(255,255,255,0.07)] bg-[radial-gradient(circle_at_top_left,rgba(124,92,191,0.28),transparent_38%),linear-gradient(180deg,#0f1735_0%,#0a0f24_100%)] p-10 lg:flex lg:flex-col lg:justify-between">
            <div>
              <img src="/muloo-logo.svg" alt="Muloo" className="h-12 w-auto" />
              <p className="mt-8 text-xs uppercase tracking-[0.35em] text-text-muted">
                Client Portal
              </p>
              <h1 className="mt-5 max-w-[13ch] text-5xl font-bold font-heading leading-[0.92] text-white xl:max-w-[14ch]">
                Project visibility, documents, and approvals.
              </h1>
              <p className="mt-8 max-w-[36rem] text-base leading-8 text-text-secondary">
                Access your Muloo project workspace to review scope, delivery progress, supporting documents, and any forms we specifically assign to your team.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {[
                ["Review docs", "Discovery documents, quotes, and approved scope in one place."],
                ["Track delivery", "See the current board and what is waiting on Muloo or your team."],
                ["Respond only when needed", "Forms appear only when Muloo requests a specific client input."]
              ].map(([title, copy]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-5"
                >
                  <p className="text-base font-semibold text-white">{title}</p>
                  <p className="mt-3 text-sm leading-7 text-text-secondary">
                    {copy}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className="w-full rounded-3xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
            <img src="/muloo-logo.svg" alt="Muloo" className="h-10 w-auto lg:hidden" />
            <p className="mt-4 text-sm uppercase tracking-[0.3em] text-text-muted">
              Client sign in
            </p>
            <h1 className="mt-3 text-3xl font-bold font-heading text-white">
              Welcome to your Muloo project portal
            </h1>
            <p className="mt-3 text-text-secondary">
              Sign in to review your projects, check delivery status, and complete any forms that have been assigned to you.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm text-text-secondary">
                  Email
                </span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-text-secondary">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                />
              </label>

              <div className="-mt-1 flex justify-end">
                <a
                  href="/client/forgot-password"
                  className="text-sm text-text-secondary underline-offset-4 hover:text-white hover:underline"
                >
                  Forgot password?
                </a>
              </div>

              {error ? <p className="text-sm text-[#ff8f9c]">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
