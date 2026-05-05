"use client";

import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  inputSize?: "sm" | "md";
}

export function SearchInput({
  className = "",
  inputSize = "md",
  placeholder = "Search…",
  ...rest
}: SearchInputProps) {
  const padding = inputSize === "sm" ? "py-1.5 text-[12px]" : "py-2 text-[13px]";
  return (
    <div className={`relative ${className}`}>
      <Search
        size={14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none"
      />
      <input
        {...rest}
        type="search"
        placeholder={placeholder}
        className={`w-full bg-ink-2 border border-ink-4 rounded-[10px] pl-8 pr-3 ${padding} text-text-1 outline-none transition-colors focus:border-[rgba(74,219,192,0.35)] placeholder:text-text-4`}
      />
    </div>
  );
}
