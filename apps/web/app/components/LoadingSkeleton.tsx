/**
 * Loading skeleton primitives. Use these instead of "Loading..." text or a
 * raw spinner. Skeletons should roughly match the shape of the content that
 * will replace them so there's no layout shift when data arrives.
 *
 * Three primitives:
 * - <SkeletonRow />     for list items
 * - <SkeletonBlock />   for cards / panels
 * - <SkeletonText />    for inline text shimmer
 *
 * And one batch helper:
 * - <SkeletonRows count={5} />
 *
 * All use a subtle pulse animation. Background is a single brand-aligned
 * white/5 to read against the dark surfaces.
 */

type RowProps = {
  /** Tailwind height class. Default `h-12`. */
  height?: string;
  /** Tailwind rounding class. Default `rounded-xl`. */
  rounded?: string;
  className?: string;
};

export function SkeletonRow({
  height = "h-12",
  rounded = "rounded-xl",
  className = ""
}: RowProps) {
  return (
    <div
      className={`animate-pulse bg-white/5 ${height} ${rounded} ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

export function SkeletonBlock({
  height = "h-32",
  rounded = "rounded-2xl",
  className = ""
}: RowProps) {
  return (
    <div
      className={`animate-pulse bg-white/5 ${height} ${rounded} ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

type TextProps = {
  /** Tailwind width class. Default `w-32`. */
  width?: string;
  /** Tailwind height class. Default `h-3`. */
  height?: string;
  className?: string;
};

export function SkeletonText({
  width = "w-32",
  height = "h-3",
  className = ""
}: TextProps) {
  return (
    <span
      className={`inline-block animate-pulse rounded bg-white/5 align-middle ${width} ${height} ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

type RowsProps = {
  count?: number;
  height?: string;
  rounded?: string;
  gap?: string;
  className?: string;
};

export function SkeletonRows({
  count = 5,
  height = "h-12",
  rounded = "rounded-xl",
  gap = "gap-2",
  className = ""
}: RowsProps) {
  return (
    <div
      className={`flex flex-col ${gap} ${className}`.trim()}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }, (_, index) => (
        <SkeletonRow key={index} height={height} rounded={rounded} />
      ))}
    </div>
  );
}
