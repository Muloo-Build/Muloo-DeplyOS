import type { ReactNode } from "react";

export type HealthTone = "ok" | "warn" | "danger" | "muted";

interface HealthCellProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: HealthTone;
  onClick?: () => void;
}

const dotTone: Record<HealthTone, string> = {
  ok: "bg-status-ok",
  warn: "bg-status-warn",
  danger: "bg-status-danger",
  muted: "bg-text-4"
};

export function HealthCell({ label, value, sub, tone = "ok", onClick }: HealthCellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-ink-1 px-4 py-3.5 transition-colors hover:bg-ink-2 disabled:cursor-default"
      disabled={!onClick}
    >
      <div className="text-[10.5px] tracking-[0.12em] uppercase text-text-3 font-semibold flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dotTone[tone]}`} />
        {label}
      </div>
      <div className="text-[18px] font-semibold -tracking-[0.01em] mt-1">{value}</div>
      {sub && <div className="text-[11.5px] text-text-3 mt-0.5">{sub}</div>}
    </button>
  );
}

interface HealthStripProps {
  children: ReactNode;
  className?: string;
}

export function HealthStrip({ children, className = "" }: HealthStripProps) {
  return (
    <div
      className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px bg-ink-4 border border-ink-4 rounded-[14px] overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}
