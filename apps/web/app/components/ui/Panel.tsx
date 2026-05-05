import type { ReactNode } from "react";

interface PanelProps {
  children: ReactNode;
  className?: string;
}

export function Panel({ children, className = "" }: PanelProps) {
  return (
    <div
      className={`bg-ink-1 border border-ink-4 rounded-[14px] overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

interface PanelHeadProps {
  title?: ReactNode;
  label?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PanelHead({ title, label, right, children, className = "" }: PanelHeadProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-[18px] py-3.5 border-b border-ink-4 ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {label && (
          <span className="text-[10px] tracking-[0.14em] uppercase text-text-3 font-semibold">
            {label}
          </span>
        )}
        {title && (
          <h3 className="text-[13px] font-semibold m-0 -tracking-[0.005em]">{title}</h3>
        )}
        {children}
      </div>
      {right && <div className="flex items-center gap-1.5">{right}</div>}
    </div>
  );
}

interface PanelBodyProps {
  children: ReactNode;
  flush?: boolean;
  className?: string;
}

export function PanelBody({ children, flush = false, className = "" }: PanelBodyProps) {
  return (
    <div className={`${flush ? "p-0" : "p-[18px]"} ${className}`}>{children}</div>
  );
}
