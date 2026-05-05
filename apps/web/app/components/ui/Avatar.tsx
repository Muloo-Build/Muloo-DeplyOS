import type { ReactNode } from "react";

interface AvatarProps {
  initials?: string;
  size?: "sm" | "md" | "lg";
  brand?: boolean;
  children?: ReactNode;
  className?: string;
}

export function Avatar({
  initials,
  size = "md",
  brand = false,
  children,
  className = ""
}: AvatarProps) {
  const sizes = {
    sm: "w-[22px] h-[22px] text-[9.5px]",
    md: "w-7 h-7 text-[10.5px]",
    lg: "w-10 h-10 text-[13px]"
  }[size];

  const bg = brand ? "bg-brand-grad text-white" : "bg-ink-3 text-text-1";

  return (
    <span
      className={`inline-grid place-items-center rounded-full font-semibold flex-shrink-0 tracking-[0.02em] ${sizes} ${bg} ${className}`}
    >
      {children ?? initials?.slice(0, 2).toUpperCase()}
    </span>
  );
}
