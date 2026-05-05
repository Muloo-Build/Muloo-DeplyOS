import type { ReactNode } from "react";

interface TabItem {
  id: string;
  label: ReactNode;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ items, active, onChange, className = "" }: TabsProps) {
  return (
    <div className={`flex gap-0.5 border-b border-ink-4 mb-5 ${className}`}>
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`px-3.5 py-2.5 text-[13px] cursor-pointer border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
              isActive
                ? "text-text-1 border-status-ok"
                : "text-text-3 border-transparent hover:text-text-2"
            }`}
          >
            {item.label}
            {typeof item.count === "number" && (
              <span
                className={`text-[10.5px] font-mono px-1.5 py-px rounded-lg ${
                  isActive ? "bg-[rgba(74,219,192,0.12)] text-status-ok" : "bg-ink-3 text-text-3"
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface SegOption {
  id: string;
  label: ReactNode;
}

interface SegProps {
  options: SegOption[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Seg({ options, active, onChange, className = "" }: SegProps) {
  return (
    <div
      className={`inline-flex bg-ink-2 border border-ink-4 rounded-[10px] p-0.5 ${className}`}
    >
      {options.map((opt) => {
        const isActive = opt.id === active;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`px-2.5 py-1 text-[12px] rounded transition-colors ${
              isActive ? "bg-ink-3 text-text-1 shadow-elev-sm" : "text-text-3 hover:text-text-1"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
