import { prisma } from "./prisma";

export const AGREEMENT_TYPES = [
  "nda",
  "msa",
  "dpa",
  "quote_signed",
  "other"
] as const;

export type AgreementType = (typeof AGREEMENT_TYPES)[number];

export const AGREEMENT_STATUSES = [
  "draft",
  "sent",
  "signed",
  "withdrawn",
  "expired"
] as const;

export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

interface AgreementRow {
  id: string;
  clientId: string;
  type: string;
  title: string;
  status: string;
  documentUrl: string | null;
  documentBody: string | null;
  effectiveDate: Date | null;
  expiresAt: Date | null;
  notes: string | null;
  sentAt: Date | null;
  signedAt: Date | null;
  signerName: string | null;
  signerEmail: string | null;
  signerTitle: string | null;
  signerIp: string | null;
  signerUserAgent: string | null;
  acceptanceText: string | null;
  withdrawnAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function serializeAgreement(row: AgreementRow) {
  return {
    id: row.id,
    clientId: row.clientId,
    type: row.type,
    title: row.title,
    status: row.status,
    documentUrl: row.documentUrl,
    documentBody: row.documentBody,
    effectiveDate: row.effectiveDate?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    notes: row.notes,
    sentAt: row.sentAt?.toISOString() ?? null,
    signedAt: row.signedAt?.toISOString() ?? null,
    signerName: row.signerName,
    signerEmail: row.signerEmail,
    signerTitle: row.signerTitle,
    signerIp: row.signerIp,
    signerUserAgent: row.signerUserAgent,
    acceptanceText: row.acceptanceText,
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function listClientAgreements(clientId: string) {
  const rows = await prisma.clientAgreement.findMany({
    where: { clientId },
    orderBy: [{ createdAt: "desc" }]
  });
  return rows.map(serializeAgreement);
}

export async function getClientAgreement(id: string) {
  const row = await prisma.clientAgreement.findUnique({ where: { id } });
  return row ? serializeAgreement(row) : null;
}

export async function createClientAgreement(input: {
  clientId: string;
  type: string;
  title: string;
  documentUrl?: string | null;
  documentBody?: string | null;
  effectiveDate?: Date | null;
  expiresAt?: Date | null;
  notes?: string | null;
  acceptanceText?: string | null;
  status?: AgreementStatus;
}) {
  const type = (AGREEMENT_TYPES as readonly string[]).includes(input.type)
    ? (input.type as AgreementType)
    : "other";
  const created = await prisma.clientAgreement.create({
    data: {
      clientId: input.clientId,
      type,
      title: input.title.trim(),
      status: input.status ?? "draft",
      documentUrl: input.documentUrl ?? null,
      documentBody: input.documentBody ?? null,
      effectiveDate: input.effectiveDate ?? null,
      expiresAt: input.expiresAt ?? null,
      notes: input.notes ?? null,
      acceptanceText:
        input.acceptanceText ??
        "By signing below I confirm I have authority to bind the named party to the terms in this document. This electronic signature is captured with my name, email, IP address and timestamp."
    }
  });
  return serializeAgreement(created);
}

export async function updateClientAgreement(
  id: string,
  input: {
    title?: string;
    type?: string;
    status?: AgreementStatus;
    documentUrl?: string | null;
    documentBody?: string | null;
    effectiveDate?: Date | null;
    expiresAt?: Date | null;
    notes?: string | null;
    acceptanceText?: string | null;
  }
) {
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.type !== undefined) {
    data.type = (AGREEMENT_TYPES as readonly string[]).includes(input.type)
      ? input.type
      : "other";
  }
  if (input.status !== undefined) data.status = input.status;
  if (input.documentUrl !== undefined) data.documentUrl = input.documentUrl;
  if (input.documentBody !== undefined) data.documentBody = input.documentBody;
  if (input.effectiveDate !== undefined) data.effectiveDate = input.effectiveDate;
  if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.acceptanceText !== undefined) data.acceptanceText = input.acceptanceText;

  const updated = await prisma.clientAgreement.update({
    where: { id },
    data
  });
  return serializeAgreement(updated);
}

export async function sendClientAgreement(id: string) {
  const updated = await prisma.clientAgreement.update({
    where: { id },
    data: { status: "sent", sentAt: new Date() }
  });
  return serializeAgreement(updated);
}

export async function withdrawClientAgreement(id: string) {
  const updated = await prisma.clientAgreement.update({
    where: { id },
    data: { status: "withdrawn", withdrawnAt: new Date() }
  });
  return serializeAgreement(updated);
}

export async function signClientAgreement(input: {
  agreementId: string;
  signerName: string;
  signerEmail: string;
  signerTitle?: string | null;
  signerIp?: string | null;
  signerUserAgent?: string | null;
}) {
  const existing = await prisma.clientAgreement.findUnique({
    where: { id: input.agreementId }
  });
  if (!existing) {
    throw new Error("Agreement not found");
  }
  if (existing.status === "signed") {
    throw new Error("Agreement already signed");
  }
  if (existing.status === "withdrawn" || existing.status === "expired") {
    throw new Error(`Cannot sign a ${existing.status} agreement`);
  }
  if (!input.signerName.trim()) {
    throw new Error("Signer name is required");
  }
  if (!input.signerEmail.trim()) {
    throw new Error("Signer email is required");
  }

  const updated = await prisma.clientAgreement.update({
    where: { id: input.agreementId },
    data: {
      status: "signed",
      signedAt: new Date(),
      signerName: input.signerName.trim(),
      signerEmail: input.signerEmail.trim(),
      signerTitle: input.signerTitle?.trim() || null,
      signerIp: input.signerIp ?? null,
      signerUserAgent: input.signerUserAgent ?? null
    }
  });
  return serializeAgreement(updated);
}

export async function deleteClientAgreement(id: string) {
  await prisma.clientAgreement.delete({ where: { id } });
}

// Templates ---------------------------------------------------------------

interface TemplateRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
  body: string;
  isDefault: boolean;
  jurisdiction: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function serializeTemplate(row: TemplateRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    body: row.body,
    isDefault: row.isDefault,
    jurisdiction: row.jurisdiction,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function listAgreementTemplates() {
  const rows = await prisma.agreementTemplate.findMany({
    orderBy: [{ type: "asc" }, { title: "asc" }]
  });
  return rows.map(serializeTemplate);
}

export async function upsertAgreementTemplate(input: {
  id?: string | null | undefined;
  type: string;
  title: string;
  description?: string | null | undefined;
  body: string;
  isDefault?: boolean | undefined;
  jurisdiction?: string | null | undefined;
}) {
  const data = {
    type: input.type,
    title: input.title.trim(),
    description: input.description ?? null,
    body: input.body,
    isDefault: input.isDefault ?? false,
    jurisdiction: input.jurisdiction ?? null
  };
  const row = input.id
    ? await prisma.agreementTemplate.update({ where: { id: input.id }, data })
    : await prisma.agreementTemplate.create({ data });
  return serializeTemplate(row);
}

export async function deleteAgreementTemplate(id: string) {
  await prisma.agreementTemplate.delete({ where: { id } });
}
