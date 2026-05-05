import type { ReactNode } from "react";

interface TimelineItemProps {
  who: ReactNode;
  when: ReactNode;
  body?: ReactNode;
  icon?: ReactNode;
}

export function TimelineItem({ who, when, body, icon }: TimelineItemProps) {
  return (
    <div className="grid grid-cols-[28px_1fr] gap-3.5 relative pb-[18px] last:pb-0 [&:not(:last-child)]:before:content-[''] [&:not(:last-child)]:before:absolute [&:not(:last-child)]:before:left-[13px] [&:not(:last-child)]:before:top-[22px] [&:not(:last-child)]:before:bottom-0 [&:not(:last-child)]:before:w-px [&:not(:last-child)]:before:bg-ink-4">
      <div className="w-7 h-7 rounded-full bg-ink-2 border border-ink-4 grid place-items-center text-text-3 z-[1]">
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2 text-[12.5px] flex-wrap">
          <span className="text-text-1 font-medium">{who}</span>
          <span className="text-text-3 text-[11.5px] ml-auto font-mono">{when}</span>
        </div>
        {body && <div className="text-[12.5px] text-text-2 mt-1">{body}</div>}
      </div>
    </div>
  );
}

interface TimelineProps {
  children: ReactNode;
  className?: string;
}

export function Timeline({ children, className = "" }: TimelineProps) {
  return <div className={`flex flex-col gap-0 ${className}`}>{children}</div>;
}
