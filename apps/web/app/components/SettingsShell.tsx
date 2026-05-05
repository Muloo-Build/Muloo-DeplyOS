"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import AppShell from "./AppShell";

const navItems = [
  { href: "/settings", label: "Overview" },
  { href: "/settings/workspace", label: "Workspace" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/integrations", label: "Integrations" },
  { href: "/settings/ai-integrations", label: "AI Integrations" },
  { href: "/settings/email", label: "Email" },
  { href: "/settings/products", label: "Products" }
];

export default function SettingsShell({
  children,
  title,
  subtitle
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  const pathname = usePathname();

  return (
    <AppShell>
      <div className="flex min-h-screen">
        <aside className="w-[220px] border-r border-ink-4 bg-ink-1 px-3 py-6">
          <p className="px-2 text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
            Settings
          </p>
          <nav className="mt-4 space-y-px">
            {navItems.map((item) => {
              const active =
                item.href === "/settings"
                  ? pathname === "/settings"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-ink-3 text-text-1"
                      : "text-text-2 hover:bg-ink-2 hover:text-text-1"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1 px-8 pt-6 pb-16 max-w-[1480px] w-full">
          <header className="mb-6">
            <p className="text-[11px] uppercase tracking-[0.14em] text-text-3 font-semibold">
              Settings
            </p>
            <h1 className="mt-1.5 text-[26px] font-semibold -tracking-[0.02em] text-text-1">
              {title}
            </h1>
            <p className="mt-1.5 max-w-[640px] text-[13.5px] text-text-3">{subtitle}</p>
          </header>

          <div>{children}</div>
        </div>
      </div>
    </AppShell>
  );
}
