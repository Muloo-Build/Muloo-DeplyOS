"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export default function Breadcrumb({
  items,
  helperText
}: {
  items: BreadcrumbItem[];
  helperText?: string;
}) {
  return (
    <div className="space-y-1">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1 text-xs text-text-2"
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <span key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "text-white" : ""}>{item.label}</span>
              )}
              {!isLast ? (
                <ChevronRight size={12} className="text-text-2/50" />
              ) : null}
            </span>
          );
        })}
      </nav>
      {helperText ? (
        <p className="text-xs text-text-2">{helperText}</p>
      ) : null}
    </div>
  );
}
