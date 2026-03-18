"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export default function ClientShell({
  children,
  title = "Client Workspace",
  subtitle = "Discovery inputs, documents, and approvals"
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/client-auth/logout", {
      method: "POST",
      credentials: "include"
    });
    router.replace("/client/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background-primary text-white">
      <header className="border-b border-[rgba(255,255,255,0.07)] bg-[#0a0f24]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-text-muted">
              Muloo
            </p>
            <h1 className="mt-2 text-2xl font-bold font-heading gradient-text">
              Deploy OS
            </h1>
            <p className="mt-2 text-sm text-text-secondary">{subtitle}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              href="/client/projects"
              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-white"
            >
              Projects
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-white"
            >
              Sign Out
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
            Client Portal
          </p>
          <h2 className="mt-3 text-3xl font-bold font-heading text-white">
            {title}
          </h2>
        </div>
        {children}
      </main>
    </div>
  );
}
