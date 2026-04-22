import Prisma from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import {
  addDaysUtc,
  addMonthsUtc,
  calculateConsumptionBucketBreakdown,
  calculateCurrentRetainerBalance,
  calculateRolledOutHours,
  deriveRetainerRate,
  deriveTopUpRate,
  getBaseHourlyRateZar,
  getBorrowForwardCap,
  getOverageTriggerHours,
  rolloverExpiryDays,
  topUpDefaultHours,
  validateBilledHoursOverride,
  type RetainerCurrency,
  type RetainerServiceLine
} from "./retainers";

type PrismaTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

const completeTaskStatuses = new Set([
  "COMPLETE",
  "complete",
  "completed",
  "done"
]);
const retainerTimezone = "Africa/Johannesburg";

export class RetainerOverageError extends Error {
  readonly payload: {
    error: "overage_requires_topup";
    shortfall: number;
    borrowCapRemaining: number;
    suggestedTopUpHours: number;
    topUpId: string;
  };

  constructor(payload: RetainerOverageError["payload"]) {
    super("overage_requires_topup");
    this.payload = payload;
  }
}

const approveToBillSchema = z.object({
  billedHours: z.number().finite().nonnegative().optional(),
  overrideReason: z.string().trim().optional(),
  now: z.coerce.date().optional()
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

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

function deriveLockedCurrencyTopUpRate(input: {
  serviceLine: RetainerServiceLine;
  blockSize: number;
  currency: RetainerCurrency;
  lockedRetainerRate: number;
}) {
  if (input.currency === "ZAR") {
    return deriveTopUpRate({
      serviceLine: input.serviceLine,
      currency: input.currency
    });
  }

  const zarRetainerRate = deriveRetainerRate({
    serviceLine: input.serviceLine,
    blockSize: input.blockSize,
    currency: "ZAR"
  });
  const lockedFxRate = input.lockedRetainerRate / zarRetainerRate;

  return roundHours(getBaseHourlyRateZar(input.serviceLine) * lockedFxRate);
}

function serializeLedgerEntry<
  T extends {
    id: string;
    retainerPeriodId: string;
    taskId: string | null;
    entryType: string;
    hoursDelta: unknown;
    plannedHours: unknown | null;
    billedHours: unknown | null;
    producedBy: string | null;
    overrideReason: string | null;
    metadata: Prisma.Prisma.JsonValue | null;
    createdBy: string;
    createdAt: Date;
  }
>(entry: T) {
  return {
    id: entry.id,
    retainerPeriodId: entry.retainerPeriodId,
    taskId: entry.taskId,
    entryType: entry.entryType,
    hoursDelta: decimalToNumber(entry.hoursDelta),
    plannedHours:
      entry.plannedHours === null ? null : decimalToNumber(entry.plannedHours),
    billedHours:
      entry.billedHours === null ? null : decimalToNumber(entry.billedHours),
    producedBy: entry.producedBy,
    overrideReason: entry.overrideReason,
    metadata: entry.metadata,
    createdBy: entry.createdBy,
    createdAt: entry.createdAt.toISOString()
  };
}

function serializePeriodBalance<
  T extends {
    id: string;
    retainerId: string;
    periodMonth: Date;
    blockHours: number;
    rolledInHours: number;
    borrowedFromNext: number;
    borrowActive: boolean;
    consumedHours: unknown;
    overageHours: number;
    rolledOutHours: number;
    status: string;
    topUps?: Array<{ hours: number; status: string }>;
  }
>(period: T) {
  const approvedTopUpHours =
    period.topUps
      ?.filter(
        (topUp) => topUp.status === "APPROVED" || topUp.status === "INVOICED"
      )
      .reduce((total, topUp) => total + topUp.hours, 0) ?? 0;
  const consumedHours = decimalToNumber(period.consumedHours);

  return {
    id: period.id,
    retainerId: period.retainerId,
    periodMonth: period.periodMonth.toISOString(),
    blockHours: period.blockHours,
    rolledInHours: period.rolledInHours,
    borrowedFromNext: period.borrowedFromNext,
    borrowActive: period.borrowActive,
    consumedHours,
    overageHours: period.overageHours,
    rolledOutHours: period.rolledOutHours,
    approvedTopUpHours,
    balance: calculateCurrentRetainerBalance({
      blockHours: period.blockHours,
      rolledInHours: period.rolledInHours,
      approvedTopUpHours,
      consumedHours,
      borrowedFromNext: period.borrowedFromNext
    })
  };
}

function getRetainerMonthStart(now: Date) {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: retainerTimezone,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  return new Date(Date.UTC(year, month - 1, 1));
}

async function ensureOpenPeriod(
  tx: PrismaTransactionClient,
  retainer: {
    id: string;
    blockSize: number;
  },
  periodMonth: Date
) {
  const existing = await tx.retainerPeriod.findUnique({
    where: {
      retainerId_periodMonth: {
        retainerId: retainer.id,
        periodMonth
      }
    },
    include: { topUps: true }
  });

  if (existing) {
    return existing;
  }

  const activeRolloverBuckets = await tx.rolloverBucket.findMany({
    where: {
      retainerId: retainer.id,
      status: "ACTIVE",
      hoursRemaining: { gt: 0 },
      expiresAt: { gt: periodMonth }
    }
  });

  const rolledInHours = Math.floor(
    activeRolloverBuckets.reduce(
      (total, bucket) => total + decimalToNumber(bucket.hoursRemaining),
      0
    )
  );

  return tx.retainerPeriod.create({
    data: {
      retainerId: retainer.id,
      periodMonth,
      blockHours: retainer.blockSize,
      rolledInHours
    },
    include: { topUps: true }
  });
}

async function expirePassedRolloverBuckets(
  tx: PrismaTransactionClient,
  retainerId: string,
  now: Date,
  periodId: string,
  actor: string
) {
  const expiredBuckets = await tx.rolloverBucket.findMany({
    where: {
      retainerId,
      status: "ACTIVE",
      expiresAt: { lte: now },
      hoursRemaining: { gt: 0 }
    }
  });

  for (const bucket of expiredBuckets) {
    const hours = decimalToNumber(bucket.hoursRemaining);
    await tx.rolloverBucket.update({
      where: { id: bucket.id },
      data: {
        hoursRemaining: 0,
        status: "EXPIRED"
      }
    });
    await tx.retainerLedgerEntry.create({
      data: {
        retainerPeriodId: periodId,
        entryType: "MONTH_RECONCILIATION",
        hoursDelta: -hours,
        createdBy: actor,
        metadata: {
          reason: "expired: 90-day rollover window elapsed",
          bucketId: bucket.id,
          earnMonth: bucket.earnMonth.toISOString()
        }
      }
    });
  }
}

function inferProducedBy(task: {
  assigneeType: string | null;
  executionType: string;
  executionJobs: Array<{
    executionTier: number | null;
    executionMethod: string;
  }>;
}) {
  if (
    task.executionJobs.some((job) => job.executionTier === 3) ||
    /hybrid|cowork/i.test(task.executionType) ||
    task.executionJobs.some((job) => /cowork|hybrid/i.test(job.executionMethod))
  ) {
    return "HYBRID" as const;
  }

  if (
    task.assigneeType === "Agent" ||
    /agent/i.test(task.executionType) ||
    task.executionJobs.some((job) => job.executionTier === 2)
  ) {
    return "AGENT" as const;
  }

  return "HUMAN" as const;
}

export async function consumeHours(input: {
  tx: PrismaTransactionClient;
  retainerPeriodId: string;
  retainerId: string;
  hoursToConsume: number;
}) {
  const buckets = await input.tx.rolloverBucket.findMany({
    where: {
      retainerId: input.retainerId,
      status: "ACTIVE",
      hoursRemaining: { gt: 0 }
    },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }]
  });
  const breakdown = calculateConsumptionBucketBreakdown({
    hoursToConsume: input.hoursToConsume,
    rolloverBuckets: buckets.map((bucket) => ({
      id: bucket.id,
      expiresAt: bucket.expiresAt,
      hoursRemaining: decimalToNumber(bucket.hoursRemaining)
    }))
  });

  for (const item of breakdown.rollover) {
    const bucket = buckets.find((candidate) => candidate.id === item.bucketId);
    if (!bucket) {
      continue;
    }

    const nextRemaining = roundHours(
      decimalToNumber(bucket.hoursRemaining) - item.hours
    );
    await input.tx.rolloverBucket.update({
      where: { id: bucket.id },
      data: {
        hoursRemaining: Math.max(0, nextRemaining),
        status: nextRemaining <= 0 ? "CONSUMED" : "ACTIVE"
      }
    });
  }

  return {
    success: true,
    bucketBreakdown: breakdown
  };
}

export async function approveTaskToBill(input: {
  taskId: string;
  projectId?: string;
  actor: string;
  userId?: string | null;
  payload: unknown;
}) {
  const parsed = approveToBillSchema.parse(input.payload);
  const now = parsed.now ?? new Date();
  const periodMonth = getRetainerMonthStart(now);

  const result = await prisma.$transaction(
    async (tx) => {
      const task = await tx.task.findUnique({
      where: { id: input.taskId },
      include: {
        project: {
          include: {
            retainer: true
          }
        },
        executionJobs: {
          orderBy: { createdAt: "desc" },
          take: 5
        }
      }
    });

    if (!task || (input.projectId && task.projectId !== input.projectId)) {
      throw new Error("Task not found");
    }

    if (!completeTaskStatuses.has(task.status)) {
      throw new Error("Task must be complete before approve-to-bill");
    }

    if (task.billApprovedAt) {
      const error = new Error("Task already approved to bill");
      error.name = "TaskAlreadyApprovedToBill";
      throw error;
    }

    const plannedHours = task.plannedHours ?? 0;
    const billedHours = parsed.billedHours ?? plannedHours;
    validateBilledHoursOverride({
      plannedHours,
      billedHours,
      overrideReason: parsed.overrideReason ?? null
    });

    const retainer = task.project.retainer;
    if (!retainer || retainer.status !== "ACTIVE") {
      const updatedTask = await tx.task.update({
        where: { id: task.id },
        data: {
          billApprovedAt: now,
          billApprovedBy: input.actor,
          billableHours: billedHours,
          billingOverrideReason: parsed.overrideReason ?? null
        }
      });

      return {
        taskId: updatedTask.id,
        ledgerEntry: null,
        retainerPeriod: null
      };
    }

    const period = await ensureOpenPeriod(tx, retainer, periodMonth);
    await expirePassedRolloverBuckets(
      tx,
      retainer.id,
      now,
      period.id,
      input.actor
    );

    const approvedTopUpHours = period.topUps
      .filter(
        (topUp) => topUp.status === "APPROVED" || topUp.status === "INVOICED"
      )
      .reduce((total, topUp) => total + topUp.hours, 0);
    const consumedHours = decimalToNumber(period.consumedHours);
    const proposedConsumedHours = roundHours(consumedHours + billedHours);
    const borrowCap = getBorrowForwardCap(period.blockHours);
    const includedHours = period.blockHours + period.rolledInHours;
    const overageTriggerHours = getOverageTriggerHours({
      blockHours: period.blockHours,
      rolledInHours: period.rolledInHours
    });
    const allowedWithTopUps = overageTriggerHours + approvedTopUpHours;
    const shortfall = roundHours(proposedConsumedHours - includedHours);

    if (proposedConsumedHours > allowedWithTopUps) {
      const rate = deriveLockedCurrencyTopUpRate({
        serviceLine: retainer.serviceLine as RetainerServiceLine,
        blockSize: retainer.blockSize,
        currency: retainer.currency as RetainerCurrency,
        lockedRetainerRate: decimalToNumber(retainer.rate)
      });
      const topUp =
        (await tx.retainerTopUp.findFirst({
          where: {
            retainerPeriodId: period.id,
            status: "QUOTED"
          },
          orderBy: { quotedAt: "desc" }
        })) ??
        (await tx.retainerTopUp.create({
          data: {
            retainerPeriodId: period.id,
            hours: topUpDefaultHours,
            rate,
            status: "QUOTED"
          }
        }));

      return {
        overage: {
          error: "overage_requires_topup" as const,
          shortfall: Math.max(0, shortfall),
          borrowCapRemaining: Math.max(
            0,
            roundHours(borrowCap - Math.max(0, consumedHours - includedHours))
          ),
          suggestedTopUpHours: topUpDefaultHours,
          topUpId: topUp.id
        }
      };
    }

    const consumption = await consumeHours({
      tx,
      retainerPeriodId: period.id,
      retainerId: retainer.id,
      hoursToConsume: billedHours
    });
    const borrowedFromNext = Math.max(0, Math.min(borrowCap, shortfall));
    const producedBy = inferProducedBy(task);

    const ledgerEntry = await tx.retainerLedgerEntry.create({
      data: {
        retainerPeriodId: period.id,
        taskId: task.id,
        entryType: "TASK_CONSUMPTION",
        hoursDelta: -billedHours,
        plannedHours,
        billedHours,
        producedBy,
        overrideReason: parsed.overrideReason ?? null,
        createdBy: input.userId ?? input.actor,
        metadata: {
          bucketBreakdown: consumption.bucketBreakdown,
          serviceLine: retainer.serviceLine
        }
      }
    });

    const updatedPeriod = await tx.retainerPeriod.update({
      where: { id: period.id },
      data: {
        consumedHours: { increment: billedHours },
        borrowedFromNext,
        borrowActive: borrowedFromNext > 0
      },
      include: { topUps: true }
    });

    await tx.task.update({
      where: { id: task.id },
      data: {
        billApprovedAt: now,
        billApprovedBy: input.actor,
        billableHours: billedHours,
        billingOverrideReason: parsed.overrideReason ?? null
      }
    });

    await tx.auditLog.create({
      data: {
        actor: input.actor,
        action: "retainer.task_approved_to_bill",
        entityType: "Task",
        entityId: task.id,
        projectId: task.projectId,
        metadata: {
          retainerId: retainer.id,
          retainerPeriodId: period.id,
          plannedHours,
          billedHours,
          producedBy,
          overrideReason: parsed.overrideReason ?? null
        }
      }
    });

      return {
        taskId: task.id,
        ledgerEntry: serializeLedgerEntry(ledgerEntry),
        retainerPeriod: serializePeriodBalance(updatedPeriod)
      };
    },
    {
      maxWait: 10_000,
      timeout: 30_000
    }
  );

  if ("overage" in result) {
    throw new RetainerOverageError(result.overage);
  }

  return result;
}

export async function approveRetainerTopUp(input: {
  retainerId: string;
  topUpId: string;
  clientUserId?: string | null;
  actor: string;
}) {
  return prisma.$transaction(
    async (tx) => {
      const topUp = await tx.retainerTopUp.findUnique({
      where: { id: input.topUpId },
      include: {
        retainerPeriod: {
          include: {
            retainer: true,
            topUps: true
          }
        }
      }
    });

    if (!topUp || topUp.retainerPeriod.retainerId !== input.retainerId) {
      throw new Error("Top-up quote not found");
    }

    if (topUp.status !== "QUOTED") {
      throw new Error("Top-up quote is not pending approval");
    }

    const updatedTopUp = await tx.retainerTopUp.update({
      where: { id: topUp.id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedByClientUserId: input.clientUserId ?? null
      }
    });

    const ledgerEntry = await tx.retainerLedgerEntry.create({
      data: {
        retainerPeriodId: topUp.retainerPeriodId,
        entryType: "TOP_UP",
        hoursDelta: topUp.hours,
        createdBy: input.clientUserId ?? input.actor,
        metadata: {
          topUpId: topUp.id,
          rate: decimalToNumber(topUp.rate)
        }
      }
    });

    const period = await tx.retainerPeriod.update({
      where: { id: topUp.retainerPeriodId },
      data: {
        overageHours: { increment: topUp.hours }
      },
      include: { topUps: true }
    });

      return {
        topUp: {
          id: updatedTopUp.id,
          status: updatedTopUp.status,
          approvedAt: updatedTopUp.approvedAt?.toISOString() ?? null
        },
        ledgerEntry: serializeLedgerEntry(ledgerEntry),
        retainerPeriod: serializePeriodBalance(period)
      };
    },
    {
      maxWait: 10_000,
      timeout: 30_000
    }
  );
}

export async function reconcileRetainers(input: {
  dryRun?: boolean;
  now?: Date;
  actor: string;
}) {
  const now = input.now ?? new Date();
  const currentMonth = getRetainerMonthStart(now);
  const activeRetainers = await prisma.retainer.findMany({
    where: { status: "ACTIVE" },
    include: {
      client: { select: { name: true } },
      periods: {
        where: {
          status: "OPEN",
          periodMonth: { lt: currentMonth }
        },
        orderBy: { periodMonth: "asc" },
        include: { topUps: true }
      }
    }
  });
  const dryRunActions: unknown[] = [];

  for (const retainer of activeRetainers) {
    for (const period of retainer.periods) {
      const consumedHours = decimalToNumber(period.consumedHours);
      const borrowedFromNext = period.borrowedFromNext;
      const approvedTopUpHours = period.topUps
        .filter(
          (topUp) => topUp.status === "APPROVED" || topUp.status === "INVOICED"
        )
        .reduce((total, topUp) => total + topUp.hours, 0);
      const overageTriggerHours = getOverageTriggerHours({
        blockHours: period.blockHours,
        rolledInHours: period.rolledInHours
      });
      const topUpHoursUsed = Math.max(0, consumedHours - overageTriggerHours);
      const expiredTopUpHours = Math.max(
        0,
        roundHours(approvedTopUpHours - topUpHoursUsed)
      );
      const endedInBorrow = borrowedFromNext > 0;
      const rolledOutHours = endedInBorrow
        ? 0
        : calculateRolledOutHours({
            blockHours: period.blockHours,
            rolledInHours: period.rolledInHours,
            consumedHours
          });
      const nextPeriodMonth = addMonthsUtc(period.periodMonth, 1);
      const nextBlockHours = Math.max(0, retainer.blockSize - borrowedFromNext);

      dryRunActions.push({
        retainerId: retainer.id,
        clientName: retainer.client.name,
        closePeriodId: period.id,
        periodMonth: period.periodMonth.toISOString(),
        endedInBorrow,
        rolledOutHours,
        borrowedFromNext,
        expiredTopUpHours,
        nextPeriodMonth: nextPeriodMonth.toISOString(),
        nextBlockHours
      });

      if (input.dryRun) {
        continue;
      }

      await prisma.$transaction(
        async (tx) => {
          const lockedPeriod = await tx.retainerPeriod.findUnique({
          where: { id: period.id }
        });
        if (!lockedPeriod || lockedPeriod.status === "CLOSED") {
          return;
        }

        if (endedInBorrow) {
          const activeBuckets = await tx.rolloverBucket.findMany({
            where: {
              retainerId: retainer.id,
              status: "ACTIVE",
              hoursRemaining: { gt: 0 }
            }
          });
          const expiredRolledHours = activeBuckets.reduce(
            (total, bucket) => total + decimalToNumber(bucket.hoursRemaining),
            0
          );

          await tx.rolloverBucket.updateMany({
            where: {
              retainerId: retainer.id,
              status: "ACTIVE"
            },
            data: {
              status: "EXPIRED",
              hoursRemaining: 0
            }
          });

          if (expiredRolledHours > 0) {
            await tx.retainerLedgerEntry.create({
              data: {
                retainerPeriodId: period.id,
                entryType: "MONTH_RECONCILIATION",
                hoursDelta: -expiredRolledHours,
                createdBy: input.actor,
                metadata: { reason: "expired: period ended in borrow" }
              }
            });
          }
        }

        await expirePassedRolloverBuckets(
          tx,
          retainer.id,
          now,
          period.id,
          input.actor
        );

        if (rolledOutHours > 0) {
          await tx.rolloverBucket.create({
            data: {
              retainerId: retainer.id,
              hoursOriginal: rolledOutHours,
              hoursRemaining: rolledOutHours,
              earnMonth: period.periodMonth,
              expiresAt: addDaysUtc(period.periodMonth, rolloverExpiryDays)
            }
          });
        }

        if (expiredTopUpHours > 0) {
          await tx.retainerLedgerEntry.create({
            data: {
              retainerPeriodId: period.id,
              entryType: "MONTH_RECONCILIATION",
              hoursDelta: -expiredTopUpHours,
              createdBy: input.actor,
              metadata: { reason: "expired: unused top-up hours at month-end" }
            }
          });
        }

        const activeBuckets = await tx.rolloverBucket.findMany({
          where: {
            retainerId: retainer.id,
            status: "ACTIVE",
            hoursRemaining: { gt: 0 },
            expiresAt: { gt: nextPeriodMonth }
          }
        });
        const rolledInHours = Math.floor(
          activeBuckets.reduce(
            (total, bucket) => total + decimalToNumber(bucket.hoursRemaining),
            0
          )
        );

        await tx.retainerPeriod.update({
          where: { id: period.id },
          data: {
            status: "CLOSED",
            rolledOutHours
          }
        });

        await tx.retainerPeriod.upsert({
          where: {
            retainerId_periodMonth: {
              retainerId: retainer.id,
              periodMonth: nextPeriodMonth
            }
          },
          update: {},
          create: {
            retainerId: retainer.id,
            periodMonth: nextPeriodMonth,
            blockHours: nextBlockHours,
            rolledInHours
          }
        });

          await tx.retainerLedgerEntry.create({
            data: {
              retainerPeriodId: period.id,
              entryType: "MONTH_RECONCILIATION",
              hoursDelta: 0,
              createdBy: input.actor,
              metadata: {
                reason: "period closed",
                rolledOutHours,
                borrowedFromNext,
                nextBlockHours,
                rolledInHours
              }
            }
          });
        },
        {
          maxWait: 10_000,
          timeout: 30_000
        }
      );
    }
  }

  const overageRecommendations = await buildOverageRecommendations();

  return {
    dryRun: Boolean(input.dryRun),
    currentMonth: currentMonth.toISOString(),
    actions: dryRunActions,
    overageRecommendations
  };
}

async function buildOverageRecommendations() {
  const retainers = await prisma.retainer.findMany({
    where: { status: "ACTIVE" },
    include: {
      client: { select: { name: true } },
      periods: {
        where: { status: "CLOSED" },
        orderBy: { periodMonth: "desc" },
        take: 6
      }
    }
  });

  return retainers
    .map((retainer) => {
      const recent = retainer.periods;
      const overageFlags = recent.map((period) => period.overageHours > 0);
      const twoConsecutive =
        overageFlags[0] === true && overageFlags[1] === true;
      const threeInSix = overageFlags.filter(Boolean).length >= 3;

      if (!twoConsecutive && !threeInSix) {
        return null;
      }

      const suggestedBlockSize = Math.ceil(retainer.blockSize * 1.2);
      return {
        retainerId: retainer.id,
        clientName: retainer.client.name,
        currentBlockSize: retainer.blockSize,
        suggestedBlockSize,
        message: `Suggest increasing ${retainer.client.name}'s retainer from ${retainer.blockSize}h to ${suggestedBlockSize}h.`
      };
    })
    .filter(
      (recommendation): recommendation is NonNullable<typeof recommendation> =>
        Boolean(recommendation)
    );
}
