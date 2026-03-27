"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  type PortalExperience,
  getPortalInboxPath,
  getPortalLoginPath,
  getPortalProjectsPath,
  getPortalRequestWorkPath,
  getPortalSupportPath,
  resolvePortalExperienceFromPathname
} from "./portalExperience";

export default function ClientShell({
  children,
  portalExperience,
  title: _title,
  subtitle: _subtitle
}: {
  children: ReactNode;
  portalExperience?: PortalExperience;
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [inboxCount, setInboxCount] = useState(0);
  const resolvedPortalExperience =
    portalExperience ?? resolvePortalExperienceFromPathname(pathname);
  const projectsPath = getPortalProjectsPath(resolvedPortalExperience);
  const loginPath = getPortalLoginPath(resolvedPortalExperience);

  useEffect(() => {
    async function loadSummary() {
      try {
        const response = await fetch("/api/client/inbox/summary", {
          credentials: "include"
        });
        if (!response.ok) return;
        const body = await response.json();
        setInboxCount(body.summary?.total ?? 0);
      } catch {
      }
    }
    void loadSummary();
  }, []);

  async function handleLogout() {
    await fetch("/api/client-auth/logout", {
      method: "POST",
      credentials: "include"
    });
    router.replace(loginPath);
    router.refresh();
  }

  const navItems = [
    { href: projectsPath, label: "Projects" },
    {
      href: getPortalInboxPath(resolvedPortalExperience),
      label: "Inbox",
      badge: inboxCount
    },
    { href: getPortalSupportPath(resolvedPortalExperience), label: "Support" },
    {
      href: getPortalRequestWorkPath(resolvedPortalExperience),
      label: "Request Work"
    }
  ];

  return (
    <div className="min-h-screen bg-background-primary text-white">
      <header className="border-b border-[rgba(255,255,255,0.06)] bg-[#060c1e]">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-8 px-6 py-4">
          <Link href={projectsPath} className="flex items-center gap-3 flex-shrink-0">
            <img src="/muloo-logo.svg" alt="Muloo" className="h-8 w-auto" />
          </Link>

          <nav className="flex flex-1 items-center gap-1 text-sm">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-2 rounded-xl px-4 py-2 font-medium transition-colors ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-text-secondary hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                  {item.badge && item.badge > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[rgba(224,80,96,0.9)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex-shrink-0 text-sm text-text-muted hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
