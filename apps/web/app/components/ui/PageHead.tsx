import type { ReactNode } from "react";

interface PageHeadProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHead({ eyebrow, title, lede, actions, className = "" }: PageHeadProps) {
  return (
    <header
      className={`flex items-end justify-between gap-6 mb-6 flex-wrap ${className}`}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] tracking-[0.14em] uppercase text-text-3 font-semibold mb-1.5">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[26px] font-semibold -tracking-[0.02em] m-0 mb-1.5 text-text-1">
          {title}
        </h1>
        {lede && (
          <p className="text-[13.5px] text-text-3 max-w-[640px] m-0">{lede}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}
