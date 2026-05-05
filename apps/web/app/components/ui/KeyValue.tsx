import type { ReactNode } from "react";

interface KeyValueProps {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}

export function KeyValue({ label, value, mono = false, className = "" }: KeyValueProps) {
  return (
    <div className={className}>
      <div className="text-[10px] tracking-[0.14em] uppercase text-text-3 font-semibold">
        {label}
      </div>
      <div
        className={`text-[12.5px] text-text-2 mt-0.5 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
