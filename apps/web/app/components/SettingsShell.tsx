"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import AppShell from "./AppShell";

const navItems = [
  { href: "/settings", label: "Overview" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/providers", label: "Providers" },
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
        <aside className="w-[240px] border-r border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-8">
          <p className="px-3 text-sm uppercase tracking-[0.25em] text-text-muted">
            Settings
          </p>
          <nav className="mt-6 space-y-2">
            {navItems.map((item) => {
              const active =
                item.href === "/settings"
                  ? pathname === "/settings"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#141d3d] text-white"
                      : "text-text-secondary hover:bg-[#141d3d] hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1 p-8">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
            <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
              Settings
            </p>
            <h1 className="mt-3 text-3xl font-bold font-heading text-white">
              {title}
            </h1>
            <p className="mt-3 max-w-3xl text-text-secondary">{subtitle}</p>
          </div>

          <div className="mt-6">{children}</div>
        </div>
      </div>
    </AppShell>
  );
}
