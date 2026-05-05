"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import SettingsShell from "./SettingsShell";

const subNav = [
  { href: "/settings/ai-integrations", label: "Overview" },
  { href: "/settings/ai-integrations/providers", label: "Providers" },
  { href: "/settings/ai-integrations/spend", label: "Spend" },
  { href: "/settings/ai-integrations/agents", label: "Agents" },
  { href: "/settings/ai-integrations/routing", label: "Routing" },
  { href: "/settings/ai-integrations/budgets", label: "Budgets" }
];

export default function AIIntegrationsShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <SettingsShell title={title} subtitle={subtitle}>
      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-2">
        <nav className="flex flex-wrap gap-1">
          {subNav.map((item) => {
            const active =
              item.href === "/settings/ai-integrations"
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
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
      </div>
      <div className="mt-5">{children}</div>
    </SettingsShell>
  );
}
