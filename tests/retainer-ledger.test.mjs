import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

process.env.NODE_ENV = "test";

const { prisma } = await import("../apps/api/dist/prisma.js");
const {
  RetainerOverageError,
  approveRetainerTopUp,
  approveTaskToBill,
  consumeHours,
  reconcileRetainers
} = await import("../apps/api/dist/retainerLedger.js");

const restorers = [];

afterEach(() => {
  while (restorers.length > 0) {
    const restore = restorers.pop();
    restore?.();
  }
});

function replace(target, key, value) {
  const original = target[key];
  target[key] = value;
  restorers.push(() => {
    target[key] = original;
  });
}

function createBaseTask(overrides = {}) {
  return {
    id: "task-1",
    projectId: "project-1",
    status: "COMPLETE",
    plannedHours: 8,
    billApprovedAt: null,
    assigneeType: "User",
    executionType: "human",
    executionJobs: [],
    project: {
      retainer: {
        id: "retainer-1",
        status: "ACTIVE",
        serviceLine: "TECHNICAL_DELIVERY",
        blockSize: 40,
        currency: "ZAR",
        rate: 1700
      }
    },
    ...overrides
  };
}

function createOpenPeriod(overrides = {}) {
  return {
    id: "period-1",
    retainerId: "retainer-1",
    periodMonth: new Date("2026-04-01T00:00:00.000Z"),
    blockHours: 40,
    rolledInHours: 0,
    borrowedFromNext: 0,
    borrowActive: false,
    consumedHours: 0,
    overageHours: 0,
    rolledOutHours: 0,
    status: "OPEN",
    topUps: [],
    ...overrides
  };
}

test("consumeHours decrements rollover buckets FIFO and marks exhausted buckets consumed", async () => {
  const bucketUpdates = [];
  const tx = {
    rolloverBucket: {
      findMany: async () => [
        {
          id: "bucket-oldest",
          expiresAt: new Date("2026-05-01T00:00:00.000Z"),
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          hoursRemaining: 3,
          status: "ACTIVE"
        },
        {
          id: "bucket-newer",
          expiresAt: new Date("2026-06-01T00:00:00.000Z"),
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          hoursRemaining: 5,
          status: "ACTIVE"
        }
      ],
      update: async (payload) => {
        bucketUpdates.push(payload);
        return payload;
      }
    }
  };

  const result = await consumeHours({
    tx,
    retainerPeriodId: "period-1",
    retainerId: "retainer-1",
    hoursToConsume: 6
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.bucketBreakdown.rollover, [
    {
      bucketId: "bucket-oldest",
      hours: 3,
      expiresAt: "2026-05-01T00:00:00.000Z"
    },
    {
      bucketId: "bucket-newer",
      hours: 3,
      expiresAt: "2026-06-01T00:00:00.000Z"
    }
  ]);
  assert.equal(result.bucketBreakdown.currentBlockHours, 0);
  assert.deepEqual(bucketUpdates, [
    {
      where: { id: "bucket-oldest" },
      data: { hoursRemaining: 0, status: "CONSUMED" }
    },
    {
      where: { id: "bucket-newer" },
      data: { hoursRemaining: 2, status: "ACTIVE" }
    }
  ]);
});

test("approveTaskToBill creates a ledger entry and applies a valid operator override", async () => {
  const taskUpdates = [];
  const periodUpdates = [];
  const ledgerCreates = [];
  const auditCreates = [];

  replace(prisma, "$transaction", async (callback) =>
    callback({
      task: {
        findUnique: async () => createBaseTask(),
        update: async (payload) => {
          taskUpdates.push(payload);
          return { id: "task-1", ...payload.data };
        }
      },
      retainerPeriod: {
        findUnique: async () =>
          createOpenPeriod({
            rolledInHours: 5,
            consumedHours: 38
          }),
        update: async (payload) => {
          periodUpdates.push(payload);
          return createOpenPeriod({
            rolledInHours: 5,
            consumedHours: 42,
            topUps: [],
            borrowedFromNext: payload.data.borrowedFromNext,
            borrowActive: payload.data.borrowActive
          });
        }
      },
      rolloverBucket: {
        findMany: async () => [],
        update: async (payload) => payload
      },
      retainerTopUp: {
        findFirst: async () => null,
        create: async () => {
          throw new Error("should not create top-up");
        }
      },
      retainerLedgerEntry: {
        create: async (payload) => {
          ledgerCreates.push(payload);
          return {
            id: "ledger-1",
            retainerPeriodId: "period-1",
            taskId: "task-1",
            entryType: "TASK_CONSUMPTION",
            hoursDelta: -4,
            plannedHours: 8,
            billedHours: 4,
            producedBy: "HUMAN",
            overrideReason: "Reduced after review",
            metadata: payload.data.metadata,
            createdBy: "user-1",
            createdAt: new Date("2026-04-22T08:00:00.000Z")
          };
        }
      },
      auditLog: {
        create: async (payload) => {
          auditCreates.push(payload);
          return payload;
        }
      }
    })
  );

  const result = await approveTaskToBill({
    taskId: "task-1",
    actor: "operator@example.com",
    userId: "user-1",
    payload: {
      billedHours: 4,
      overrideReason: "Reduced after review",
      now: "2026-04-22T08:00:00.000Z"
    }
  });

  assert.equal(result.taskId, "task-1");
  assert.equal(result.ledgerEntry.billedHours, 4);
  assert.equal(result.ledgerEntry.overrideReason, "Reduced after review");
  assert.equal(result.retainerPeriod.balance, 3);
  assert.equal(taskUpdates[0].data.billableHours, 4);
  assert.equal(periodUpdates[0].data.borrowedFromNext, 0);
  assert.equal(periodUpdates[0].data.borrowActive, false);
  assert.equal(ledgerCreates[0].data.producedBy, "HUMAN");
  assert.deepEqual(
    ledgerCreates[0].data.metadata.bucketBreakdown,
    {
      rollover: [],
      currentBlockHours: 4
    }
  );
  assert.equal(auditCreates[0].data.action, "retainer.task_approved_to_bill");
});

test("approveTaskToBill marks agent-produced work as AGENT", async () => {
  let ledgerCreate;

  replace(prisma, "$transaction", async (callback) =>
    callback({
      task: {
        findUnique: async () =>
          createBaseTask({
            assigneeType: "Agent",
            executionType: "agent",
            executionJobs: [{ executionTier: 2, executionMethod: "agent-run" }]
          }),
        update: async (payload) => ({ id: "task-1", ...payload.data })
      },
      retainerPeriod: {
        findUnique: async () => createOpenPeriod(),
        update: async (payload) =>
          createOpenPeriod({
            consumedHours: 8,
            borrowedFromNext: payload.data.borrowedFromNext,
            borrowActive: payload.data.borrowActive
          })
      },
      rolloverBucket: {
        findMany: async () => [],
        update: async (payload) => payload
      },
      retainerTopUp: {
        findFirst: async () => null
      },
      retainerLedgerEntry: {
        create: async (payload) => {
          ledgerCreate = payload;
          return {
            id: "ledger-1",
            retainerPeriodId: "period-1",
            taskId: "task-1",
            entryType: "TASK_CONSUMPTION",
            hoursDelta: -8,
            plannedHours: 8,
            billedHours: 8,
            producedBy: "AGENT",
            overrideReason: null,
            metadata: payload.data.metadata,
            createdBy: "agent-approver",
            createdAt: new Date("2026-04-22T08:00:00.000Z")
          };
        }
      },
      auditLog: {
        create: async () => null
      }
    })
  );

  const result = await approveTaskToBill({
    taskId: "task-1",
    actor: "agent-approver",
    payload: {
      now: "2026-04-22T08:00:00.000Z"
    }
  });

  assert.equal(result.ledgerEntry.producedBy, "AGENT");
  assert.equal(ledgerCreate.data.producedBy, "AGENT");
});

test("approveTaskToBill marks coworked execution as HYBRID", async () => {
  let ledgerCreate;

  replace(prisma, "$transaction", async (callback) =>
    callback({
      task: {
        findUnique: async () =>
          createBaseTask({
            executionType: "cowork",
            executionJobs: [{ executionTier: 3, executionMethod: "hybrid-review" }]
          }),
        update: async (payload) => ({ id: "task-1", ...payload.data })
      },
      retainerPeriod: {
        findUnique: async () => createOpenPeriod(),
        update: async (payload) =>
          createOpenPeriod({
            consumedHours: 8,
            borrowedFromNext: payload.data.borrowedFromNext,
            borrowActive: payload.data.borrowActive
          })
      },
      rolloverBucket: {
        findMany: async () => [],
        update: async (payload) => payload
      },
      retainerTopUp: {
        findFirst: async () => null
      },
      retainerLedgerEntry: {
        create: async (payload) => {
          ledgerCreate = payload;
          return {
            id: "ledger-1",
            retainerPeriodId: "period-1",
            taskId: "task-1",
            entryType: "TASK_CONSUMPTION",
            hoursDelta: -8,
            plannedHours: 8,
            billedHours: 8,
            producedBy: "HYBRID",
            overrideReason: null,
            metadata: payload.data.metadata,
            createdBy: "hybrid-approver",
            createdAt: new Date("2026-04-22T08:00:00.000Z")
          };
        }
      },
      auditLog: {
        create: async () => null
      }
    })
  );

  const result = await approveTaskToBill({
    taskId: "task-1",
    actor: "hybrid-approver",
    payload: {
      now: "2026-04-22T08:00:00.000Z"
    }
  });

  assert.equal(result.ledgerEntry.producedBy, "HYBRID");
  assert.equal(ledgerCreate.data.producedBy, "HYBRID");
});

test("approveTaskToBill accepts tasks without a retainer and records billing only on the task", async () => {
  const taskUpdates = [];

  replace(prisma, "$transaction", async (callback) =>
    callback({
      task: {
        findUnique: async () =>
          createBaseTask({
            project: { retainer: null }
          }),
        update: async (payload) => {
          taskUpdates.push(payload);
          return { id: "task-1", ...payload.data };
        }
      }
    })
  );

  const result = await approveTaskToBill({
    taskId: "task-1",
    actor: "operator@example.com",
    payload: {
      billedHours: 6,
      now: "2026-04-22T08:00:00.000Z"
    }
  });

  assert.equal(result.ledgerEntry, null);
  assert.equal(result.retainerPeriod, null);
  assert.equal(taskUpdates[0].data.billableHours, 6);
});

test("approveTaskToBill rejects overrides above 2x planned hours", async () => {
  replace(prisma, "$transaction", async (callback) =>
    callback({
      task: {
        findUnique: async () => createBaseTask()
      }
    })
  );

  await assert.rejects(
    approveTaskToBill({
      taskId: "task-1",
      actor: "operator@example.com",
      payload: {
        billedHours: 17,
        now: "2026-04-22T08:00:00.000Z"
      }
    }),
    /2x planned/
  );
});

test("approveTaskToBill requires a reason when the override differs by more than 25%", async () => {
  replace(prisma, "$transaction", async (callback) =>
    callback({
      task: {
        findUnique: async () => createBaseTask()
      }
    })
  );

  await assert.rejects(
    approveTaskToBill({
      taskId: "task-1",
      actor: "operator@example.com",
      payload: {
        billedHours: 4,
        now: "2026-04-22T08:00:00.000Z"
      }
    }),
    /Override reason/
  );
});

test("approveTaskToBill only activates borrow-forward after included hours are exhausted", async () => {
  const borrowUpdates = [];

  replace(prisma, "$transaction", async (callback) =>
    callback({
      task: {
        findUnique: async () => createBaseTask({ plannedHours: 5 }),
        update: async (payload) => ({ id: "task-1", ...payload.data })
      },
      retainerPeriod: {
        findUnique: async () =>
          createOpenPeriod({
            rolledInHours: 5,
            consumedHours: 40
          }),
        update: async (payload) => {
          borrowUpdates.push(payload);
          return createOpenPeriod({
            rolledInHours: 5,
            consumedHours: 45,
            borrowedFromNext: payload.data.borrowedFromNext,
            borrowActive: payload.data.borrowActive
          });
        }
      },
      rolloverBucket: {
        findMany: async () => [],
        update: async (payload) => payload
      },
      retainerTopUp: {
        findFirst: async () => null
      },
      retainerLedgerEntry: {
        create: async (payload) => ({
          id: "ledger-1",
          retainerPeriodId: "period-1",
          taskId: "task-1",
          entryType: "TASK_CONSUMPTION",
          hoursDelta: -5,
          plannedHours: 5,
          billedHours: 5,
          producedBy: "HUMAN",
          overrideReason: null,
          metadata: payload.data.metadata,
          createdBy: "operator@example.com",
          createdAt: new Date("2026-04-22T08:00:00.000Z")
        })
      },
      auditLog: {
        create: async () => null
      }
    })
  );

  const result = await approveTaskToBill({
    taskId: "task-1",
    actor: "operator@example.com",
    payload: {
      now: "2026-04-22T08:00:00.000Z"
    }
  });

  assert.equal(result.retainerPeriod.borrowedFromNext, 0);
  assert.equal(result.retainerPeriod.borrowActive, false);
  assert.equal(borrowUpdates[0].data.borrowedFromNext, 0);
});

test("approveTaskToBill sets borrow-forward when consumption crosses the included-hour threshold", async () => {
  const periodUpdates = [];

  replace(prisma, "$transaction", async (callback) =>
    callback({
      task: {
        findUnique: async () => createBaseTask({ plannedHours: 1 }),
        update: async (payload) => ({ id: "task-1", ...payload.data })
      },
      retainerPeriod: {
        findUnique: async () =>
          createOpenPeriod({
            rolledInHours: 5,
            consumedHours: 45
          }),
        update: async (payload) => {
          periodUpdates.push(payload);
          return createOpenPeriod({
            rolledInHours: 5,
            consumedHours: 46,
            borrowedFromNext: payload.data.borrowedFromNext,
            borrowActive: payload.data.borrowActive
          });
        }
      },
      rolloverBucket: {
        findMany: async () => [],
        update: async (payload) => payload
      },
      retainerTopUp: {
        findFirst: async () => null
      },
      retainerLedgerEntry: {
        create: async (payload) => ({
          id: "ledger-1",
          retainerPeriodId: "period-1",
          taskId: "task-1",
          entryType: "TASK_CONSUMPTION",
          hoursDelta: -1,
          plannedHours: 1,
          billedHours: 1,
          producedBy: "HUMAN",
          overrideReason: null,
          metadata: payload.data.metadata,
          createdBy: "operator@example.com",
          createdAt: new Date("2026-04-22T08:00:00.000Z")
        })
      },
      auditLog: {
        create: async () => null
      }
    })
  );

  const result = await approveTaskToBill({
    taskId: "task-1",
    actor: "operator@example.com",
    payload: {
      now: "2026-04-22T08:00:00.000Z"
    }
  });

  assert.equal(result.retainerPeriod.borrowedFromNext, 1);
  assert.equal(result.retainerPeriod.borrowActive, true);
  assert.equal(periodUpdates[0].data.borrowedFromNext, 1);
});

test("approveTaskToBill rejects borrow-forward once the cap is exceeded and creates a top-up at the base ZAR rate", async () => {
  let createdTopUp;

  replace(prisma, "$transaction", async (callback) =>
    callback({
      task: {
        findUnique: async () =>
          createBaseTask({
            plannedHours: 1,
            project: {
              retainer: {
                id: "retainer-1",
                status: "ACTIVE",
                serviceLine: "TECHNICAL_DELIVERY",
                blockSize: 151,
                currency: "ZAR",
                rate: 1530
              }
            }
          })
      },
      retainerPeriod: {
        findUnique: async () =>
          createOpenPeriod({
            consumedHours: 50
          })
      },
      rolloverBucket: {
        findMany: async () => []
      },
      retainerTopUp: {
        findFirst: async () => null,
        create: async (payload) => {
          createdTopUp = payload;
          return {
            id: "top-up-1",
            ...payload.data
          };
        }
      }
    })
  );

  await assert.rejects(
    approveTaskToBill({
      taskId: "task-1",
      actor: "operator@example.com",
      payload: {
        now: "2026-04-22T08:00:00.000Z"
      }
    }),
    (error) => {
      assert.equal(error instanceof RetainerOverageError, true);
      assert.deepEqual(error.payload, {
        error: "overage_requires_topup",
        shortfall: 11,
        borrowCapRemaining: 0,
        suggestedTopUpHours: 10,
        topUpId: "top-up-1"
      });
      return true;
    }
  );

  assert.equal(createdTopUp.data.rate, 1700);
  assert.equal(createdTopUp.data.hours, 10);
});

test("approveTaskToBill preserves the locked FX ratio for non-ZAR top-up quotes", async () => {
  let createdTopUp;

  replace(prisma, "$transaction", async (callback) =>
    callback({
      task: {
        findUnique: async () =>
          createBaseTask({
            plannedHours: 1,
            project: {
              retainer: {
                id: "retainer-1",
                status: "ACTIVE",
                serviceLine: "TECHNICAL_DELIVERY",
                blockSize: 75,
                currency: "USD",
                rate: 90
              }
            }
          })
      },
      retainerPeriod: {
        findUnique: async () =>
          createOpenPeriod({
            consumedHours: 50
          })
      },
      rolloverBucket: {
        findMany: async () => []
      },
      retainerTopUp: {
        findFirst: async () => null,
        create: async (payload) => {
          createdTopUp = payload;
          return {
            id: "top-up-usd",
            ...payload.data
          };
        }
      }
    })
  );

  await assert.rejects(
    approveTaskToBill({
      taskId: "task-1",
      actor: "operator@example.com",
      payload: {
        now: "2026-04-22T08:00:00.000Z"
      }
    }),
    RetainerOverageError
  );

  assert.equal(createdTopUp.data.rate, 94.74);
});

test("approveTaskToBill reuses an existing quoted top-up when overage recurs", async () => {
  let createCalled = false;

  replace(prisma, "$transaction", async (callback) =>
    callback({
      task: {
        findUnique: async () =>
          createBaseTask({
            plannedHours: 1
          })
      },
      retainerPeriod: {
        findUnique: async () =>
          createOpenPeriod({
            consumedHours: 50
          })
      },
      rolloverBucket: {
        findMany: async () => []
      },
      retainerTopUp: {
        findFirst: async () => ({ id: "existing-top-up" }),
        create: async () => {
          createCalled = true;
          throw new Error("should not create a new top-up");
        }
      }
    })
  );

  await assert.rejects(
    approveTaskToBill({
      taskId: "task-1",
      actor: "operator@example.com",
      payload: {
        now: "2026-04-22T08:00:00.000Z"
      }
    }),
    (error) => {
      assert.equal(error.payload.topUpId, "existing-top-up");
      return true;
    }
  );

  assert.equal(createCalled, false);
});

test("approveRetainerTopUp approves a quoted top-up and records the ledger entry", async () => {
  const updateCalls = [];

  replace(prisma, "$transaction", async (callback) =>
    callback({
      retainerTopUp: {
        findUnique: async () => ({
          id: "top-up-1",
          retainerPeriodId: "period-1",
          status: "QUOTED",
          hours: 10,
          rate: 95,
          retainerPeriod: {
            retainerId: "retainer-1",
            retainer: {
              currency: "USD"
            },
            topUps: []
          }
        }),
        update: async (payload) => ({
          id: "top-up-1",
          status: payload.data.status,
          approvedAt: new Date("2026-04-22T09:00:00.000Z")
        })
      },
      retainerLedgerEntry: {
        create: async (payload) => ({
          id: "ledger-top-up-1",
          retainerPeriodId: payload.data.retainerPeriodId,
          taskId: null,
          entryType: payload.data.entryType,
          hoursDelta: payload.data.hoursDelta,
          plannedHours: null,
          billedHours: null,
          producedBy: null,
          overrideReason: null,
          metadata: payload.data.metadata,
          createdBy: payload.data.createdBy,
          createdAt: new Date("2026-04-22T09:00:00.000Z")
        })
      },
      retainerPeriod: {
        update: async (payload) => {
          updateCalls.push(payload);
          return createOpenPeriod({
            overageHours: 10,
            topUps: [{ hours: 10, status: "APPROVED" }]
          });
        }
      }
    })
  );

  const result = await approveRetainerTopUp({
    retainerId: "retainer-1",
    topUpId: "top-up-1",
    clientUserId: "client-user-1",
    actor: "client-user-1"
  });

  assert.equal(result.topUp.status, "APPROVED");
  assert.equal(result.ledgerEntry.hoursDelta, 10);
  assert.equal(result.ledgerEntry.metadata.rate, 95);
  assert.equal(result.retainerPeriod.overageHours, 10);
  assert.equal(updateCalls[0].data.overageHours.increment, 10);
});

test("approveRetainerTopUp rejects non-quoted top-ups", async () => {
  replace(prisma, "$transaction", async (callback) =>
    callback({
      retainerTopUp: {
        findUnique: async () => ({
          id: "top-up-1",
          status: "APPROVED",
          retainerPeriod: {
            retainerId: "retainer-1",
            retainer: {},
            topUps: []
          }
        })
      }
    })
  );

  await assert.rejects(
    approveRetainerTopUp({
      retainerId: "retainer-1",
      topUpId: "top-up-1",
      actor: "operator@example.com"
    }),
    /not pending approval/
  );
});

test("reconcileRetainers dry-run reports borrow recovery, roll-over, top-up expiry, and overage recommendations", async () => {
  let findManyCalls = 0;

  replace(prisma.retainer, "findMany", async () => {
    findManyCalls += 1;
    if (findManyCalls === 1) {
      return [
        {
          id: "retainer-1",
          blockSize: 40,
          client: { name: "Seed Client" },
          periods: [
            {
              id: "period-1",
              periodMonth: new Date("2026-03-01T00:00:00.000Z"),
              blockHours: 40,
              rolledInHours: 5,
              borrowedFromNext: 5,
              consumedHours: 47,
              overageHours: 10,
              rolledOutHours: 0,
              status: "OPEN",
              topUps: [{ hours: 10, status: "APPROVED" }]
            }
          ]
        }
      ];
    }

    return [
      {
        id: "retainer-1",
        blockSize: 40,
        client: { name: "Seed Client" },
        periods: [
          { overageHours: 10 },
          { overageHours: 10 },
          { overageHours: 0 }
        ]
      }
    ];
  });

  const result = await reconcileRetainers({
    actor: "system",
    dryRun: true,
    now: new Date("2026-04-22T08:00:00.000Z")
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.actions.length, 1);
  assert.deepEqual(result.actions[0], {
    retainerId: "retainer-1",
    clientName: "Seed Client",
    closePeriodId: "period-1",
    periodMonth: "2026-03-01T00:00:00.000Z",
    endedInBorrow: true,
    rolledOutHours: 0,
    borrowedFromNext: 5,
    expiredTopUpHours: 10,
    nextPeriodMonth: "2026-04-01T00:00:00.000Z",
    nextBlockHours: 35
  });
  assert.equal(result.overageRecommendations.length, 1);
  assert.equal(result.overageRecommendations[0].suggestedBlockSize, 48);
});

test("reconcileRetainers skips paused retainers by only reconciling ACTIVE records", async () => {
  let findManyCalls = 0;

  replace(prisma.retainer, "findMany", async () => {
    findManyCalls += 1;
    return [];
  });

  const result = await reconcileRetainers({
    actor: "system",
    dryRun: true,
    now: new Date("2026-04-22T08:00:00.000Z")
  });

  assert.equal(findManyCalls, 2);
  assert.deepEqual(result.actions, []);
  assert.deepEqual(result.overageRecommendations, []);
});

test("reconcileRetainers closes periods once, creates roll-over, and stays idempotent on a second run", async () => {
  let findManyCalls = 0;
  let periodStatus = "OPEN";
  const bucketCreates = [];
  const periodUpdates = [];
  const periodUpserts = [];
  const ledgerCreates = [];

  replace(prisma.retainer, "findMany", async () => {
    findManyCalls += 1;
    if (findManyCalls % 2 === 1) {
      return [
        {
          id: "retainer-1",
          blockSize: 40,
          client: { name: "Seed Client" },
          periods: [
            {
              id: "period-1",
              periodMonth: new Date("2026-03-01T00:00:00.000Z"),
              blockHours: 40,
              rolledInHours: 0,
              borrowedFromNext: 0,
              consumedHours: 35,
              overageHours: 0,
              rolledOutHours: 0,
              status: "OPEN",
              topUps: []
            }
          ]
        }
      ];
    }

    return [];
  });

  replace(prisma, "$transaction", async (callback) =>
    callback({
      retainerPeriod: {
        findUnique: async () => ({
          id: "period-1",
          status: periodStatus
        }),
        update: async (payload) => {
          periodUpdates.push(payload);
          periodStatus = "CLOSED";
          return payload;
        },
        upsert: async (payload) => {
          periodUpserts.push(payload);
          return payload;
        }
      },
      rolloverBucket: {
        findMany: async () => [],
        create: async (payload) => {
          bucketCreates.push(payload);
          return payload;
        }
      },
      retainerLedgerEntry: {
        create: async (payload) => {
          ledgerCreates.push(payload);
          return payload;
        }
      }
    })
  );

  const firstRun = await reconcileRetainers({
    actor: "system",
    now: new Date("2026-04-22T08:00:00.000Z")
  });
  const secondRun = await reconcileRetainers({
    actor: "system",
    now: new Date("2026-04-22T08:00:00.000Z")
  });

  assert.equal(firstRun.actions.length, 1);
  assert.equal(secondRun.actions.length, 1);
  assert.equal(bucketCreates.length, 1);
  assert.equal(periodUpdates.length, 1);
  assert.equal(periodUpserts.length, 1);
  assert.equal(ledgerCreates.length, 1);
  assert.equal(bucketCreates[0].data.hoursOriginal, 5);
  assert.equal(periodUpdates[0].data.rolledOutHours, 5);
});

test("reconcileRetainers expires passed rollover buckets and unused top-up hours at month end", async () => {
  const bucketUpdates = [];
  const ledgerCreates = [];

  replace(prisma.retainer, "findMany", async () => [
    {
      id: "retainer-1",
      blockSize: 40,
      client: { name: "Seed Client" },
      periods: [
        {
          id: "period-1",
          periodMonth: new Date("2026-03-01T00:00:00.000Z"),
          blockHours: 40,
          rolledInHours: 4,
          borrowedFromNext: 0,
          consumedHours: 42,
          overageHours: 10,
          rolledOutHours: 0,
          status: "OPEN",
          topUps: [{ hours: 10, status: "APPROVED" }]
        }
      ]
    },
    {
      id: "retainer-1",
      blockSize: 40,
      client: { name: "Seed Client" },
      periods: []
    }
  ]);

  replace(prisma, "$transaction", async (callback) =>
    callback({
      retainerPeriod: {
        findUnique: async () => ({
          id: "period-1",
          status: "OPEN"
        }),
        update: async (payload) => payload,
        upsert: async (payload) => payload
      },
      rolloverBucket: {
        findMany: async () => [
          {
            id: "expired-bucket",
            hoursRemaining: 4,
            earnMonth: new Date("2025-12-01T00:00:00.000Z"),
            expiresAt: new Date("2026-03-15T00:00:00.000Z"),
            status: "ACTIVE"
          }
        ],
        update: async (payload) => {
          bucketUpdates.push(payload);
          return payload;
        },
        create: async (payload) => payload
      },
      retainerLedgerEntry: {
        create: async (payload) => {
          ledgerCreates.push(payload);
          return payload;
        }
      }
    })
  );

  await reconcileRetainers({
    actor: "system",
    now: new Date("2026-04-22T08:00:00.000Z")
  });

  assert.deepEqual(bucketUpdates[0], {
    where: { id: "expired-bucket" },
    data: { hoursRemaining: 0, status: "EXPIRED" }
  });
  assert.equal(
    ledgerCreates.some(
      (payload) =>
        payload.data.metadata?.reason === "expired: 90-day rollover window elapsed"
    ),
    true
  );
  assert.equal(
    ledgerCreates.some(
      (payload) =>
        payload.data.metadata?.reason === "expired: unused top-up hours at month-end"
    ),
    true
  );
});
