import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";

const { computeInvoiceTotals, generateInvoiceReference } = await import(
  "../apps/api/dist/billing.js"
);

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
