interface BarProps {
  value: number;
  max?: number;
  tone?: "ok" | "warn" | "danger";
  className?: string;
}

export function Bar({ value, max = 100, tone = "ok", className = "" }: BarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fillTone = {
    ok: "bg-status-ok",
    warn: "bg-status-warn",
    danger: "bg-status-danger"
  }[tone];

  return (
    <div className={`h-1.5 bg-ink-3 rounded relative overflow-hidden ${className}`}>
      <div
        className={`h-full rounded ${fillTone}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
