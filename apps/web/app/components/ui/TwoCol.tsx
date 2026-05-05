import type { ReactNode } from "react";

interface TwoColProps {
  left: ReactNode;
  right: ReactNode;
  rightWidth?: 260 | 280 | 320 | 360;
  gap?: number;
  stickyRight?: boolean;
  className?: string;
}

export function TwoCol({
  left,
  right,
  rightWidth = 320,
  gap = 24,
  stickyRight = true,
  className = ""
}: TwoColProps) {
  const gridCols = `minmax(0,1fr)_${rightWidth}px`;
  return (
    <div
      className={`grid grid-cols-1 lg:grid-cols-[${gridCols}] items-start ${className}`}
      style={{ gap: `${gap}px` }}
    >
      <div className="min-w-0">{left}</div>
      <aside
        className={`flex flex-col gap-3.5 ${
          stickyRight ? "lg:sticky lg:top-[80px] self-start" : ""
        }`}
      >
        {right}
      </aside>
    </div>
  );
}
