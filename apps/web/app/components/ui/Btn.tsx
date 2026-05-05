import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "ghost" | "primary" | "brand" | "danger" | "plain";
type Size = "sm" | "md" | "lg" | "icon";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variantStyles: Record<Variant, string> = {
  plain: "bg-transparent text-text-1 hover:bg-ink-2 border border-transparent",
  ghost:
    "bg-transparent text-text-2 border border-ink-4 hover:text-text-1 hover:border-ink-5 hover:bg-ink-2",
  primary:
    "bg-status-ok text-[#042822] font-semibold hover:bg-[#5fe7cd] border border-transparent",
  brand:
    "bg-gradient-to-br from-brand-from to-brand-to text-white font-semibold hover:brightness-110 border border-transparent",
  danger:
    "bg-transparent text-status-danger border border-ink-4 hover:bg-ink-2"
};

const sizeStyles: Record<Size, string> = {
  sm: "px-2.5 py-1 text-[12px] rounded-[10px]",
  md: "px-3 py-1.5 text-[12.5px] rounded-[10px]",
  lg: "px-4 py-2 text-[13.5px] rounded-[10px]",
  icon: "p-1.5 rounded-[10px]"
};

export function Btn({
  variant = "plain",
  size = "md",
  className = "",
  children,
  ...rest
}: BtnProps) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-1.5 transition-all whitespace-nowrap font-medium ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </button>
  );
}
