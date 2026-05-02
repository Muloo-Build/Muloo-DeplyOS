// Canonical discovery-question categories. Mirror of
// apps/web/app/components/questionLibraryConstants.ts → CANONICAL_CATEGORIES.
// If you change one, change both. Server holds the validation source of
// truth for `createDiscoveryQuestionLibraryItem`.

export const CANONICAL_DISCOVERY_CATEGORIES = [
  "Business Goals",
  "Current State",
  "CRM and Sales",
  "Marketing",
  "Website and CMS",
  "Service and Support",
  "Reporting",
  "Data and Migration",
  "Integrations",
  "Security and Access",
  "Operations",
  "Handover"
] as const;

export type CanonicalDiscoveryCategory =
  (typeof CANONICAL_DISCOVERY_CATEGORIES)[number];

export function isCanonicalDiscoveryCategory(value: string): boolean {
  return (CANONICAL_DISCOVERY_CATEGORIES as readonly string[]).includes(value);
}
