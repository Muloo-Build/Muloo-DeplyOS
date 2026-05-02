export const CANONICAL_CATEGORIES = [
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

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

export const ANSWER_TYPES: { value: string; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "yes_no", label: "Yes / no" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "file_upload", label: "File upload" },
  { value: "link", label: "Link / URL" }
];

export const STAKEHOLDER_TYPES: { value: string; label: string }[] = [
  { value: "client_champion", label: "Client champion" },
  { value: "marketing_lead", label: "Marketing lead" },
  { value: "sales_lead", label: "Sales lead" },
  { value: "service_lead", label: "Service lead" },
  { value: "operations_lead", label: "Operations lead" },
  { value: "tech_lead", label: "Tech / IT lead" },
  { value: "data_lead", label: "Data / analytics lead" },
  { value: "executive_sponsor", label: "Executive sponsor" },
  { value: "external_agency", label: "External agency / partner" }
];

export const HUBSPOT_AREAS: { value: string; label: string }[] = [
  { value: "marketing_hub", label: "Marketing Hub" },
  { value: "sales_hub", label: "Sales Hub" },
  { value: "service_hub", label: "Service Hub" },
  { value: "content_hub", label: "Content Hub (CMS)" },
  { value: "operations_hub", label: "Operations Hub" },
  { value: "commerce_hub", label: "Commerce Hub" },
  { value: "data_management", label: "Data management" },
  { value: "integrations", label: "Integrations" },
  { value: "reporting", label: "Reporting & analytics" },
  { value: "permissions", label: "Permissions & access" }
];

export const COMPLEXITY_LEVELS: { value: string; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "advanced", label: "Advanced" },
  { value: "specialist", label: "Specialist" }
];

export function isCanonicalCategory(value: string): boolean {
  return (CANONICAL_CATEGORIES as readonly string[]).includes(value);
}

export function categorySuggestionFor(value: string): string | null {
  const lower = value.toLowerCase();
  if (
    lower.includes("hosting") ||
    lower.includes("dns") ||
    lower.includes("tech stack") ||
    lower.includes("technology") ||
    lower.includes("platform")
  ) {
    return "Integrations";
  }
  if (
    lower.includes("access") ||
    lower.includes("permission") ||
    lower.includes("security") ||
    lower.includes("compliance") ||
    lower.includes("gdpr")
  ) {
    return "Security and Access";
  }
  if (
    lower.includes("cost") ||
    lower.includes("budget") ||
    lower.includes("billing") ||
    lower.includes("pricing")
  ) {
    return "Operations";
  }
  if (
    lower.includes("integration") ||
    lower.includes("api") ||
    lower.includes("webhook")
  ) {
    return "Integrations";
  }
  if (
    lower.includes("data") ||
    lower.includes("migration") ||
    lower.includes("import")
  ) {
    return "Data and Migration";
  }
  return null;
}
