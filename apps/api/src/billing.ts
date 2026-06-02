import Prisma from "@prisma/client";
import { z } from "zod";

import { prisma } from "./prisma";
import {
  calculateCurrentRetainerBalance,
  deriveTopUpRate,
  getBorrowForwardCap,
  getOverageTriggerHours,
  getRolloverCap,
  type RetainerCurrency,
  type RetainerServiceLine
} from "./retainers";

const billToEntityTypes = ["CLIENT", "PARTNER_AGENCY"] as const;
const invoiceTypes = ["RETAINER_BLOCK", "TOP_UP", "OTHER"] as const;
const invoiceStatuses = ["DRAFT", "SENT", "PAID", "OVERDUE", "VOID"] as const;

type PrismaTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

const createAgencySchema = z.object({
  name: z.string().trim().min(1),
  vatNumber: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  primaryContactEmail: z.string().trim().email().optional().nullable(),
  primaryContactName: z.string().trim().optional().nullable()
});

const updateAgencySchema = createAgencySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field must be provided."
);

const createInvoiceSchema = z.object({
  reference: z.string().trim().min(1),
  retainerId: z.string().trim().min(1),
  retainerPeriodId: z.string().trim().optional().nullable(),
  invoiceType: z.enum(invoiceTypes).default("RETAINER_BLOCK"),
  amount: z.number().finite().nonnegative().optional(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  xeroUrl: z.string().trim().url().optional().nullable(),
  status: z.enum(invoiceStatuses).default("DRAFT"),
  notes: z.string().trim().optional().nullable()
});

const updateInvoiceSchema = z
  .object({
    status: z.enum(invoiceStatuses).optional(),
    xeroUrl: z.string().trim().url().optional().nullable(),
    notes: z.string().trim().optional().nullable()
  })
  .refine((value) => Object.keys(value).length > 0, "No invoice changes provided.");

const invoiceListFilterSchema = z.object({
  status: z.enum(invoiceStatuses).optional(),
  retainerId: z.string().trim().min(1).optional(),
  billToEntityId: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional()
});

function decimalToNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber();
  }

  return 0;
}

export interface ManualLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface ComputedLine extends ManualLineInput {
  lineTotal: number;
  sortOrder: number;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeInvoiceTotals(items: ManualLineInput[]) {
  const lines: ComputedLine[] = items.map((item, index) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: round2(item.quantity * item.unitPrice),
    sortOrder: index
  }));
  const amount = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  return { lines, amount };
}

export function generateInvoiceReference(issueDate: Date, idSeed: string) {
  const y = issueDate.getUTCFullYear();
  const m = String(issueDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(issueDate.getUTCDate()).padStart(2, "0");
  return `INV-${y}${m}${d}-${idSeed.slice(0, 6).toUpperCase()}`;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isCurrentMonth(date: Date, now = new Date()) {
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function createRetainerLabel(input: {
  serviceLine: string;
  blockSize: number;
}) {
  const serviceLine =
    input.serviceLine === "TECHNICAL_DELIVERY"
      ? "Technical Delivery"
      : "Consulting";
  return `${serviceLine} - ${input.blockSize}h/month`;
}

function serializeBillToEntity<
  T extends {
    id: string;
    name: string;
    type: string;
    clientId: string | null;
    vatNumber: string | null;
    address: string | null;
    primaryContactEmail: string | null;
    primaryContactName: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
>(entity: T) {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    clientId: entity.clientId,
    vatNumber: entity.vatNumber,
    address: entity.address,
    primaryContactEmail: entity.primaryContactEmail,
    primaryContactName: entity.primaryContactName,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString()
  };
}

function serializeInvoice<
  T extends {
    id: string;
    reference: string;
    billToEntityId: string;
    retainerId: string | null;
    retainerPeriodId: string | null;
    invoiceType: string;
    amount: unknown;
    currency: string;
    issueDate: Date;
    dueDate: Date;
    xeroUrl: string | null;
    status: string;
    notes: string | null;
    createdByUserId: string;
    createdAt: Date;
    updatedAt: Date;
    sentAt: Date | null;
    paidAt: Date | null;
    billToEntity?: {
      id: string;
      name: string;
      type: string;
    } | null;
    retainer?: {
      id: string;
      serviceLine: string;
      blockSize: number;
      currency: string;
      client?: {
        id: string;
        name: string;
      } | null;
    } | null;
    retainerPeriod?: {
      id: string;
      periodMonth: Date;
      blockHours: number;
    } | null;
  }
>(invoice: T) {
  return {
    id: invoice.id,
    reference: invoice.reference,
    billToEntityId: invoice.billToEntityId,
    retainerId: invoice.retainerId,
    retainerPeriodId: invoice.retainerPeriodId,
    invoiceType: invoice.invoiceType,
    amount: decimalToNumber(invoice.amount),
    currency: invoice.currency,
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    xeroUrl: invoice.xeroUrl,
    status: invoice.status,
    notes: invoice.notes,
    createdByUserId: invoice.createdByUserId,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    sentAt: invoice.sentAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    billToEntity: invoice.billToEntity
      ? {
          id: invoice.billToEntity.id,
          name: invoice.billToEntity.name,
          type: invoice.billToEntity.type
        }
      : null,
    retainer: invoice.retainer
      ? {
          id: invoice.retainer.id,
          serviceLine: invoice.retainer.serviceLine,
          blockSize: invoice.retainer.blockSize,
          currency: invoice.retainer.currency,
          client: invoice.retainer.client
            ? {
                id: invoice.retainer.client.id,
                name: invoice.retainer.client.name
              }
            : null
        }
      : null,
    retainerPeriod: invoice.retainerPeriod
      ? {
          id: invoice.retainerPeriod.id,
          periodMonth: invoice.retainerPeriod.periodMonth.toISOString(),
          blockHours: invoice.retainerPeriod.blockHours
        }
      : null
  };
}

function serializeClientFacingRetainer(input: {
  retainer: {
    id: string;
    clientId: string;
    serviceLine: string;
    blockSize: number;
    rate: unknown;
    currency: string;
    startDate: Date;
    endDate: Date | null;
    status: string;
    billToEntity: {
      id: string;
      name: string;
      type: string;
    };
    periods: Array<{
      id: string;
      periodMonth: Date;
      blockHours: number;
      rolledInHours: number;
      borrowedFromNext: number;
      consumedHours: unknown;
      overageHours: number;
      rolledOutHours: number;
      status: string;
      topUps: Array<{
        id: string;
        hours: number;
        rate: unknown;
        status: string;
        quotedAt: Date;
        approvedAt: Date | null;
      }>;
    }>;
    rolloverBuckets: Array<{
      id: string;
      earnMonth: Date;
      expiresAt: Date;
      hoursRemaining: unknown;
      status: string;
    }>;
    invoices?: Array<{
      id: string;
      reference: string;
      billToEntityId: string;
      retainerId: string | null;
      retainerPeriodId: string | null;
      invoiceType: string;
      amount: unknown;
      currency: string;
      issueDate: Date;
      dueDate: Date;
      xeroUrl: string | null;
      status: string;
      notes: string | null;
      createdByUserId: string;
      createdAt: Date;
      updatedAt: Date;
      sentAt: Date | null;
      paidAt: Date | null;
      billToEntity?: {
        id: string;
        name: string;
        type: string;
      } | null;
    }>;
  };
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const currentPeriod = input.retainer.periods[0] ?? null;
  const approvedTopUpHours =
    currentPeriod?.topUps
      .filter((topUp) => topUp.status === "APPROVED" || topUp.status === "INVOICED")
      .reduce((total, topUp) => total + topUp.hours, 0) ?? 0;
  const consumedHours = currentPeriod
    ? decimalToNumber(currentPeriod.consumedHours)
    : 0;
  const totalAvailable = currentPeriod
    ? currentPeriod.blockHours + currentPeriod.rolledInHours + approvedTopUpHours
    : input.retainer.blockSize;
  const remainingHours = currentPeriod
    ? calculateCurrentRetainerBalance({
        blockHours: currentPeriod.blockHours,
        rolledInHours: currentPeriod.rolledInHours,
        approvedTopUpHours,
        consumedHours,
        borrowedFromNext: currentPeriod.borrowedFromNext
      })
    : input.retainer.blockSize;
  const nextRefreshDate = currentPeriod
    ? startOfMonth(addDays(currentPeriod.periodMonth, 32))
    : startOfMonth(addDays(now, 32));
  const daysUntilRefresh = Math.max(
    0,
    Math.ceil((startOfDay(nextRefreshDate).getTime() - startOfDay(now).getTime()) / 86400000)
  );
  const rolledBuckets = input.retainer.rolloverBuckets
    .filter((bucket) => bucket.status === "ACTIVE" && decimalToNumber(bucket.hoursRemaining) > 0)
    .sort((left, right) => left.expiresAt.getTime() - right.expiresAt.getTime())
    .map((bucket) => ({
      id: bucket.id,
      earnMonth: bucket.earnMonth.toISOString(),
      expiresAt: bucket.expiresAt.toISOString(),
      hoursRemaining: decimalToNumber(bucket.hoursRemaining)
    }));

  return {
    id: input.retainer.id,
    clientId: input.retainer.clientId,
    name: createRetainerLabel({
      serviceLine: input.retainer.serviceLine,
      blockSize: input.retainer.blockSize
    }),
    serviceLine: input.retainer.serviceLine,
    blockSize: input.retainer.blockSize,
    rate: decimalToNumber(input.retainer.rate),
    currency: input.retainer.currency,
    startDate: input.retainer.startDate.toISOString(),
    endDate: input.retainer.endDate?.toISOString() ?? null,
    status: input.retainer.status,
    billToEntity: {
      id: input.retainer.billToEntity.id,
      name: input.retainer.billToEntity.name,
      type: input.retainer.billToEntity.type
    },
    currentPeriod: currentPeriod
      ? {
          id: currentPeriod.id,
          periodMonth: currentPeriod.periodMonth.toISOString(),
          blockHours: currentPeriod.blockHours,
          rolledInHours: currentPeriod.rolledInHours,
          borrowedFromNext: currentPeriod.borrowedFromNext,
          consumedHours,
          overageHours: currentPeriod.overageHours,
          rolledOutHours: currentPeriod.rolledOutHours,
          approvedTopUpHours,
          totalAvailable,
          remainingHours,
          daysUntilRefresh,
          borrowCap: getBorrowForwardCap(currentPeriod.blockHours),
          rolloverCap: getRolloverCap(currentPeriod.blockHours),
          overageTriggerHours: getOverageTriggerHours({
            blockHours: currentPeriod.blockHours,
            rolledInHours: currentPeriod.rolledInHours
          }),
          topUps: currentPeriod.topUps.map((topUp) => ({
            id: topUp.id,
            hours: topUp.hours,
            rate: decimalToNumber(topUp.rate),
            status: topUp.status,
            quotedAt: topUp.quotedAt.toISOString(),
            approvedAt: topUp.approvedAt?.toISOString() ?? null,
            total: Number((topUp.hours * decimalToNumber(topUp.rate)).toFixed(2))
          }))
        }
      : null,
    rolloverBuckets: rolledBuckets,
    visibleInvoices:
      input.retainer.invoices?.map((invoice) => serializeInvoice(invoice)) ?? []
  };
}

export async function ensureClientBillToEntity(
  transaction: PrismaTransactionClient,
  clientId: string
) {
  const existing = await transaction.billToEntity.findFirst({
    where: {
      clientId,
      type: "CLIENT"
    }
  });

  if (existing) {
    return existing;
  }

  const client = await transaction.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true }
  });

  if (!client) {
    throw new Error("Client not found.");
  }

  return transaction.billToEntity.create({
    data: {
      name: client.name,
      type: "CLIENT",
      clientId: client.id
    }
  });
}

export async function resolveBillToEntityForRetainer(
  transaction: PrismaTransactionClient,
  input: {
    clientId: string;
    billToEntityId?: string | null;
    newBillToAgency?: {
      name: string;
      vatNumber?: string | null;
      address?: string | null;
      primaryContactEmail?: string | null;
      primaryContactName?: string | null;
    } | null;
  }
) {
  if (input.newBillToAgency?.name?.trim()) {
    return transaction.billToEntity.create({
      data: {
        name: input.newBillToAgency.name.trim(),
        type: "PARTNER_AGENCY",
        vatNumber: input.newBillToAgency.vatNumber?.trim() || null,
        address: input.newBillToAgency.address?.trim() || null,
        primaryContactEmail: input.newBillToAgency.primaryContactEmail?.trim() || null,
        primaryContactName: input.newBillToAgency.primaryContactName?.trim() || null
      }
    });
  }

  if (input.billToEntityId?.trim()) {
    const entity = await transaction.billToEntity.findUnique({
      where: { id: input.billToEntityId.trim() }
    });

    if (!entity) {
      throw new Error("Bill-to entity not found.");
    }

    if (entity.type === "CLIENT" && entity.clientId !== input.clientId) {
      throw new Error("Client bill-to entity must match the selected client.");
    }

    return entity;
  }

  return ensureClientBillToEntity(transaction, input.clientId);
}

export async function listBillToEntities() {
  const entities = await prisma.billToEntity.findMany({
    include: {
      client: {
        select: { id: true, name: true, slug: true }
      }
    },
    orderBy: [{ type: "asc" }, { name: "asc" }]
  });

  return entities.map((entity) => ({
    ...serializeBillToEntity(entity),
    client: entity.client
      ? {
          id: entity.client.id,
          name: entity.client.name,
          slug: entity.client.slug
        }
      : null
  }));
}

export async function createAgencyRecord(payload: unknown) {
  const input = createAgencySchema.parse(payload);
  const agency = await prisma.billToEntity.create({
    data: {
      name: input.name,
      type: "PARTNER_AGENCY",
      vatNumber: input.vatNumber?.trim() || null,
      address: input.address?.trim() || null,
      primaryContactEmail: input.primaryContactEmail?.trim() || null,
      primaryContactName: input.primaryContactName?.trim() || null
    }
  });

  return serializeBillToEntity(agency);
}

export async function updateAgencyRecord(agencyId: string, payload: unknown) {
  const input = updateAgencySchema.parse(payload);
  const existing = await prisma.billToEntity.findUnique({
    where: { id: agencyId }
  });

  if (!existing || existing.type !== "PARTNER_AGENCY") {
    throw new Error("Agency not found.");
  }

  const agency = await prisma.billToEntity.update({
    where: { id: agencyId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.vatNumber !== undefined
        ? { vatNumber: input.vatNumber?.trim() || null }
        : {}),
      ...(input.address !== undefined
        ? { address: input.address?.trim() || null }
        : {}),
      ...(input.primaryContactEmail !== undefined
        ? { primaryContactEmail: input.primaryContactEmail?.trim() || null }
        : {}),
      ...(input.primaryContactName !== undefined
        ? { primaryContactName: input.primaryContactName?.trim() || null }
        : {})
    }
  });

  return serializeBillToEntity(agency);
}

export async function loadAgencyDetail(agencyId: string) {
  const agency = await prisma.billToEntity.findUnique({
    where: { id: agencyId },
    include: {
      retainers: {
        include: {
          client: {
            select: { id: true, name: true, slug: true }
          }
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }]
      },
      invoices: {
        include: {
          retainer: {
            include: {
              client: {
                select: { id: true, name: true }
              }
            }
          },
          billToEntity: {
            select: { id: true, name: true, type: true }
          },
          retainerPeriod: {
            select: { id: true, periodMonth: true, blockHours: true }
          }
        },
        orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }]
      }
    }
  });

  if (!agency || agency.type !== "PARTNER_AGENCY") {
    return null;
  }

  const outstanding = agency.invoices
    .filter((invoice) => invoice.status === "SENT" || invoice.status === "OVERDUE")
    .reduce((sum, invoice) => sum + decimalToNumber(invoice.amount), 0);
  const now = new Date();
  const currentYear = now.getFullYear();
  const ytdInvoiced = agency.invoices
    .filter((invoice) => invoice.issueDate.getFullYear() === currentYear)
    .reduce((sum, invoice) => sum + decimalToNumber(invoice.amount), 0);
  const clientMap = new Map<
    string,
    {
      id: string;
      name: string;
      slug: string;
      retainerIds: string[];
    }
  >();

  for (const retainer of agency.retainers) {
    if (!clientMap.has(retainer.client.id)) {
      clientMap.set(retainer.client.id, {
        id: retainer.client.id,
        name: retainer.client.name,
        slug: retainer.client.slug,
        retainerIds: []
      });
    }

    clientMap.get(retainer.client.id)?.retainerIds.push(retainer.id);
  }

  return {
    ...serializeBillToEntity(agency),
    billedClients: Array.from(clientMap.values()).sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    outstanding,
    ytdInvoiced,
    invoices: agency.invoices.map((invoice) => serializeInvoice(invoice))
  };
}

function buildDefaultInvoiceAmount(input: {
  invoiceType: (typeof invoiceTypes)[number];
  retainer: {
    rate: unknown;
    currency: string;
    serviceLine: string;
    periods: Array<{
      id: string;
      blockHours: number;
      topUps: Array<{
        hours: number;
        rate: unknown;
        status: string;
      }>;
    }>;
  };
  retainerPeriodId: string | null;
}) {
  const period =
    input.retainerPeriodId === null
      ? null
      : input.retainer.periods.find((candidate) => candidate.id === input.retainerPeriodId) ??
        null;

  if (input.invoiceType === "TOP_UP" && period) {
    const approvedTopUps = period.topUps.filter(
      (topUp) => topUp.status === "APPROVED" || topUp.status === "INVOICED"
    );
    return approvedTopUps.reduce(
      (total, topUp) => total + topUp.hours * decimalToNumber(topUp.rate),
      0
    );
  }

  if (input.invoiceType === "RETAINER_BLOCK" && period) {
    return period.blockHours * decimalToNumber(input.retainer.rate);
  }

  return 0;
}

export async function createInvoiceRecord(payload: unknown, actorId: string) {
  const input = createInvoiceSchema.parse(payload);

  return prisma.$transaction(async (transaction) => {
    const retainer = await transaction.retainer.findUnique({
      where: { id: input.retainerId },
      include: {
        billToEntity: true,
        periods: {
          include: {
            topUps: true
          },
          orderBy: { periodMonth: "desc" }
        }
      }
    });

    if (!retainer) {
      throw new Error("Retainer not found.");
    }

    const retainerPeriodId = input.retainerPeriodId?.trim() || null;
    if (
      retainerPeriodId &&
      !retainer.periods.some((period) => period.id === retainerPeriodId)
    ) {
      throw new Error("Selected retainer period does not belong to this retainer.");
    }

    const dueDate = input.dueDate ?? addDays(input.issueDate, 14);
    const amount =
      input.amount ??
      buildDefaultInvoiceAmount({
        invoiceType: input.invoiceType,
        retainer,
        retainerPeriodId
      });

    const invoice = await transaction.invoice.create({
      data: {
        reference: input.reference,
        billToEntityId: retainer.billToEntityId,
        retainerId: retainer.id,
        retainerPeriodId,
        invoiceType: input.invoiceType,
        amount,
        currency: retainer.currency,
        issueDate: input.issueDate,
        dueDate,
        xeroUrl: input.xeroUrl?.trim() || null,
        status: input.status,
        notes: input.notes?.trim() || null,
        createdByUserId: actorId,
        ...(input.status === "SENT" ? { sentAt: new Date() } : {}),
        ...(input.status === "PAID" ? { paidAt: new Date() } : {})
      },
      include: {
        billToEntity: {
          select: { id: true, name: true, type: true }
        },
        retainer: {
          include: {
            client: {
              select: { id: true, name: true }
            }
          }
        },
        retainerPeriod: {
          select: { id: true, periodMonth: true, blockHours: true }
        }
      }
    });

    return serializeInvoice(invoice);
  });
}

export async function listInvoices(filters: unknown = {}) {
  const input = invoiceListFilterSchema.parse(filters);
  const invoices = await prisma.invoice.findMany({
    where: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.retainerId ? { retainerId: input.retainerId } : {}),
      ...(input.billToEntityId ? { billToEntityId: input.billToEntityId } : {}),
      ...(input.dateFrom || input.dateTo
        ? {
            issueDate: {
              ...(input.dateFrom ? { gte: input.dateFrom } : {}),
              ...(input.dateTo ? { lte: input.dateTo } : {})
            }
          }
        : {})
    },
    include: {
      billToEntity: {
        select: { id: true, name: true, type: true }
      },
      retainer: {
        include: {
          client: {
            select: { id: true, name: true }
          }
        }
      },
      retainerPeriod: {
        select: { id: true, periodMonth: true, blockHours: true }
      }
    },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }]
  });

  return invoices.map((invoice) => serializeInvoice(invoice));
}

export async function loadInvoiceDetail(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      billToEntity: {
        select: {
          id: true,
          name: true,
          type: true,
          primaryContactEmail: true,
          primaryContactName: true,
          vatNumber: true,
          address: true
        }
      },
      retainer: {
        include: {
          client: {
            select: { id: true, name: true }
          }
        }
      },
      retainerPeriod: {
        select: {
          id: true,
          periodMonth: true,
          blockHours: true,
          rolledInHours: true,
          borrowedFromNext: true,
          consumedHours: true,
          overageHours: true,
          rolledOutHours: true,
          status: true
        }
      }
    }
  });

  return invoice ? serializeInvoice(invoice) : null;
}

export async function updateInvoiceRecord(
  invoiceId: string,
  payload: unknown,
  actorId: string
) {
  const input = updateInvoiceSchema.parse(payload);
  const existing = await prisma.invoice.findUnique({
    where: { id: invoiceId }
  });

  if (!existing) {
    throw new Error("Invoice not found.");
  }

  if (input.status === "VOID" && (!input.notes || input.notes.trim().length === 0)) {
    throw new Error("Voiding an invoice requires a note.");
  }

  const nextStatus = input.status ?? existing.status;
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      ...(input.xeroUrl !== undefined
        ? { xeroUrl: input.xeroUrl?.trim() || null }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.status === "SENT" && !existing.sentAt ? { sentAt: new Date() } : {}),
      ...(input.status === "PAID" && !existing.paidAt ? { paidAt: new Date() } : {}),
      ...(nextStatus !== "PAID" && existing.paidAt ? { paidAt: null } : {}),
      ...(nextStatus !== "SENT" && nextStatus !== "OVERDUE" && existing.sentAt && nextStatus === "DRAFT"
        ? { sentAt: null }
        : {}),
      createdByUserId: actorId
    },
    include: {
      billToEntity: {
        select: { id: true, name: true, type: true }
      },
      retainer: {
        include: {
          client: {
            select: { id: true, name: true }
          }
        }
      },
      retainerPeriod: {
        select: { id: true, periodMonth: true, blockHours: true }
      }
    }
  });

  return serializeInvoice(invoice);
}

export async function markOverdueInvoices(now = new Date()) {
  const overdueThreshold = startOfDay(now);
  const candidates = await prisma.invoice.findMany({
    where: {
      status: "SENT",
      dueDate: { lt: overdueThreshold }
    },
    select: { id: true }
  });

  if (candidates.length === 0) {
    return { updatedCount: 0 };
  }

  const result = await prisma.invoice.updateMany({
    where: {
      id: { in: candidates.map((invoice) => invoice.id) }
    },
    data: {
      status: "OVERDUE"
    }
  });

  return { updatedCount: result.count };
}

export async function loadInvoiceDashboardSummary(now = new Date()) {
  const [draft, sent, overdue, paidThisMonthInvoices] = await Promise.all([
    prisma.invoice.count({ where: { status: "DRAFT" } }),
    prisma.invoice.count({ where: { status: "SENT" } }),
    prisma.invoice.count({ where: { status: "OVERDUE" } }),
    prisma.invoice.findMany({
      where: {
        status: "PAID",
        paidAt: {
          gte: startOfMonth(now)
        }
      },
      select: { amount: true, currency: true }
    })
  ]);

  return {
    draftCount: draft,
    sentCount: sent,
    overdueCount: overdue,
    paidThisMonth: paidThisMonthInvoices.reduce(
      (sum, invoice) => sum + decimalToNumber(invoice.amount),
      0
    ),
    paidThisMonthCurrency: paidThisMonthInvoices[0]?.currency ?? "ZAR"
  };
}

async function loadClientAccessibleRetainer(retainerId: string, userId: string) {
  return prisma.retainer.findFirst({
    where: {
      id: retainerId,
      client: {
        projects: {
          some: {
            clientAccess: {
              some: {
                userId
              }
            }
          }
        }
      }
    },
    include: {
      billToEntity: true,
      periods: {
        include: {
          topUps: true
        },
        orderBy: { periodMonth: "desc" }
      },
      rolloverBuckets: {
        where: {
          status: "ACTIVE"
        },
        orderBy: { expiresAt: "asc" }
      },
      invoices: {
        where: {
          billToEntity: {
            type: "CLIENT"
          }
        },
        include: {
          billToEntity: {
            select: { id: true, name: true, type: true }
          }
        },
        orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }]
      }
    }
  });
}

export async function loadClientRetainerDetail(retainerId: string, userId: string) {
  const retainer = await loadClientAccessibleRetainer(retainerId, userId);
  if (!retainer) {
    return null;
  }

  return serializeClientFacingRetainer({ retainer });
}

export async function loadClientRetainerHistory(retainerId: string, userId: string) {
  const retainer = await loadClientAccessibleRetainer(retainerId, userId);
  if (!retainer) {
    return null;
  }

  return {
    retainerId: retainer.id,
    periods: retainer.periods.map((period) => {
      const approvedTopUpHours = period.topUps
        .filter((topUp) => topUp.status === "APPROVED" || topUp.status === "INVOICED")
        .reduce((total, topUp) => total + topUp.hours, 0);
      const consumedHours = decimalToNumber(period.consumedHours);
      return {
        id: period.id,
        periodMonth: period.periodMonth.toISOString(),
        blockHours: period.blockHours,
        rolledInHours: period.rolledInHours,
        borrowedFromNext: period.borrowedFromNext,
        consumedHours,
        approvedTopUpHours,
        overageHours: period.overageHours,
        rolledOutHours: period.rolledOutHours,
        balance: calculateCurrentRetainerBalance({
          blockHours: period.blockHours,
          rolledInHours: period.rolledInHours,
          approvedTopUpHours,
          consumedHours,
          borrowedFromNext: period.borrowedFromNext
        }),
        status: period.status,
        topUps: period.topUps.map((topUp) => ({
          id: topUp.id,
          hours: topUp.hours,
          rate: decimalToNumber(topUp.rate),
          status: topUp.status,
          quotedAt: topUp.quotedAt.toISOString(),
          approvedAt: topUp.approvedAt?.toISOString() ?? null,
          total: Number((topUp.hours * decimalToNumber(topUp.rate)).toFixed(2))
        }))
      };
    })
  };
}

export async function loadProjectClientRetainerSummary(
  projectId: string,
  userId: string
) {
  const access = await prisma.clientProjectAccess.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId
      }
    },
    select: {
      project: {
        select: {
          retainerId: true
        }
      }
    }
  });

  const retainerId = access?.project.retainerId;
  if (!retainerId) {
    return null;
  }

  return loadClientRetainerDetail(retainerId, userId);
}

export async function assertClientRetainerAccess(
  retainerId: string,
  userId: string
) {
  const retainer = await loadClientAccessibleRetainer(retainerId, userId);
  if (!retainer) {
    throw new Error("Retainer not found");
  }

  return retainer;
}

export async function getClientVisibleTopUpDetail(
  retainerId: string,
  topUpId: string,
  userId: string
) {
  const retainer = await loadClientAccessibleRetainer(retainerId, userId);
  if (!retainer) {
    return null;
  }

  const currentPeriod = retainer.periods[0] ?? null;
  const topUp = currentPeriod?.topUps.find((candidate) => candidate.id === topUpId) ?? null;

  if (!topUp) {
    return null;
  }

  const approvedTopUpHours = currentPeriod?.topUps
    .filter((candidate) => candidate.status === "APPROVED" || candidate.status === "INVOICED")
    .reduce((sum, candidate) => sum + candidate.hours, 0) ?? 0;

  return {
    retainer: serializeClientFacingRetainer({ retainer }),
    topUp: {
      id: topUp.id,
      hours: topUp.hours,
      rate: decimalToNumber(topUp.rate),
      status: topUp.status,
      quotedAt: topUp.quotedAt.toISOString(),
      approvedAt: topUp.approvedAt?.toISOString() ?? null,
      total: Number((topUp.hours * decimalToNumber(topUp.rate)).toFixed(2))
    },
    summary: {
      consumedHours: currentPeriod ? decimalToNumber(currentPeriod.consumedHours) : 0,
      includedHours: currentPeriod
        ? currentPeriod.blockHours + currentPeriod.rolledInHours + approvedTopUpHours
        : retainer.blockSize
    }
  };
}

export function buildDefaultTopUpRatePreview(input: {
  serviceLine: RetainerServiceLine;
  currency: RetainerCurrency;
  fxRateFromZar?: number;
}) {
  return deriveTopUpRate(input);
}
