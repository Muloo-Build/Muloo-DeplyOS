import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";

const { computeInvoiceTotals, generateInvoiceReference, createManualInvoiceRecord } = await import(
  "../apps/api/dist/billing.js"
);
const { prisma } = await import("../apps/api/dist/prisma.js");

test("computeInvoiceTotals returns per-line totals and a summed amount", () => {
  const result = computeInvoiceTotals([
    { description: "Discovery", quantity: 2, unitPrice: 1500 },
    { description: "Build", quantity: 1, unitPrice: 4000 }
  ]);
  assert.equal(result.amount, 7000);
  assert.equal(result.lines.length, 2);
  assert.equal(result.lines[0].lineTotal, 3000);
  assert.equal(result.lines[0].sortOrder, 0);
  assert.equal(result.lines[1].lineTotal, 4000);
  assert.equal(result.lines[1].sortOrder, 1);
});

test("computeInvoiceTotals rounds line totals to 2 decimals", () => {
  const result = computeInvoiceTotals([
    { description: "Hours", quantity: 1.5, unitPrice: 1666.667 }
  ]);
  assert.equal(result.lines[0].lineTotal, 2500.0);
  assert.equal(result.amount, 2500.0);
});

test("generateInvoiceReference produces an INV-dated prefix", () => {
  const ref = generateInvoiceReference(new Date("2026-06-02T10:00:00Z"), "abc123");
  assert.equal(ref, "INV-20260602-ABC123");
});

function stubTransaction(captured) {
  const tx = {
    billToEntity: {
      findFirst: async () => ({ id: "bte-1", name: "Acme", type: "CLIENT", clientId: "client-1" }),
      create: async () => ({ id: "bte-1" })
    },
    client: { findUnique: async () => ({ id: "client-1", name: "Acme" }) },
    clientContact: {
      findFirst: async () => ({ id: "champ-1", clientId: "client-1", firstName: "Sam", lastName: "Lee", email: "sam@acme.test" })
    },
    invoice: {
      create: async (args) => {
        captured.create = args;
        const now = new Date();
        return { ...args.data, id: "inv-1", lineItems: [], billToEntity: null, retainer: null, retainerPeriod: null, client: null, championContact: null, createdAt: now, updatedAt: now, sentAt: null, paidAt: null, xeroUrl: null };
      }
    }
  };
  return tx;
}

test("createManualInvoiceRecord computes amount and creates a MANUAL invoice", async (t) => {
  const captured = {};
  const original = prisma.$transaction;
  prisma.$transaction = async (fn) => fn(stubTransaction(captured));
  t.after(() => { prisma.$transaction = original; });

  await createManualInvoiceRecord(
    {
      clientId: "client-1",
      championContactId: "champ-1",
      issueDate: "2026-06-02",
      currency: "ZAR",
      lineItems: [
        { description: "Discovery", quantity: 2, unitPrice: 1500 },
        { description: "Build", quantity: 1, unitPrice: 4000 }
      ]
    },
    "user-1"
  );

  assert.equal(Number(captured.create.data.amount), 7000);
  assert.equal(captured.create.data.origin, "MANUAL");
  assert.equal(captured.create.data.invoiceType, "OTHER");
  assert.equal(captured.create.data.clientId, "client-1");
  assert.equal(captured.create.data.championContactId, "champ-1");
  assert.equal(captured.create.data.lineItems.create.length, 2);
});

test("createManualInvoiceRecord rejects an empty line-item list", async () => {
  await assert.rejects(
    () => createManualInvoiceRecord(
      { clientId: "client-1", issueDate: "2026-06-02", lineItems: [] },
      "user-1"
    ),
    (error) => error?.name === "ZodError"
  );
});
