"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard } from "lucide-react";

const navItems = [
  {
    href: "/workspace",
    label: "Command Centre",
    shortLabel: "CC",
    icon: <LayoutDashboard size={18} />
  },
  { href: "/", label: "Projects", shortLabel: "P" },
  {
    href: "/projects/portal-ops",
    label: "Portal Ops",
    shortLabel: "PO",
    indent: true
  },
  { href: "/clients", label: "Clients", shortLabel: "C" },
  { href: "/inbox", label: "Inbox", shortLabel: "I" },
  { href: "/templates", label: "Templates", shortLabel: "T" },
  { href: "/runs", label: "Runs", shortLabel: "R" },
  { href: "/agents", label: "Agents", shortLabel: "A" },
  { href: "/settings", label: "Settings", shortLabel: "S" }
];

function isProjectsRoute(pathname: string): boolean {
  if (pathname.startsWith("/projects/portal-ops")) {
    return false;
  }

  return (
    pathname === "/" ||
    pathname.startsWith("/blueprint") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/project")
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [inboxCount, setInboxCount] = useState(0);

  useEffect(() => {
    async function loadSummary() {
      try {
        const response = await fetch("/api/inbox/summary");

        if (!response.ok) {
          return;
        }

        const body = await response.json();
        setInboxCount(body.summary?.total ?? 0);
      } catch {
        // Ignore nav badge failures.
      }
    }

    void loadSummary();
  }, [pathname]);

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-sidebar flex-col border-r border-[rgba(255,255,255,0.07)] bg-[#0a0f24]">
      <div className="border-b border-[rgba(255,255,255,0.07)] px-6 py-5">
        <img src="/muloo-logo.svg" alt="Muloo" className="h-10 w-auto" />
        <p className="mt-3 text-sm font-medium text-text-secondary">
          Deploy OS
        </p>
      </div>

      <nav className="flex-1 px-3 py-6">
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? isProjectsRoute(pathname)
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative mb-2 flex h-12 items-center gap-3 rounded-xl px-3 transition-colors ${
                active
                  ? "bg-[#141d3d] text-white"
                  : "text-text-secondary hover:bg-[#141d3d] hover:text-white"
              } ${"indent" in item && item.indent ? "ml-3" : ""}`}
            >
              {active ? (
                <span className="absolute left-0 top-2 h-8 w-1 rounded-r bg-[linear-gradient(180deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)]" />
              ) : null}
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-xs font-semibold text-white">
                {"icon" in item && item.icon ? item.icon : item.shortLabel}
              </span>
              <span className="font-medium">{item.label}</span>
              {item.href === "/inbox" && inboxCount > 0 ? (
                <span className="ml-auto flex min-w-6 items-center justify-center rounded-full bg-[rgba(224,80,96,0.9)] px-2 py-1 text-[10px] font-semibold text-white">
                  {inboxCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[rgba(255,255,255,0.07)] px-6 py-4">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
          Internal delivery workspace
        </p>
      </div>
    </aside>
  );
}
