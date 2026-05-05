import type { ReactNode } from "react";

interface SectionCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}

export function SectionCard({
  title,
  subtitle,
  right,
  children,
  flush = false,
  className = ""
}: SectionCardProps) {
  return (
    <section
      className={`bg-ink-1 border border-ink-4 rounded-[14px] overflow-hidden ${className}`}
    >
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 px-[18px] py-3.5 border-b border-ink-4">
          <div className="min-w-0">
            {title && (
              <h3 className="text-[13px] font-semibold m-0 -tracking-[0.005em] text-text-1">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[11.5px] text-text-3 mt-0.5 m-0">{subtitle}</p>
            )}
          </div>
          {right && <div className="flex items-center gap-1.5">{right}</div>}
        </header>
      )}
      <div className={flush ? "p-0" : "p-[18px]"}>{children}</div>
    </section>
  );
}
