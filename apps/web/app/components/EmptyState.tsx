import Link from "next/link";
import type { ReactNode } from "react";

type EmptyStateAction = {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
};

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  primaryCta?: EmptyStateAction;
  secondaryCta?: EmptyStateAction;
  className?: string;
};

/**
 * Shared empty-state surface. Use anywhere a list, table, or panel renders
 * with no data. Designed to feel calm and considered, not alarmed — the
 * absence of data is not an error condition.
 *
 * Visual contract:
 * - Centred layout
 * - Optional icon at half opacity (32px target)
 * - Headline (white)
 * - Optional one-sentence context (white/60)
 * - Optional primary CTA on brand gradient and/or secondary CTA in the
 *   subtle outline style
 *
 * For inline mini-empties (e.g. inside a card), pass `className` to override
 * default padding.
 */
export default function EmptyState({
  icon,
  title,
  description,
  primaryCta,
  secondaryCta,
  className
}: Props) {
  return (
    <div
      className={
        className ??
        "flex flex-col items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-8 py-14 text-center"
      }
    >
      {icon ? <div className="mb-3 opacity-50">{icon}</div> : null}
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-text-secondary">{description}</p>
      ) : null}
      {(primaryCta || secondaryCta) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {primaryCta ? (
            <Link
              href={primaryCta.href}
              className="rounded-xl bg-muloo-gradient px-4 py-2 text-sm font-medium text-white"
            >
              {primaryCta.label}
            </Link>
          ) : null}
          {secondaryCta ? (
            <Link
              href={secondaryCta.href}
              className="rounded-xl border border-[rgba(255,255,255,0.12)] bg-white/5 px-4 py-2 text-sm font-medium text-white hover:border-[rgba(255,255,255,0.2)]"
            >
              {secondaryCta.label}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
