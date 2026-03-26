"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextError = new URLSearchParams(window.location.search).get("error");
    setOauthError(nextError);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          username: username.trim(),
          password
        })
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Login failed");
      }

      router.replace("/");
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
    <div className="flex min-h-screen items-center justify-center bg-background-primary px-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-text-muted">
          Muloo
        </p>
        <h1 className="mt-3 text-3xl font-bold font-heading gradient-text">
          Deploy OS
        </h1>
        <p className="mt-3 text-text-secondary">
          Sign in with your workspace email or username and password.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm text-text-secondary">
              Email or username
            </span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="jarrud@muloo.co or muloo-operator"
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

          {error || oauthError ? (
            <p className="text-sm text-[#ff8f9c]">{error ?? oauthError}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>

          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
            <span className="text-xs uppercase tracking-[0.24em] text-text-muted">
              or
            </span>
            <div className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
          </div>

          <a
            href="/api/auth/google/start"
            className="flex w-full items-center justify-center rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#11182f] px-5 py-3 text-sm font-semibold text-white transition hover:border-[rgba(255,255,255,0.22)] hover:bg-[#17203d]"
          >
            Continue with Google
          </a>
        </form>
      </div>
    </div>
  );
}
