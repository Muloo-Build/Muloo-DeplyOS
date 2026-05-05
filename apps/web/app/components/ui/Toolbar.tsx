import type { ReactNode } from "react";

interface ToolbarProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function Toolbar({ left, right, className = "" }: ToolbarProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 flex-wrap mb-4 ${className}`}
    >
      <div className="flex items-center gap-2 flex-wrap min-w-0">{left}</div>
      {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
    </div>
  );
}
