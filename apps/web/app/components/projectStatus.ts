/**
 * Canonical "live project" predicate, web-side mirror.
 *
 * Source of truth lives at `apps/api/src/server.ts` — `isLiveProjectStatus()`
 * and `getLiveProjectCount()`. This file mirrors that definition for the web
 * runtime. Keep both in sync; if you change the semantic here, change there.
 *
 * A project counts as live unless it has been archived. Use a separate named
 * predicate for finer categorisations (e.g. "active" vs "in_delivery") rather
 * than overloading this one.
 */
export function isLiveProjectStatus(status: string) {
  return status !== "archived";
}
