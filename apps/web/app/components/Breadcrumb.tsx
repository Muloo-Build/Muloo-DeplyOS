import Link from "next/link";
import { Fragment } from "react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

/**
 * Page-level breadcrumb navigation. Use on any page deeper than one level
 * from root to give the user a clear sense of where they are and how to
 * navigate up.
 *
 * Convention:
 *   - All items except the last should have an `href`.
 *   - The last item (current page) has no `href` and is rendered in white.
 *   - Separator is a muted chevron (›).
 *
 * Usage:
 *   <Breadcrumb items={[
 *     { label: "Projects", href: "/projects" },
 *     { label: "Magnisol Phase 1", href: `/projects/${id}` },
 *     { label: "Delivery Board" }
 *   ]} />
 */
export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-5 flex flex-wrap items-center gap-1.5 text-sm"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <Fragment key={item.label}>
            {index > 0 ? (
              <span className="select-none text-text-muted opacity-50">›</span>
            ) : null}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-text-muted transition-colors hover:text-white"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-white" : "text-text-muted"}>
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
