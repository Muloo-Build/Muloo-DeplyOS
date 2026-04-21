import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";

const retainers = await import("../apps/api/dist/retainers.js");

test("retainer rate lookup keeps Consulting flat at R2,200", () => {
  assert.equal(
    retainers.deriveRetainerRate({
      serviceLine: "CONSULTING",
      blockSize: 10,
      currency: "ZAR"
    }),
    2200
  );
  assert.equal(
    retainers.deriveRetainerRate({
      serviceLine: "CONSULTING",
      blockSize: 200,
      currency: "ZAR"
    }),
    2200
  );
});

test("Technical Delivery rate bands still discount by block size", () => {
  assert.equal(
    retainers.deriveRetainerRate({
      serviceLine: "TECHNICAL_DELIVERY",
      blockSize: 40,
      currency: "ZAR"
    }),
    1700
  );
  assert.equal(
    retainers.deriveRetainerRate({
      serviceLine: "TECHNICAL_DELIVERY",
      blockSize: 75,
      currency: "ZAR"
    }),
    1615
  );
  assert.equal(
    retainers.deriveRetainerRate({
      serviceLine: "TECHNICAL_DELIVERY",
      blockSize: 125,
      currency: "ZAR"
    }),
    1564
  );
  assert.equal(
    retainers.deriveRetainerRate({
      serviceLine: "TECHNICAL_DELIVERY",
      blockSize: 151,
      currency: "ZAR"
    }),
    1530
  );
});

test("borrow and roll-over caps round down", () => {
  assert.equal(retainers.getBorrowForwardCap(42), 10);
  assert.equal(retainers.getRolloverCap(42), 10);
});

test("overage threshold includes block, rolled-in hours, and borrow cap", () => {
  assert.equal(
    retainers.getOverageTriggerHours({
      blockHours: 40,
      rolledInHours: 5
    }),
    55
  );
});

test("current balance accounts for top-ups, consumption, and prior borrow", () => {
  assert.equal(
    retainers.calculateCurrentRetainerBalance({
      blockHours: 30,
      rolledInHours: 4,
      approvedTopUpHours: 10,
      consumedHours: 21.5,
      borrowedFromNext: 3
    }),
    19.5
  );
});

test("roll-over calculation caps unused block plus rolled-in hours", () => {
  assert.equal(
    retainers.calculateRolledOutHours({
      blockHours: 40,
      rolledInHours: 8,
      consumedHours: 30
    }),
    10
  );
  assert.equal(
    retainers.calculateRolledOutHours({
      blockHours: 40,
      rolledInHours: 0,
      consumedHours: 35
    }),
    5
  );
});

test("rolled hours are consumed FIFO by earliest expiry", () => {
  const breakdown = retainers.calculateConsumptionBucketBreakdown({
    hoursToConsume: 8,
    rolloverBuckets: [
      {
        id: "newer",
        hoursRemaining: 5,
        expiresAt: new Date("2026-08-01T00:00:00.000Z")
      },
      {
        id: "oldest",
        hoursRemaining: 3,
        expiresAt: new Date("2026-06-01T00:00:00.000Z")
      },
      {
        id: "middle",
        hoursRemaining: 2,
        expiresAt: new Date("2026-07-01T00:00:00.000Z")
      }
    ]
  });

  assert.deepEqual(
    breakdown.rollover.map((item) => [item.bucketId, item.hours]),
    [
      ["oldest", 3],
      ["middle", 2],
      ["newer", 3]
    ]
  );
  assert.equal(breakdown.currentBlockHours, 0);
});

test("operator override validation enforces caps and reason threshold", () => {
  assert.doesNotThrow(() =>
    retainers.validateBilledHoursOverride({
      plannedHours: 4,
      billedHours: 0,
      overrideReason: "Gratis make-good."
    })
  );
  assert.throws(
    () =>
      retainers.validateBilledHoursOverride({
        plannedHours: 4,
        billedHours: 8.5
      }),
    /2x planned/
  );
  assert.throws(
    () =>
      retainers.validateBilledHoursOverride({
        plannedHours: 4,
        billedHours: 2
      }),
    /Override reason/
  );
  assert.doesNotThrow(() =>
    retainers.validateBilledHoursOverride({
      plannedHours: 4,
      billedHours: 2,
      overrideReason: "Reduced after operator review."
    })
  );
});
