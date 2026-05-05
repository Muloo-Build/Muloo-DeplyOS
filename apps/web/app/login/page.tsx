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
    <div className="flex min-h-screen items-center justify-center bg-ink-0 px-6 text-text-1">
      <div className="w-full max-w-[420px] bg-ink-1 border border-ink-4 rounded-[14px] p-7">
        <div className="flex flex-col items-start mb-6">
          <span className="brand-wordmark text-[26px] font-bold leading-none -tracking-[0.02em]">
            muloo
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold mt-1">
            Deploy OS
          </span>
        </div>
        <h1 className="text-[20px] font-semibold m-0 -tracking-[0.01em] text-text-1">
          Sign in
        </h1>
        <p className="mt-1.5 text-[13px] text-text-3">
          Workspace email or username + password.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] tracking-[0.08em] uppercase text-text-3 font-semibold">
              Email or username
            </span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="you@muloo.co"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className="w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none transition-colors focus:border-[rgba(74,219,192,0.35)] placeholder:text-text-4"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] tracking-[0.08em] uppercase text-text-3 font-semibold">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none transition-colors focus:border-[rgba(74,219,192,0.35)]"
            />
          </label>

          {error || oauthError ? (
            <p className="text-[12.5px] text-status-danger">{error ?? oauthError}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-[10px] text-[13px] font-semibold bg-status-ok text-[#042822] hover:bg-[#5fe7cd] border border-transparent transition-colors disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-ink-4" />
            <span className="text-[10px] uppercase tracking-[0.14em] text-text-4 font-semibold">
              or
            </span>
            <div className="h-px flex-1 bg-ink-4" />
          </div>

          <a
            href="/api/auth/google/start"
            className="flex w-full items-center justify-center gap-1.5 px-4 py-2 rounded-[10px] text-[13px] font-medium text-text-1 border border-ink-4 hover:border-ink-5 hover:bg-ink-2 transition-colors"
          >
            Continue with Google
          </a>
        </form>
      </div>
    </div>
  );
}
