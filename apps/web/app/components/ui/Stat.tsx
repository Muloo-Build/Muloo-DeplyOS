import type { ReactNode } from "react";

interface StatProps {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  deltaTone?: "up" | "down" | "neutral";
  className?: string;
}

export function Stat({ label, value, delta, deltaTone = "neutral", className = "" }: StatProps) {
  const deltaColor =
    deltaTone === "up"
      ? "text-status-ok"
      : deltaTone === "down"
        ? "text-status-danger"
        : "text-text-3";

  return (
    <div
      className={`bg-ink-1 border border-ink-4 rounded-[14px] p-4 flex flex-col gap-1.5 ${className}`}
    >
      <span className="text-[10.5px] tracking-[0.12em] uppercase text-text-3 font-semibold">
        {label}
      </span>
      <span className="text-[26px] font-semibold -tracking-[0.02em] tnum">{value}</span>
      {delta && (
        <span className={`text-[11.5px] flex items-center gap-1 ${deltaColor}`}>
          {delta}
        </span>
      )}
    </div>
  );
}

interface StatsGridProps {
  cols?: 2 | 3 | 4 | 5;
  children: ReactNode;
  className?: string;
}

export function StatsGrid({ cols = 4, children, className = "" }: StatsGridProps) {
  const colsClass = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-5"
  }[cols];
  return <div className={`grid gap-3 ${colsClass} ${className}`}>{children}</div>;
}
