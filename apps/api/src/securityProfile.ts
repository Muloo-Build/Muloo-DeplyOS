import { prisma } from "./prisma";

// Static checklist definition. Keep here so it's auditable in PRs and so
// new checks can be added without a schema change — findings are stored
// as JSON keyed by check id.

export interface SecurityCheck {
  id: string;
  category: string;
  question: string;
  guidance: string;
  weight: "critical" | "high" | "medium" | "low";
}

export const SECURITY_CHECKLIST: SecurityCheck[] = [
  // HubSpot
  {
    id: "hubspot_2fa_required",
    category: "HubSpot",
    question: "Is two-factor authentication required for all HubSpot users?",
    guidance:
      "Settings → Account Defaults → Security → Require two-factor authentication.",
    weight: "critical"
  },
  {
    id: "hubspot_sso",
    category: "HubSpot",
    question: "Is Single Sign-On configured (Google / Okta / Azure AD)?",
    guidance:
      "Settings → Account Defaults → Security → Single Sign-On. Required for Enterprise tier.",
    weight: "high"
  },
  {
    id: "hubspot_session_timeout",
    category: "HubSpot",
    question: "Is the inactive session timeout set to 30 minutes or less?",
    guidance:
      "Account Defaults → Security → Inactive session timeout.",
    weight: "medium"
  },
  {
    id: "hubspot_least_privilege",
    category: "HubSpot",
    question: "Are roles scoped using least privilege (no super-admins for normal use)?",
    guidance:
      "Settings → Users & Teams → Roles. Reserve Super Admin for break-glass accounts.",
    weight: "high"
  },
  {
    id: "hubspot_audit_log_review",
    category: "HubSpot",
    question: "Is the security audit log reviewed at least monthly?",
    guidance: "Settings → Security → Login history & security activity.",
    weight: "medium"
  },
  {
    id: "hubspot_data_export_restricted",
    category: "HubSpot",
    question: "Is bulk data export restricted to admins only?",
    guidance:
      "Roles → Account → Permission to export contacts/companies/deals.",
    weight: "high"
  },
  {
    id: "hubspot_api_key_inventory",
    category: "HubSpot",
    question: "Are private app tokens rotated and inventoried with owners?",
    guidance:
      "Settings → Integrations → Private apps. Each token should have a named owner and rotation schedule.",
    weight: "high"
  },
  {
    id: "hubspot_sensitive_props_locked",
    category: "HubSpot",
    question: "Are sensitive contact properties protected (PII, ID numbers)?",
    guidance:
      "Use sensitive data property type or restrict via property permissions on the role.",
    weight: "high"
  },

  // Google Workspace
  {
    id: "gsuite_2sv_enforced",
    category: "Google Workspace",
    question: "Is 2-Step Verification enforced on all users?",
    guidance:
      "Admin → Security → Authentication → 2-Step Verification → Enforcement = On.",
    weight: "critical"
  },
  {
    id: "gsuite_advanced_protection",
    category: "Google Workspace",
    question: "Are admin / privileged users on the Advanced Protection Program?",
    guidance:
      "Recommend hardware keys for super admins and finance users.",
    weight: "high"
  },
  {
    id: "gsuite_drive_external_sharing",
    category: "Google Workspace",
    question: "Is external Drive sharing limited to allow-listed domains?",
    guidance:
      "Admin → Apps → Google Workspace → Drive and Docs → Sharing settings.",
    weight: "high"
  },
  {
    id: "gsuite_oauth_app_review",
    category: "Google Workspace",
    question: "Are third-party OAuth apps reviewed and unverified apps blocked?",
    guidance:
      "Admin → Security → API controls → App access control.",
    weight: "high"
  },
  {
    id: "gsuite_dlp_rules",
    category: "Google Workspace",
    question: "Are DLP rules configured for sensitive data (ID numbers, payment data)?",
    guidance:
      "Admin → Security → Data protection. Required for POPIA / GDPR alignment.",
    weight: "medium"
  },
  {
    id: "gsuite_vault_retention",
    category: "Google Workspace",
    question: "Is Google Vault retention configured for email + Drive?",
    guidance:
      "Vault → Retention. Set legal hold and retention periods aligned with the client policy.",
    weight: "medium"
  },

  // Email auth + DNS
  {
    id: "dns_spf_pass",
    category: "Email & DNS",
    question: "Does the primary domain have a passing SPF record?",
    guidance:
      "Verify via mxtoolbox.com or `dig +short txt domain.com`. Hard-fail (-all) recommended.",
    weight: "high"
  },
  {
    id: "dns_dkim_signed",
    category: "Email & DNS",
    question: "Is outbound email DKIM-signed for all sending services?",
    guidance:
      "Includes Google Workspace, HubSpot, transactional providers. Each needs its own selector.",
    weight: "high"
  },
  {
    id: "dns_dmarc_enforced",
    category: "Email & DNS",
    question: "Is DMARC at p=reject (or at least p=quarantine) with rua reporting?",
    guidance:
      "Start at p=none with monitoring, ramp to quarantine then reject once aligned.",
    weight: "high"
  },

  // Compliance
  {
    id: "compliance_jurisdiction_confirmed",
    category: "Compliance",
    question: "Is the data residency jurisdiction confirmed (e.g. ZA / EU / US)?",
    guidance:
      "Drives POPIA / GDPR / CCPA applicability. Document on the client record.",
    weight: "medium"
  },
  {
    id: "compliance_dpa_signed",
    category: "Compliance",
    question: "Is a Data Processing Agreement signed with all sub-processors?",
    guidance:
      "HubSpot, Google, AI providers, hosting. Maintain as agreements in Governance.",
    weight: "high"
  },
  {
    id: "compliance_breach_runbook",
    category: "Compliance",
    question: "Is a documented breach notification runbook in place?",
    guidance:
      "POPIA = 72hr notification. Document who, how, and to whom.",
    weight: "medium"
  },

  // Operational
  {
    id: "ops_offboarding_runbook",
    category: "Operations",
    question: "Is a user-offboarding runbook in place (HubSpot + GSuite + Drive transfer)?",
    guidance:
      "Cover access revocation, transfer of Drive ownership, removal of OAuth tokens.",
    weight: "high"
  },
  {
    id: "ops_admin_count",
    category: "Operations",
    question: "Are there at least 2 super admins, with no shared accounts?",
    guidance:
      "Single admin = key-person risk. Shared accounts violate audit traceability.",
    weight: "medium"
  }
];

export const SECURITY_CATEGORIES = Array.from(
  new Set(SECURITY_CHECKLIST.map((check) => check.category))
);

export type FindingValue = "pass" | "fail" | "na" | "unknown";

interface ProfileRow {
  id: string;
  clientId: string;
  findings: unknown;
  notes: string | null;
  riskLevel: string | null;
  reviewedAt: Date | null;
  reviewedById: string | null;
  nextReviewDue: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function serializeProfile(row: ProfileRow) {
  const findingsObj =
    row.findings && typeof row.findings === "object"
      ? (row.findings as Record<string, FindingValue>)
      : {};

  // Compute summary counts so the UI doesn't have to walk the checklist.
  let pass = 0;
  let fail = 0;
  let na = 0;
  let unknown = 0;
  for (const check of SECURITY_CHECKLIST) {
    const value = findingsObj[check.id] ?? "unknown";
    if (value === "pass") pass += 1;
    else if (value === "fail") fail += 1;
    else if (value === "na") na += 1;
    else unknown += 1;
  }

  // Risk level derived from critical/high failures unless overridden.
  let computedRisk = row.riskLevel ?? null;
  if (!computedRisk) {
    const failedChecks = SECURITY_CHECKLIST.filter(
      (c) => findingsObj[c.id] === "fail"
    );
    const hasCritical = failedChecks.some((c) => c.weight === "critical");
    const hasHigh = failedChecks.some((c) => c.weight === "high");
    if (hasCritical) computedRisk = "critical";
    else if (hasHigh) computedRisk = "high";
    else if (failedChecks.length > 0) computedRisk = "medium";
    else if (unknown > 0) computedRisk = "unknown";
    else computedRisk = "low";
  }

  return {
    id: row.id,
    clientId: row.clientId,
    findings: findingsObj,
    notes: row.notes,
    riskLevel: computedRisk,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedById: row.reviewedById,
    nextReviewDue: row.nextReviewDue?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    counts: { pass, fail, na, unknown, total: SECURITY_CHECKLIST.length }
  };
}

export async function loadClientSecurityProfile(clientId: string) {
  let row = await prisma.clientSecurityProfile.findUnique({
    where: { clientId }
  });
  if (!row) {
    row = await prisma.clientSecurityProfile.create({
      data: { clientId, findings: {} }
    });
  }
  return serializeProfile(row);
}

export async function updateClientSecurityProfile(
  clientId: string,
  input: {
    findings?: Record<string, FindingValue>;
    notes?: string | null;
    riskLevel?: string | null;
    reviewedById?: string | null;
    markReviewedNow?: boolean;
    nextReviewDue?: Date | null;
  }
) {
  const existing = await prisma.clientSecurityProfile.findUnique({
    where: { clientId }
  });

  const data: Record<string, unknown> = {};
  if (input.findings !== undefined) {
    const merged = {
      ...(existing?.findings && typeof existing.findings === "object"
        ? (existing.findings as Record<string, FindingValue>)
        : {}),
      ...input.findings
    };
    data.findings = merged;
  }
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.riskLevel !== undefined) data.riskLevel = input.riskLevel;
  if (input.reviewedById !== undefined) data.reviewedById = input.reviewedById;
  if (input.markReviewedNow) data.reviewedAt = new Date();
  if (input.nextReviewDue !== undefined) data.nextReviewDue = input.nextReviewDue;

  const row = existing
    ? await prisma.clientSecurityProfile.update({
        where: { clientId },
        data
      })
    : await prisma.clientSecurityProfile.create({
        data: {
          clientId,
          findings: input.findings ?? {},
          notes: input.notes ?? null,
          riskLevel: input.riskLevel ?? null,
          reviewedById: input.reviewedById ?? null,
          reviewedAt: input.markReviewedNow ? new Date() : null,
          nextReviewDue: input.nextReviewDue ?? null
        }
      });

  return serializeProfile(row);
}
