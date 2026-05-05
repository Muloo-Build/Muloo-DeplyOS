import type { ReactNode } from "react";

interface TagProps {
  children: ReactNode;
  className?: string;
}

export function Tag({ children, className = "" }: TagProps) {
  return (
    <span
      className={`inline-flex items-center font-mono text-[10.5px] tracking-[0.04em] uppercase px-1.5 py-0.5 bg-ink-3 border border-ink-4 rounded text-text-2 ${className}`}
    >
      {children}
    </span>
  );
}
