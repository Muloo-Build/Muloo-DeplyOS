import type { ReactNode } from "react";

interface EmptyProps {
  icon?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Empty({ icon, title, sub, action, className = "" }: EmptyProps) {
  return (
    <div className={`text-center py-12 px-6 text-text-3 ${className}`}>
      {icon && (
        <div className="inline-flex w-12 h-12 rounded-full bg-ink-2 items-center justify-center mb-3.5 text-text-3">
          {icon}
        </div>
      )}
      <div className="text-text-1 font-semibold text-[14px] mb-1">{title}</div>
      {sub && (
        <div className="text-[12.5px] max-w-[320px] mx-auto">{sub}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
