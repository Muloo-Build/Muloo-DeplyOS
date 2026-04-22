import { Prisma, PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const seedPrefix = "Seed Client - Scenario";
const localDatabaseUrl = process.env.DATABASE_URL ?? "";

function assertLocalDatabase(url: string) {
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    throw new Error(
      `Refusing to seed non-local database host ${parsed.hostname}.`
    );
  }
}

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
  );
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
}

function decimal(value: number) {
  return new Prisma.Decimal(value);
}

async function cleanupSeedData() {
  const seedClients = await prisma.client.findMany({
    where: {
      name: {
        startsWith: seedPrefix
      }
    },
    select: {
      id: true,
      projects: { select: { id: true } },
      retainers: { select: { id: true } }
    }
  });

  const projectIds = seedClients.flatMap((client) =>
    client.projects.map((project) => project.id)
  );
  const clientIds = seedClients.map((client) => client.id);

  if (projectIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    await prisma.taskApproval.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    await prisma.executionJob.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    await prisma.projectMessage.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    await prisma.projectQuote.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    await prisma.clientProjectAccess.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    await prisma.clientInputSubmission.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    await prisma.discoveryEvidence.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    await prisma.discoverySummary.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    await prisma.discoverySubmission.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    await prisma.projectContext.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    await prisma.workRequest.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    await prisma.task.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  }

  if (clientIds.length > 0) {
    await prisma.retainer.deleteMany({
      where: { clientId: { in: clientIds } }
    });
    await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
  }

  await prisma.clientPortalUser.deleteMany({
    where: {
      email: {
        startsWith: "seed-approver+"
      }
    }
  });
}

async function ensurePortal() {
  return prisma.hubSpotPortal.upsert({
    where: { portalId: "seed-retainers-local" },
    update: {
      displayName: "Seed Retainers Local",
      connected: false
    },
    create: {
      portalId: "seed-retainers-local",
      displayName: "Seed Retainers Local",
      connected: false
    }
  });
}

async function createScenario(input: {
  scenarioNumber: number;
  label: string;
  serviceLine: Prisma.RetainerServiceLine;
  blockSize: number;
  rate: number;
  currency: Prisma.RetainerCurrency;
  status?: Prisma.RetainerStatus;
  retainerStartDate: Date;
  periodMonth: Date;
  periodStatus?: Prisma.RetainerPeriodStatus;
  blockHours?: number;
  rolledInHours?: number;
  borrowedFromNext?: number;
  borrowActive?: boolean;
  consumedHours?: number;
  overageHours?: number;
  rolledOutHours?: number;
  topUps?: Array<{
    hours: number;
    rate: number;
    status: Prisma.RetainerTopUpStatus;
    approvedByClient?: boolean;
  }>;
  buckets?: Array<{
    hoursOriginal: number;
    hoursRemaining: number;
    earnMonth: Date;
    expiresAt: Date;
    status?: Prisma.RolloverBucketStatus;
  }>;
}) {
  const portal = await ensurePortal();
  const clientName = `${seedPrefix} ${input.scenarioNumber} (${input.label})`;
  const client = await prisma.client.create({
    data: {
      name: clientName,
      slug: `${slugify(clientName)}-${input.scenarioNumber}`,
      hubSpotPortalId: portal.id
    }
  });

  const approver = await prisma.clientPortalUser.create({
    data: {
      firstName: "Seed",
      lastName: "Approver",
      email: `seed-approver+scenario-${input.scenarioNumber}@muloo.local`,
      password: "seed-pass"
    }
  });

  const billToEntity = await prisma.billToEntity.create({
    data: {
      name: client.name,
      type: "CLIENT",
      clientId: client.id
    }
  });

  const retainer = await prisma.retainer.create({
    data: {
      clientId: client.id,
      billToEntityId: billToEntity.id,
      serviceLine: input.serviceLine,
      blockSize: input.blockSize,
      rate: decimal(input.rate),
      currency: input.currency,
      startDate: input.retainerStartDate,
      status: input.status ?? "ACTIVE"
    }
  });

  const project = await prisma.project.create({
    data: {
      name: `${clientName} Delivery Project`,
      owner: "Seed Operator",
      ownerEmail: "seed-operator@muloo.local",
      clientId: client.id,
      portalId: portal.id,
      status: "active",
      retainerId: retainer.id
    }
  });

  await prisma.clientProjectAccess.create({
    data: {
      userId: approver.id,
      projectId: project.id,
      role: "approver"
    }
  });

  const period = await prisma.retainerPeriod.create({
    data: {
      retainerId: retainer.id,
      periodMonth: input.periodMonth,
      blockHours: input.blockHours ?? input.blockSize,
      rolledInHours: input.rolledInHours ?? 0,
      borrowedFromNext: input.borrowedFromNext ?? 0,
      borrowActive: input.borrowActive ?? false,
      consumedHours: decimal(input.consumedHours ?? 0),
      overageHours: input.overageHours ?? 0,
      rolledOutHours: input.rolledOutHours ?? 0,
      status: input.periodStatus ?? "OPEN"
    }
  });

  for (const bucket of input.buckets ?? []) {
    await prisma.rolloverBucket.create({
      data: {
        retainerId: retainer.id,
        hoursOriginal: decimal(bucket.hoursOriginal),
        hoursRemaining: decimal(bucket.hoursRemaining),
        earnMonth: bucket.earnMonth,
        expiresAt: bucket.expiresAt,
        status: bucket.status ?? "ACTIVE"
      }
    });
  }

  for (const topUp of input.topUps ?? []) {
    await prisma.retainerTopUp.create({
      data: {
        retainerPeriodId: period.id,
        hours: topUp.hours,
        rate: decimal(topUp.rate),
        status: topUp.status,
        approvedAt:
          topUp.status === "APPROVED" || topUp.status === "INVOICED"
            ? new Date()
            : null,
        approvedByClientUserId: topUp.approvedByClient ? approver.id : null
      }
    });
  }

  return { client, approver, retainer, period, project };
}

async function main() {
  assertLocalDatabase(localDatabaseUrl);

  const now = new Date();
  const currentMonth = monthStart(now);
  const previousMonth = addMonths(currentMonth, -1);
  const twoMonthsAgo = addMonths(currentMonth, -2);
  const threeMonthsAgo = addMonths(currentMonth, -3);

  await cleanupSeedData();

  await createScenario({
    scenarioNumber: 1,
    label: "Fresh",
    serviceLine: "TECHNICAL_DELIVERY",
    blockSize: 40,
    rate: 1700,
    currency: "ZAR",
    retainerStartDate: currentMonth,
    periodMonth: currentMonth,
    consumedHours: 0
  });

  await createScenario({
    scenarioNumber: 2,
    label: "Under Utilised",
    serviceLine: "TECHNICAL_DELIVERY",
    blockSize: 40,
    rate: 1700,
    currency: "ZAR",
    retainerStartDate: previousMonth,
    periodMonth: previousMonth,
    consumedHours: 20
  });

  await createScenario({
    scenarioNumber: 3,
    label: "Exactly At Block",
    serviceLine: "TECHNICAL_DELIVERY",
    blockSize: 40,
    rate: 1700,
    currency: "ZAR",
    retainerStartDate: previousMonth,
    periodMonth: previousMonth,
    consumedHours: 40
  });

  await createScenario({
    scenarioNumber: 4,
    label: "Borrow Active",
    serviceLine: "TECHNICAL_DELIVERY",
    blockSize: 40,
    rate: 1700,
    currency: "ZAR",
    retainerStartDate: previousMonth,
    periodMonth: previousMonth,
    consumedHours: 45,
    borrowedFromNext: 5,
    borrowActive: true
  });

  await createScenario({
    scenarioNumber: 5,
    label: "Expired Rollover Bucket",
    serviceLine: "TECHNICAL_DELIVERY",
    blockSize: 40,
    rate: 1700,
    currency: "ZAR",
    retainerStartDate: previousMonth,
    periodMonth: previousMonth,
    rolledInHours: 6,
    consumedHours: 10,
    buckets: [
      {
        hoursOriginal: 6,
        hoursRemaining: 6,
        earnMonth: threeMonthsAgo,
        expiresAt: addDays(previousMonth, -1),
        status: "ACTIVE"
      }
    ]
  });

  const scenario6 = await createScenario({
    scenarioNumber: 6,
    label: "Mixed Age Rollover Buckets",
    serviceLine: "TECHNICAL_DELIVERY",
    blockSize: 40,
    rate: 1700,
    currency: "ZAR",
    retainerStartDate: currentMonth,
    periodMonth: currentMonth,
    rolledInHours: 12,
    consumedHours: 0,
    buckets: [
      {
        hoursOriginal: 5,
        hoursRemaining: 5,
        earnMonth: threeMonthsAgo,
        expiresAt: addDays(now, 10)
      },
      {
        hoursOriginal: 7,
        hoursRemaining: 7,
        earnMonth: twoMonthsAgo,
        expiresAt: addDays(now, 40)
      }
    ]
  });

  await prisma.task.create({
    data: {
      projectId: scenario6.project.id,
      title: "Scenario 6 FIFO task",
      status: "COMPLETE",
      executionType: "manual",
      plannedHours: 8
    }
  });

  await createScenario({
    scenarioNumber: 7,
    label: "Approved Top Up",
    serviceLine: "TECHNICAL_DELIVERY",
    blockSize: 40,
    rate: 1700,
    currency: "ZAR",
    retainerStartDate: previousMonth,
    periodMonth: previousMonth,
    consumedHours: 55,
    borrowedFromNext: 10,
    borrowActive: true,
    overageHours: 10,
    topUps: [
      {
        hours: 10,
        rate: 1700,
        status: "APPROVED",
        approvedByClient: true
      }
    ]
  });

  await createScenario({
    scenarioNumber: 8,
    label: "Paused",
    serviceLine: "TECHNICAL_DELIVERY",
    blockSize: 40,
    rate: 1700,
    currency: "ZAR",
    status: "PAUSED",
    retainerStartDate: previousMonth,
    periodMonth: previousMonth,
    consumedHours: 15
  });

  await createScenario({
    scenarioNumber: 9,
    label: "Consulting",
    serviceLine: "CONSULTING",
    blockSize: 20,
    rate: 2200,
    currency: "ZAR",
    retainerStartDate: previousMonth,
    periodMonth: previousMonth,
    consumedHours: 20
  });

  await createScenario({
    scenarioNumber: 10,
    label: "USD Locked FX",
    serviceLine: "TECHNICAL_DELIVERY",
    blockSize: 40,
    rate: 95,
    currency: "USD",
    retainerStartDate: previousMonth,
    periodMonth: previousMonth,
    consumedHours: 20
  });

  console.log("Seeded 10 retainer verification scenarios.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
