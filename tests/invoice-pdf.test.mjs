import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";

const { renderInvoicePdf } = await import("../apps/api/dist/invoicePdf.js");

const sampleInvoice = {
  reference: "INV-20260602-ABC123",
  currency: "ZAR",
  issueDate: "2026-06-02T00:00:00.000Z",
  dueDate: "2026-06-16T00:00:00.000Z",
  amount: 7000,
  notes: "Thanks for your business.",
  client: { id: "client-1", name: "Acme (Pty) Ltd" },
  championContact: { id: "c1", firstName: "Sam", lastName: "Lee", email: "sam@acme.test", title: "Ops Lead" },
  billToEntity: { id: "bte-1", name: "Acme (Pty) Ltd", type: "CLIENT" },
  lineItems: [
    { id: "l1", description: "Discovery", quantity: 2, unitPrice: 1500, lineTotal: 3000, sortOrder: 0 },
    { id: "l2", description: "Build", quantity: 1, unitPrice: 4000, lineTotal: 4000, sortOrder: 1 }
  ]
};

test("renderInvoicePdf returns a non-empty PDF buffer", async () => {
  const buffer = await renderInvoicePdf(sampleInvoice);
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 500);
  assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
});
