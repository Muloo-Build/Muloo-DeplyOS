import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export type DecisionSeverity = "warn" | "danger" | "info";

interface DecisionProps {
  icon: ReactNode;
  severity?: DecisionSeverity;
  title: ReactNode;
  sub?: ReactNode;
  ctx?: ReactNode[];
  onClick?: () => void;
  className?: string;
}

const iconColor: Record<DecisionSeverity, string> = {
  warn: "text-status-warn",
  danger: "text-status-danger",
  info: "text-status-info"
};

export function Decision({
  icon,
  severity = "warn",
  title,
  sub,
  ctx,
  onClick,
  className = ""
}: DecisionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-ink-1 border border-ink-4 rounded-[14px] p-4 flex items-start gap-3.5 cursor-pointer transition-colors hover:border-ink-5 hover:bg-ink-2 ${className}`}
    >
      <div
        className={`w-8 h-8 rounded-[10px] grid place-items-center bg-ink-3 flex-shrink-0 ${iconColor[severity]}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-text-1 m-0 mb-1">{title}</p>
        {sub && <p className="text-[12px] text-text-3 m-0">{sub}</p>}
        {ctx && ctx.length > 0 && (
          <div className="flex gap-3 mt-2 text-[11.5px] text-text-3 flex-wrap">
            {ctx.map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
        )}
      </div>
      <ChevronRight size={16} className="text-text-3 self-center flex-shrink-0" />
    </button>
  );
}
