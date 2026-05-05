import type { ReactNode } from "react";

export type PillTone = "neutral" | "ok" | "warn" | "danger" | "info";

const toneStyles: Record<PillTone, string> = {
  neutral: "bg-ink-3 text-text-2",
  ok: "bg-[rgba(74,219,192,0.12)] text-status-ok",
  warn: "bg-[rgba(255,180,84,0.12)] text-status-warn",
  danger: "bg-[rgba(255,107,122,0.12)] text-status-danger",
  info: "bg-[rgba(110,168,254,0.12)] text-status-info"
};

interface PillProps {
  tone?: PillTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export function Pill({ tone = "neutral", dot = false, children, className = "" }: PillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${toneStyles[tone]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
