import type { ReactNode } from "react";

interface FilterChipProps {
  active?: boolean;
  count?: number;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

export function FilterChip({
  active = false,
  count,
  onClick,
  children,
  className = ""
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] rounded-full border transition-colors ${
        active
          ? "bg-[rgba(74,219,192,0.12)] text-status-ok border-[rgba(74,219,192,0.35)]"
          : "bg-ink-2 text-text-2 border-ink-4 hover:text-text-1 hover:border-ink-5"
      } ${className}`}
    >
      {children}
      {typeof count === "number" && (
        <span
          className={`font-mono text-[10.5px] ${
            active ? "text-status-ok" : "text-text-3"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
