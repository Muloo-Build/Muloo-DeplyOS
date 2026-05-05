import { prisma } from "./prisma";
import {
  decryptSecret,
  encryptSecret,
  maskSecret
} from "./integrationsCrypto";

const HUBSPOT_DEFAULT_BASE = "https://api.hubapi.com";

function getBaseUrl(override?: string | null): string {
  const explicit = override?.trim() || process.env.HUBSPOT_BASE_URL?.trim();
  if (!explicit) return HUBSPOT_DEFAULT_BASE;
  return explicit.endsWith("/") ? explicit.slice(0, -1) : explicit;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 80) || "client";
}

async function ensureWorkspaceHubSpotPrivateAppSeeded() {
  const existing = await prisma.workspaceHubSpotPrivateApp.count();
  if (existing > 0) return;
  await prisma.workspaceHubSpotPrivateApp.create({ data: { id: "default" } });
}

export interface HubSpotPrivateAppPublic {
  id: string;
  label: string;
  portalId: string | null;
  hubDomain: string | null;
  scopes: string[];
  isEnabled: boolean;
  hasToken: boolean;
  tokenMask: string | null;
  connectedEmail: string | null;
  connectedName: string | null;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  envFallbackAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

function envFallbackToken(): string | null {
  return (
    process.env.HUBSPOT_ACCESS_TOKEN?.trim() ||
    process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim() ||
    null
  );
}

export async function loadHubSpotPrivateApp(): Promise<HubSpotPrivateAppPublic> {
  await ensureWorkspaceHubSpotPrivateAppSeeded();
  const row = await prisma.workspaceHubSpotPrivateApp.findUniqueOrThrow({
    where: { id: "default" }
  });

  let tokenMask: string | null = null;
  let hasToken = false;
  if (row.encryptedToken) {
    try {
      const decrypted = decryptSecret(row.encryptedToken);
      tokenMask = maskSecret(decrypted);
      hasToken = true;
    } catch {
      tokenMask = "(unreadable — re-enter token)";
    }
  }

  return {
    id: row.id,
    label: row.label,
    portalId: row.portalId,
    hubDomain: row.hubDomain,
    scopes: row.scopes,
    isEnabled: row.isEnabled,
    hasToken,
    tokenMask,
    connectedEmail: row.connectedEmail,
    connectedName: row.connectedName,
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
    lastTestStatus: row.lastTestStatus,
    lastTestError: row.lastTestError,
    envFallbackAvailable: Boolean(envFallbackToken()),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function saveHubSpotPrivateApp(input: {
  token?: string | null | undefined;
  portalId?: string | null | undefined;
  hubDomain?: string | null | undefined;
  label?: string | null | undefined;
  scopes?: string[] | undefined;
  isEnabled?: boolean | undefined;
}): Promise<HubSpotPrivateAppPublic> {
  await ensureWorkspaceHubSpotPrivateAppSeeded();

  const updateData: Record<string, unknown> = {};

  if (typeof input.label === "string" && input.label.trim()) {
    updateData.label = input.label.trim();
  }
  if (input.portalId !== undefined) {
    const trimmed =
      typeof input.portalId === "string" ? input.portalId.trim() : "";
    updateData.portalId = trimmed || null;
  }
  if (input.hubDomain !== undefined) {
    const trimmed =
      typeof input.hubDomain === "string" ? input.hubDomain.trim() : "";
    updateData.hubDomain = trimmed || null;
  }
  if (input.token !== undefined) {
    if (input.token === null || input.token === "") {
      updateData.encryptedToken = null;
    } else {
      updateData.encryptedToken = encryptSecret(input.token);
    }
  }
  if (Array.isArray(input.scopes)) {
    updateData.scopes = input.scopes
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof input.isEnabled === "boolean") {
    updateData.isEnabled = input.isEnabled;
  }

  await prisma.workspaceHubSpotPrivateApp.update({
    where: { id: "default" },
    data: updateData
  });

  return loadHubSpotPrivateApp();
}

export async function deleteHubSpotPrivateApp(): Promise<HubSpotPrivateAppPublic> {
  await ensureWorkspaceHubSpotPrivateAppSeeded();
  await prisma.workspaceHubSpotPrivateApp.update({
    where: { id: "default" },
    data: {
      encryptedToken: null,
      portalId: null,
      hubDomain: null,
      scopes: [],
      isEnabled: false,
      connectedEmail: null,
      connectedName: null,
      lastTestedAt: null,
      lastTestStatus: null,
      lastTestError: null
    }
  });
  return loadHubSpotPrivateApp();
}

async function getActiveHubSpotPrivateAppRow() {
  await ensureWorkspaceHubSpotPrivateAppSeeded();
  return prisma.workspaceHubSpotPrivateApp.findUniqueOrThrow({
    where: { id: "default" }
  });
}

async function getActiveHubSpotPrivateAppToken(): Promise<{
  token: string;
  source: "db" | "env";
}> {
  const row = await getActiveHubSpotPrivateAppRow();
  if (row.encryptedToken) {
    return { token: decryptSecret(row.encryptedToken), source: "db" };
  }
  const envToken = envFallbackToken();
  if (envToken) {
    return { token: envToken, source: "env" };
  }
  throw new Error(
    "HubSpot private app is not configured. Save a token in Settings → Integrations → HubSpot."
  );
}

async function hubspotFetch<T>(
  path: string,
  init: RequestInit & { token: string }
): Promise<T> {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${init.token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `HubSpot ${response.status} ${response.statusText}: ${text.slice(0, 400)}`
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

interface HubSpotAccountDetails {
  portalId?: number;
  uiDomain?: string;
  accountType?: string;
  timeZone?: string;
  companyCurrency?: string;
}

export async function testHubSpotPrivateApp(): Promise<HubSpotPrivateAppPublic> {
  await ensureWorkspaceHubSpotPrivateAppSeeded();

  let status = "unknown";
  let error: string | null = null;
  let portalIdFromTest: string | null = null;
  let hubDomainFromTest: string | null = null;

  try {
    const { token } = await getActiveHubSpotPrivateAppToken();
    const details = await hubspotFetch<HubSpotAccountDetails>(
      "/account-info/v3/details",
      { method: "GET", token }
    );
    status = "ok";
    if (details.portalId) portalIdFromTest = String(details.portalId);
    if (details.uiDomain) hubDomainFromTest = details.uiDomain;
  } catch (caught) {
    status = "error";
    error = caught instanceof Error ? caught.message : "Unknown error";
  }

  await prisma.workspaceHubSpotPrivateApp.update({
    where: { id: "default" },
    data: {
      lastTestedAt: new Date(),
      lastTestStatus: status,
      lastTestError: error,
      ...(portalIdFromTest ? { portalId: portalIdFromTest } : {}),
      ...(hubDomainFromTest ? { hubDomain: hubDomainFromTest } : {})
    }
  });

  return loadHubSpotPrivateApp();
}

export interface HubSpotCompanySummary {
  id: string;
  name: string | null;
  domain: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  numberOfEmployees: string | null;
  alreadyImported: boolean;
  importedClientId: string | null;
}

export async function searchHubSpotCompanies(input: {
  query?: string | undefined;
  limit?: number | undefined;
  after?: string | undefined;
}): Promise<{
  companies: HubSpotCompanySummary[];
  paging: { after: string | null };
}> {
  const { token } = await getActiveHubSpotPrivateAppToken();
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const properties = [
    "name",
    "domain",
    "industry",
    "city",
    "country",
    "numberofemployees"
  ];

  const filterGroups = input.query?.trim()
    ? [
        {
          filters: [
            {
              propertyName: "name",
              operator: "CONTAINS_TOKEN",
              value: input.query.trim()
            }
          ]
        },
        {
          filters: [
            {
              propertyName: "domain",
              operator: "CONTAINS_TOKEN",
              value: input.query.trim()
            }
          ]
        }
      ]
    : undefined;

  const body: Record<string, unknown> = {
    limit,
    properties,
    sorts: [{ propertyName: "name", direction: "ASCENDING" }]
  };
  if (filterGroups) body.filterGroups = filterGroups;
  if (input.after) body.after = input.after;

  const response = await hubspotFetch<{
    results: { id: string; properties: Record<string, string | null> }[];
    paging?: { next?: { after?: string } };
  }>("/crm/v3/objects/companies/search", {
    method: "POST",
    token,
    body: JSON.stringify(body)
  });

  const ids = response.results.map((r) => r.id);
  const imported =
    ids.length > 0
      ? await prisma.hubSpotImportedCompany.findMany({
          where: { hubspotCompanyId: { in: ids } },
          select: { hubspotCompanyId: true, clientId: true }
        })
      : [];
  const importedById = new Map(
    imported.map((row) => [row.hubspotCompanyId, row.clientId])
  );

  return {
    companies: response.results.map((r) => ({
      id: r.id,
      name: r.properties.name ?? null,
      domain: r.properties.domain ?? null,
      industry: r.properties.industry ?? null,
      city: r.properties.city ?? null,
      country: r.properties.country ?? null,
      numberOfEmployees: r.properties.numberofemployees ?? null,
      alreadyImported: importedById.has(r.id),
      importedClientId: importedById.get(r.id) ?? null
    })),
    paging: { after: response.paging?.next?.after ?? null }
  };
}

export interface HubSpotContactSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
}

export interface HubSpotDealSummary {
  id: string;
  name: string | null;
  stage: string | null;
  amount: string | null;
  closeDate: string | null;
}

export async function getHubSpotCompanyRelated(input: {
  companyId: string;
  includeContacts: boolean;
  includeDeals: boolean;
}): Promise<{
  contacts: HubSpotContactSummary[];
  deals: HubSpotDealSummary[];
}> {
  const { token } = await getActiveHubSpotPrivateAppToken();

  let contacts: HubSpotContactSummary[] = [];
  let deals: HubSpotDealSummary[] = [];

  if (input.includeContacts) {
    const assoc = await hubspotFetch<{
      results: { id: string }[];
    }>(
      `/crm/v3/objects/companies/${encodeURIComponent(input.companyId)}/associations/contacts?limit=100`,
      { method: "GET", token }
    );
    const contactIds = assoc.results.map((r) => r.id);
    if (contactIds.length > 0) {
      const batch = await hubspotFetch<{
        results: {
          id: string;
          properties: Record<string, string | null>;
        }[];
      }>("/crm/v3/objects/contacts/batch/read", {
        method: "POST",
        token,
        body: JSON.stringify({
          properties: ["firstname", "lastname", "email", "phone", "jobtitle"],
          inputs: contactIds.map((id) => ({ id }))
        })
      });
      contacts = batch.results.map((r) => ({
        id: r.id,
        firstName: r.properties.firstname ?? null,
        lastName: r.properties.lastname ?? null,
        email: r.properties.email ?? null,
        phone: r.properties.phone ?? null,
        jobTitle: r.properties.jobtitle ?? null
      }));
    }
  }

  if (input.includeDeals) {
    const assoc = await hubspotFetch<{
      results: { id: string }[];
    }>(
      `/crm/v3/objects/companies/${encodeURIComponent(input.companyId)}/associations/deals?limit=100`,
      { method: "GET", token }
    );
    const dealIds = assoc.results.map((r) => r.id);
    if (dealIds.length > 0) {
      const batch = await hubspotFetch<{
        results: {
          id: string;
          properties: Record<string, string | null>;
        }[];
      }>("/crm/v3/objects/deals/batch/read", {
        method: "POST",
        token,
        body: JSON.stringify({
          properties: ["dealname", "dealstage", "amount", "closedate"],
          inputs: dealIds.map((id) => ({ id }))
        })
      });
      deals = batch.results.map((r) => ({
        id: r.id,
        name: r.properties.dealname ?? null,
        stage: r.properties.dealstage ?? null,
        amount: r.properties.amount ?? null,
        closeDate: r.properties.closedate ?? null
      }));
    }
  }

  return { contacts, deals };
}

async function generateUniqueClientSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;
  while (
    await prisma.client.findUnique({
      where: { slug: candidate },
      select: { id: true }
    })
  ) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
    if (suffix > 200) {
      candidate = `${base}-${Date.now()}`;
      break;
    }
  }
  return candidate;
}

export interface HubSpotImportResult {
  clientId: string;
  clientName: string;
  clientSlug: string;
  contactCount: number;
  dealCount: number;
  reused: boolean;
}

export async function importHubSpotCompany(input: {
  companyId: string;
  includeContacts: boolean;
  includeDeals: boolean;
  linkExistingClientId?: string | null | undefined;
}): Promise<HubSpotImportResult> {
  const { token } = await getActiveHubSpotPrivateAppToken();

  const company = await hubspotFetch<{
    id: string;
    properties: Record<string, string | null>;
  }>(
    `/crm/v3/objects/companies/${encodeURIComponent(input.companyId)}?properties=name,domain,industry,city,country,website,numberofemployees,description,linkedin_company_page`,
    { method: "GET", token }
  );

  const existingImport = await prisma.hubSpotImportedCompany.findUnique({
    where: { hubspotCompanyId: input.companyId }
  });
  if (existingImport) {
    return {
      clientId: existingImport.clientId,
      clientName: company.properties.name ?? "Unnamed company",
      clientSlug: "",
      contactCount: 0,
      dealCount: 0,
      reused: true
    };
  }

  const name = company.properties.name?.trim() || "Unnamed company";
  const domain = company.properties.domain?.trim() || null;
  const website =
    company.properties.website?.trim() ||
    (domain ? `https://${domain}` : null);
  const industry = company.properties.industry?.trim() || null;
  const region = company.properties.country?.trim() || null;
  const overview = company.properties.description?.trim() || null;
  const linkedinUrl =
    company.properties.linkedin_company_page?.trim() || null;

  let clientId: string;
  let clientSlug: string;
  let reused = false;

  if (input.linkExistingClientId) {
    const existingClient = await prisma.client.findUnique({
      where: { id: input.linkExistingClientId },
      select: { id: true, slug: true }
    });
    if (!existingClient) {
      throw new Error("linkExistingClientId does not match an existing client");
    }
    clientId = existingClient.id;
    clientSlug = existingClient.slug;
    reused = true;
  } else {
    const slug = await generateUniqueClientSlug(name);
    const created = await prisma.client.create({
      data: {
        name,
        slug,
        website,
        industry,
        region,
        companyOverview: overview,
        linkedinUrl
      },
      select: { id: true, slug: true }
    });
    clientId = created.id;
    clientSlug = created.slug;
  }

  await prisma.hubSpotImportedCompany.create({
    data: {
      hubspotCompanyId: input.companyId,
      clientId,
      domain,
      lastSyncedAt: new Date(),
      syncDirection: "hubspot_to_muloo"
    }
  });

  let contactCount = 0;
  let dealCount = 0;

  if (input.includeContacts || input.includeDeals) {
    const related = await getHubSpotCompanyRelated({
      companyId: input.companyId,
      includeContacts: input.includeContacts,
      includeDeals: input.includeDeals
    });

    if (input.includeContacts) {
      for (const contact of related.contacts) {
        if (!contact.email) continue;
        try {
          const updateData: Record<string, unknown> = {};
          if (contact.firstName) updateData.firstName = contact.firstName;
          if (contact.lastName) updateData.lastName = contact.lastName;
          if (contact.phone) updateData.phone = contact.phone;
          if (contact.jobTitle) updateData.title = contact.jobTitle;

          await prisma.clientContact.upsert({
            where: {
              clientId_email: {
                clientId,
                email: contact.email.toLowerCase()
              }
            },
            create: {
              clientId,
              email: contact.email.toLowerCase(),
              firstName: contact.firstName ?? "",
              lastName: contact.lastName,
              phone: contact.phone,
              title: contact.jobTitle
            },
            update: updateData
          });
          contactCount += 1;
        } catch {
          // skip individual contact failures
        }
      }
    }

    if (input.includeDeals) {
      // Deals stored as project ledger only when desired; for now we count.
      dealCount = related.deals.length;
    }
  }

  return {
    clientId,
    clientName: name,
    clientSlug,
    contactCount,
    dealCount,
    reused
  };
}

export async function pushClientToHubSpot(
  clientId: string
): Promise<{ hubspotCompanyId: string; created: boolean }> {
  const { token } = await getActiveHubSpotPrivateAppToken();

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      website: true,
      industry: true,
      region: true,
      linkedinUrl: true,
      companyOverview: true
    }
  });
  if (!client) throw new Error("Client not found");

  const existing = await prisma.hubSpotImportedCompany.findUnique({
    where: { clientId }
  });

  const properties: Record<string, string> = {
    name: client.name
  };
  if (client.website) {
    properties.website = client.website;
    try {
      properties.domain = new URL(client.website).hostname.replace(
        /^www\./,
        ""
      );
    } catch {
      // skip if not a valid URL
    }
  }
  if (client.industry) properties.industry = client.industry;
  if (client.region) properties.country = client.region;
  if (client.linkedinUrl) properties.linkedin_company_page = client.linkedinUrl;
  if (client.companyOverview) properties.description = client.companyOverview;

  if (existing) {
    await hubspotFetch(
      `/crm/v3/objects/companies/${encodeURIComponent(existing.hubspotCompanyId)}`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify({ properties })
      }
    );
    await prisma.hubSpotImportedCompany.update({
      where: { clientId },
      data: { lastSyncedAt: new Date(), syncDirection: "muloo_to_hubspot" }
    });
    return { hubspotCompanyId: existing.hubspotCompanyId, created: false };
  }

  const created = await hubspotFetch<{ id: string }>(
    "/crm/v3/objects/companies",
    {
      method: "POST",
      token,
      body: JSON.stringify({ properties })
    }
  );
  await prisma.hubSpotImportedCompany.create({
    data: {
      hubspotCompanyId: created.id,
      clientId,
      domain: properties.domain ?? null,
      lastSyncedAt: new Date(),
      syncDirection: "muloo_to_hubspot"
    }
  });

  return { hubspotCompanyId: created.id, created: true };
}
