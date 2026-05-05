import type { ReactNode } from "react";

interface SectionHeadProps {
  title: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function SectionHead({ title, right, className = "" }: SectionHeadProps) {
  return (
    <div className={`flex items-baseline justify-between mb-3 ${className}`}>
      <h2 className="text-[16px] font-semibold -tracking-[0.01em] m-0 text-text-1">
        {title}
      </h2>
      {right && <div className="flex gap-1.5 items-center">{right}</div>}
    </div>
  );
}
