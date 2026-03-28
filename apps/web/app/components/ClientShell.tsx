"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  type PortalExperience,
  getPortalLabel,
  getPortalInboxPath,
  getPortalInvoicesPath,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const resolvedPortalExperience =
    portalExperience ?? resolvePortalExperienceFromPathname(pathname);
  const projectsPath = getPortalProjectsPath(resolvedPortalExperience);
  const loginPath = getPortalLoginPath(resolvedPortalExperience);
  const portalLabel = getPortalLabel(resolvedPortalExperience);

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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
    {
      href: getPortalInvoicesPath(resolvedPortalExperience),
      label: "Invoices"
    },
    { href: getPortalSupportPath(resolvedPortalExperience), label: "Support" },
    {
      href: getPortalRequestWorkPath(resolvedPortalExperience),
      label: "Request Work"
    }
  ];

  return (
    <div className="min-h-screen overflow-x-clip bg-background-primary text-white">
      <header className="border-b border-[rgba(255,255,255,0.06)] bg-[#060c1e]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href={projectsPath} className="flex flex-shrink-0 items-center gap-3">
            <img src="/muloo-logo.svg" alt="Muloo" className="h-7 w-auto sm:h-8" />
            <div className="hidden sm:block">
              <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
                {portalLabel} portal
              </p>
            </div>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 text-sm md:flex">
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
            className="hidden flex-shrink-0 text-sm text-text-muted transition-colors hover:text-white md:block"
          >
            Sign out
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.08)] bg-white/5 text-sm text-white transition hover:bg-white/10 md:hidden"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? "×" : "☰"}
          </button>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-[rgba(4,8,18,0.72)] backdrop-blur-sm md:hidden">
          <div className="absolute inset-x-0 top-0 border-b border-[rgba(255,255,255,0.06)] bg-[#081127] px-4 pb-5 pt-20 shadow-2xl">
            <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
              {portalLabel} portal
            </p>
            <nav className="mt-5 space-y-2">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      isActive
                        ? "bg-white/12 text-white"
                        : "bg-white/4 text-text-secondary hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badge && item.badge > 0 ? (
                      <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[rgba(224,80,96,0.9)] px-2 py-0.5 text-[10px] font-semibold text-white">
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
              className="mt-5 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-7xl overflow-x-clip px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-8">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[rgba(255,255,255,0.08)] bg-[#081127]/95 px-2 py-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-5 gap-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[56px] flex-col items-center justify-center rounded-2xl px-2 py-2 text-center text-[11px] font-medium transition ${
                  isActive
                    ? "bg-white/12 text-white"
                    : "text-text-secondary hover:bg-white/8 hover:text-white"
                }`}
              >
                <span>{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="mt-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[rgba(224,80,96,0.9)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
