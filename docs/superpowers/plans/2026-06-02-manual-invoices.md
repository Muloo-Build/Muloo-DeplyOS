# Manual Invoices (Xero-down fallback) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator create a standalone, itemized invoice in Deploy OS (linked to a Client + champion, optional retainer) and download it as a branded PDF when Xero is unavailable.

**Architecture:** Extend the existing `Invoice` model (`retainerId` becomes optional; add `clientId`, `championContactId`, `origin`, and an `InvoiceLineItem` child table). Add `createManualInvoiceRecord` + a pdfkit-rendered `GET /api/invoices/:id/pdf` endpoint in the API. Add a "New invoice" form to `InvoicesWorkspace` and a "Download PDF" button to `InvoiceDetailWorkspace`. Retainer/Xero invoice flow is untouched (`origin` defaults to `RETAINER`).

**Tech Stack:** Prisma 5.22 + Postgres, Hono (API), Next.js/React + Tailwind (web), pdfkit (server PDF), node:test against compiled `dist/`.

---

## File Structure

- `apps/api/prisma/schema.prisma` — Invoice changes, new `InvoiceLineItem` model, new `InvoiceOrigin` enum (modify).
- `apps/api/prisma/migrations/<ts>_manual_invoices/migration.sql` — generated migration (create).
- `apps/api/src/billing.ts` — pure helpers (`computeInvoiceTotals`, `generateInvoiceReference`), `manualInvoiceSchema`, `createManualInvoiceRecord`, extended `serializeInvoice` + `loadInvoiceDetail` include (modify).
- `apps/api/src/invoicePdf.ts` — `MULOO_BILLING_DETAILS` constant + `renderInvoicePdf(invoice): Promise<Buffer>` (create).
- `apps/api/src/app.ts` — wire `POST /api/invoices/manual` and `GET /api/invoices/:invoiceId/pdf` (modify).
- `apps/api/package.json` — add `pdfkit` + `@types/pdfkit` (modify).
- `apps/web/app/components/NewInvoiceDrawer.tsx` — manual-invoice form (create).
- `apps/web/app/components/InvoicesWorkspace.tsx` — "New invoice" button + drawer wiring (modify).
- `apps/web/app/components/InvoiceDetailWorkspace.tsx` — Download PDF button + champion/line-item display (modify).
- `tests/manual-invoices.test.mjs` — helper + create-record unit tests (create).
- `tests/invoice-pdf.test.mjs` — PDF render smoke test (create).

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (Invoice model ~1350-1377, enums ~1613)
- Create: migration via `prisma migrate dev`

- [ ] **Step 1: Add `InvoiceOrigin` enum**

In `apps/api/prisma/schema.prisma`, directly after the `enum InvoiceStatus { ... }` block (ends ~line 1625), add:

```prisma
enum InvoiceOrigin {
  RETAINER
  MANUAL
}
```

- [ ] **Step 2: Make `retainerId` optional and add manual-invoice fields on `Invoice`**

In `model Invoice`, change the retainer linkage and add new fields. Replace these lines:

```prisma
  retainerId       String
```
with:
```prisma
  retainerId       String?
  clientId         String?
  championContactId String?
  origin           InvoiceOrigin    @default(RETAINER)
```

Change the relation line:
```prisma
  retainer         Retainer         @relation(fields: [retainerId], references: [id], onDelete: Cascade)
```
to:
```prisma
  retainer         Retainer?        @relation(fields: [retainerId], references: [id], onDelete: Cascade)
  client           Client?          @relation("ClientInvoices", fields: [clientId], references: [id])
  championContact  ClientContact?   @relation("ChampionInvoices", fields: [championContactId], references: [id])
  lineItems        InvoiceLineItem[]
```

Add an index inside the same model (next to the existing `@@index` lines):
```prisma
  @@index([clientId, issueDate])
```

- [ ] **Step 3: Add the back-relations on `Client` and `ClientContact`**

In `model Client` (starts line 10), add a relation field among its other relations:
```prisma
  invoices                    Invoice[]            @relation("ClientInvoices")
```
In `model ClientContact` (starts line 64), add:
```prisma
  championInvoices            Invoice[]            @relation("ChampionInvoices")
```

- [ ] **Step 4: Add the `InvoiceLineItem` model**

Directly after the `model Invoice { ... }` block (ends ~line 1377), add:

```prisma
model InvoiceLineItem {
  id          String   @id @default(cuid())
  invoiceId   String
  description String
  quantity    Decimal  @db.Decimal(12, 2)
  unitPrice   Decimal  @db.Decimal(12, 2)
  lineTotal   Decimal  @db.Decimal(12, 2)
  sortOrder   Int      @default(0)
  invoice     Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId, sortOrder])
}
```

- [ ] **Step 5: Create the migration**

Run: `cd apps/api && node ../../scripts/run-with-root-env.mjs prisma migrate dev --name manual_invoices`
Expected: migration created and applied; `prisma generate` runs. Existing invoices get `origin = 'RETAINER'` via the column default. Confirm the generated `migration.sql` makes `retainerId` nullable and adds the new columns/table.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(billing): schema for manual invoices (optional retainer, line items, origin)"
```

---

## Task 2: Pure billing helpers — totals + reference

**Files:**
- Modify: `apps/api/src/billing.ts`
- Test: `tests/manual-invoices.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/manual-invoices.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @muloo/api... -r exec true >/dev/null 2>&1; node node_modules/typescript/lib/tsc.js -b apps/api && node --test tests/manual-invoices.test.mjs`
Expected: FAIL — `computeInvoiceTotals is not a function` (not yet exported).

- [ ] **Step 3: Implement the helpers**

In `apps/api/src/billing.ts`, add near the other helpers (after `decimalToNumber`, ~line 84):

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node node_modules/typescript/lib/tsc.js -b apps/api && node --test tests/manual-invoices.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/billing.ts tests/manual-invoices.test.mjs
git commit -m "feat(billing): invoice total + reference helpers"
```

---

## Task 3: `createManualInvoiceRecord` + schema

**Files:**
- Modify: `apps/api/src/billing.ts`
- Test: `tests/manual-invoices.test.mjs` (append)

- [ ] **Step 1: Write the failing test (append to `tests/manual-invoices.test.mjs`)**

Add at the top imports `prisma`, then append the test:

```javascript
const { prisma } = await import("../apps/api/dist/prisma.js");
const { createManualInvoiceRecord } = await import("../apps/api/dist/billing.js");

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
        return { ...args.data, id: "inv-1", lineItems: [], billToEntity: null, retainer: null, retainerPeriod: null, client: null, championContact: null };
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
    )
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node node_modules/typescript/lib/tsc.js -b apps/api && node --test tests/manual-invoices.test.mjs`
Expected: FAIL — `createManualInvoiceRecord is not a function`.

- [ ] **Step 3: Add the schema**

In `apps/api/src/billing.ts`, after `createInvoiceSchema` (~line 47) add:

```typescript
const manualLineItemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.number().finite().positive(),
  unitPrice: z.number().finite().nonnegative()
});

const manualInvoiceSchema = z.object({
  clientId: z.string().trim().min(1),
  retainerId: z.string().trim().min(1).optional().nullable(),
  championContactId: z.string().trim().min(1).optional().nullable(),
  reference: z.string().trim().min(1).optional(),
  currency: z.enum(["ZAR", "USD", "GBP", "EUR", "AUD", "CAD"]).default("ZAR"),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().trim().optional().nullable(),
  lineItems: z.array(manualLineItemSchema).min(1)
});
```

- [ ] **Step 4: Implement `createManualInvoiceRecord`**

In `apps/api/src/billing.ts`, after `createInvoiceRecord` (~line 750) add:

```typescript
export async function createManualInvoiceRecord(payload: unknown, actorId: string) {
  const input = manualInvoiceSchema.parse(payload);
  const { lines, amount } = computeInvoiceTotals(input.lineItems);

  return prisma.$transaction(async (transaction) => {
    const billToEntity = await ensureClientBillToEntity(transaction, input.clientId);

    let currency = input.currency;
    let retainerId: string | null = input.retainerId?.trim() || null;
    if (retainerId) {
      const retainer = await transaction.retainer.findUnique({
        where: { id: retainerId },
        select: { id: true, clientId: true, currency: true }
      });
      if (!retainer || retainer.clientId !== input.clientId) {
        throw new Error("Selected retainer does not belong to this client.");
      }
      currency = retainer.currency;
    }

    const championContactId = input.championContactId?.trim() || null;
    if (championContactId) {
      const champion = await transaction.clientContact.findFirst({
        where: { id: championContactId, clientId: input.clientId },
        select: { id: true }
      });
      if (!champion) {
        throw new Error("Champion contact does not belong to this client.");
      }
    }

    const issueDate = input.issueDate;
    const dueDate = input.dueDate ?? addDays(issueDate, 14);
    const reference =
      input.reference?.trim() || generateInvoiceReference(issueDate, billToEntity.id);

    const invoice = await transaction.invoice.create({
      data: {
        reference,
        billToEntityId: billToEntity.id,
        retainerId,
        retainerPeriodId: null,
        clientId: input.clientId,
        championContactId,
        origin: "MANUAL",
        invoiceType: "OTHER",
        amount,
        currency,
        issueDate,
        dueDate,
        status: "DRAFT",
        notes: input.notes?.trim() || null,
        createdByUserId: actorId,
        lineItems: {
          create: lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            sortOrder: line.sortOrder
          }))
        }
      },
      include: {
        billToEntity: { select: { id: true, name: true, type: true } },
        retainer: { include: { client: { select: { id: true, name: true } } } },
        retainerPeriod: { select: { id: true, periodMonth: true, blockHours: true } },
        client: { select: { id: true, name: true } },
        championContact: {
          select: { id: true, firstName: true, lastName: true, email: true, title: true }
        },
        lineItems: { orderBy: { sortOrder: "asc" } }
      }
    });

    return serializeInvoice(invoice);
  });
}
```

Note: `serializeInvoice` is extended in Task 4 to accept the new `client`, `championContact`, and `lineItems` includes. Until then it ignores them (extra fields are fine for the schema parse; the test stubs `invoice.create`).

- [ ] **Step 5: Run test to verify it passes**

Run: `node node_modules/typescript/lib/tsc.js -b apps/api && node --test tests/manual-invoices.test.mjs`
Expected: PASS (5 tests total).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/billing.ts tests/manual-invoices.test.mjs
git commit -m "feat(billing): createManualInvoiceRecord with line items + validation"
```

---

## Task 4: Extend `serializeInvoice` + `loadInvoiceDetail`

**Files:**
- Modify: `apps/api/src/billing.ts` (`serializeInvoice` ~150-245, `loadInvoiceDetail` ~789)

- [ ] **Step 1: Extend the `serializeInvoice` input type and output**

In `serializeInvoice` (~line 150), add optional fields to the generic input type alongside the existing `billToEntity`/`retainer` optionals:

```typescript
    origin?: string;
    clientId?: string | null;
    championContactId?: string | null;
    client?: { id: string; name: string } | null;
    championContact?: {
      id: string;
      firstName: string;
      lastName: string | null;
      email: string;
      title: string | null;
    } | null;
    lineItems?: Array<{
      id: string;
      description: string;
      quantity: unknown;
      unitPrice: unknown;
      lineTotal: unknown;
      sortOrder: number;
    }>;
```

In the returned object (after the existing `retainerPeriod` mapping, before the closing brace ~line 245), add:

```typescript
    origin: invoice.origin ?? "RETAINER",
    clientId: invoice.clientId ?? null,
    client: invoice.client ? { id: invoice.client.id, name: invoice.client.name } : null,
    championContact: invoice.championContact
      ? {
          id: invoice.championContact.id,
          firstName: invoice.championContact.firstName,
          lastName: invoice.championContact.lastName,
          email: invoice.championContact.email,
          title: invoice.championContact.title
        }
      : null,
    lineItems: (invoice.lineItems ?? []).map((line) => ({
      id: line.id,
      description: line.description,
      quantity: decimalToNumber(line.quantity),
      unitPrice: decimalToNumber(line.unitPrice),
      lineTotal: decimalToNumber(line.lineTotal),
      sortOrder: line.sortOrder
    })),
```

- [ ] **Step 2: Extend the `loadInvoiceDetail` include**

In `loadInvoiceDetail` (~line 791), add to the `include` object alongside `billToEntity`/`retainer`/`retainerPeriod`:

```typescript
      client: { select: { id: true, name: true } },
      championContact: {
        select: { id: true, firstName: true, lastName: true, email: true, title: true }
      },
      lineItems: { orderBy: { sortOrder: "asc" } },
```

- [ ] **Step 3: Build to verify types compile**

Run: `node node_modules/typescript/lib/tsc.js -b apps/api`
Expected: builds clean (no type errors).

- [ ] **Step 4: Run existing tests (regression)**

Run: `node --test tests/manual-invoices.test.mjs tests/retainer-ledger.test.mjs`
Expected: PASS — retainer-driven invoices still serialize (new fields default to null/empty/`RETAINER`).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/billing.ts
git commit -m "feat(billing): expose client, champion, line items, origin in invoice serializer"
```

---

## Task 5: PDF renderer

**Files:**
- Create: `apps/api/src/invoicePdf.ts`
- Modify: `apps/api/package.json`
- Test: `tests/invoice-pdf.test.mjs`

- [ ] **Step 1: Add the pdfkit dependency**

Run: `cd apps/api && pnpm add pdfkit && pnpm add -D @types/pdfkit`
Expected: `pdfkit` in dependencies, `@types/pdfkit` in devDependencies.

- [ ] **Step 2: Write the failing test**

Create `tests/invoice-pdf.test.mjs`:

```javascript
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node node_modules/typescript/lib/tsc.js -b apps/api && node --test tests/invoice-pdf.test.mjs`
Expected: FAIL — cannot find `dist/invoicePdf.js`.

- [ ] **Step 4: Implement the renderer**

Create `apps/api/src/invoicePdf.ts`:

```typescript
import PDFDocument from "pdfkit";

// TODO: confirm Muloo billing + bank details with the user before relying on these.
export const MULOO_BILLING_DETAILS = {
  companyName: "Muloo (Pty) Ltd",
  addressLines: ["TODO: street address", "TODO: city, postal code", "South Africa"],
  registration: "TODO: company registration no.",
  vatNumber: "TODO: VAT number",
  email: "accounts@muloo.co",
  bank: {
    bankName: "TODO: bank name",
    accountName: "TODO: account name",
    accountNumber: "TODO: account number",
    branchCode: "TODO: branch code",
    swift: "TODO: SWIFT/BIC"
  }
};

export interface InvoicePdfData {
  reference: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  notes: string | null;
  client: { id: string; name: string } | null;
  championContact: {
    firstName: string;
    lastName: string | null;
    email: string;
    title: string | null;
  } | null;
  billToEntity: { name: string } | null;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    sortOrder: number;
  }>;
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function renderInvoicePdf(invoice: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const m = MULOO_BILLING_DETAILS;

    // Header
    doc.fontSize(20).fillColor("#101418").text(m.companyName, 50, 50);
    doc.fontSize(9).fillColor("#5b6470");
    m.addressLines.forEach((line) => doc.text(line));
    doc.text(`Reg: ${m.registration}`);
    doc.text(`VAT: ${m.vatNumber}`);
    doc.text(m.email);

    doc.fontSize(22).fillColor("#101418").text("INVOICE", 50, 50, { align: "right" });
    doc.fontSize(10).fillColor("#5b6470");
    doc.text(invoice.reference, { align: "right" });
    doc.text(`Issued: ${shortDate(invoice.issueDate)}`, { align: "right" });
    doc.text(`Due: ${shortDate(invoice.dueDate)}`, { align: "right" });

    // Bill to
    doc.moveDown(2);
    const billY = doc.y;
    doc.fontSize(10).fillColor("#101418").text("Bill to", 50, billY);
    doc.fontSize(11).text(invoice.client?.name ?? invoice.billToEntity?.name ?? "—");
    if (invoice.championContact) {
      const c = invoice.championContact;
      doc.fontSize(9).fillColor("#5b6470");
      doc.text(`${c.firstName} ${c.lastName ?? ""}`.trim() + (c.title ? ` — ${c.title}` : ""));
      doc.text(c.email);
    }

    // Line item table
    doc.moveDown(2);
    let y = doc.y;
    const cols = { desc: 50, qty: 330, unit: 390, total: 480 };
    doc.fontSize(9).fillColor("#5b6470");
    doc.text("Description", cols.desc, y);
    doc.text("Qty", cols.qty, y, { width: 50, align: "right" });
    doc.text("Unit", cols.unit, y, { width: 80, align: "right" });
    doc.text("Total", cols.total, y, { width: 65, align: "right" });
    y += 16;
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#d7dbe0").stroke();
    y += 8;

    doc.fillColor("#101418");
    const ordered = [...invoice.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const line of ordered) {
      doc.fontSize(10);
      doc.text(line.description, cols.desc, y, { width: 270 });
      doc.text(String(line.quantity), cols.qty, y, { width: 50, align: "right" });
      doc.text(money(line.unitPrice, invoice.currency), cols.unit, y, { width: 80, align: "right" });
      doc.text(money(line.lineTotal, invoice.currency), cols.total, y, { width: 65, align: "right" });
      y = doc.y + 6;
    }

    y += 6;
    doc.moveTo(330, y).lineTo(545, y).strokeColor("#d7dbe0").stroke();
    y += 10;
    doc.fontSize(12).fillColor("#101418");
    doc.text("Total", cols.unit, y, { width: 80, align: "right" });
    doc.text(money(invoice.amount, invoice.currency), cols.total, y, { width: 65, align: "right" });

    // Notes + bank
    doc.moveDown(4);
    if (invoice.notes) {
      doc.fontSize(9).fillColor("#5b6470").text("Notes", 50);
      doc.fontSize(10).fillColor("#101418").text(invoice.notes, { width: 495 });
      doc.moveDown(1);
    }
    doc.fontSize(9).fillColor("#5b6470").text("Payment details", 50);
    doc.fontSize(10).fillColor("#101418");
    doc.text(`${m.bank.bankName} — ${m.bank.accountName}`);
    doc.text(`Acc: ${m.bank.accountNumber}  Branch: ${m.bank.branchCode}  SWIFT: ${m.bank.swift}`);
    doc.fontSize(8).fillColor("#9aa1ab").text(`Reference: ${invoice.reference}`);

    doc.end();
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node node_modules/typescript/lib/tsc.js -b apps/api && node --test tests/invoice-pdf.test.mjs`
Expected: PASS — buffer starts with `%PDF-` and length > 500.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/invoicePdf.ts apps/api/package.json pnpm-lock.yaml tests/invoice-pdf.test.mjs
git commit -m "feat(billing): pdfkit invoice PDF renderer with Muloo billing constant"
```

---

## Task 6: Wire API routes

**Files:**
- Modify: `apps/api/src/app.ts` (imports ~55-68; routes near existing invoice routes ~7250-7327)

- [ ] **Step 1: Import the new functions**

In `apps/api/src/app.ts`, in the billing import block (~lines 55-68), add `createManualInvoiceRecord,` and `loadInvoiceDetail` is already imported. Also add at the top of the file with other imports:

```typescript
import { renderInvoicePdf } from "./invoicePdf";
```

And add to the existing `from "./billing"` import list:
```typescript
  createManualInvoiceRecord,
```

- [ ] **Step 2: Add the manual-create route**

Directly after the existing `app.post("/api/invoices", ...)` block (ends ~line 7270), add:

```typescript
  app.post("/api/invoices/manual", async (c) => {
    try {
      const actor = await resolveInternalActor(c.env.incoming);
      return c.json(
        {
          invoice: await createManualInvoiceRecord(
            await readJsonBodyOrEmpty(c),
            actor.actor
          )
        },
        201
      );
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to create invoice"
        },
        400
      );
    }
  });
```

- [ ] **Step 3: Add the PDF route**

Directly after the existing `app.get("/api/invoices/:invoiceId", ...)` block (ends ~line 7307), add:

```typescript
  app.get("/api/invoices/:invoiceId/pdf", async (c) => {
    const invoice = await loadInvoiceDetail(c.req.param("invoiceId"));
    if (!invoice) {
      return c.json({ error: "Invoice not found" }, 404);
    }
    const buffer = await renderInvoicePdf(invoice);
    return c.body(buffer, 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.reference}.pdf"`
    });
  });
```

Note: `/api/invoices/:invoiceId/pdf` must be registered before any broader `:invoiceId` catch — placing it adjacent to the existing param route (Hono matches the more specific path) is correct.

- [ ] **Step 4: Build to verify it compiles**

Run: `node node_modules/typescript/lib/tsc.js -b apps/api`
Expected: builds clean.

- [ ] **Step 5: Manual smoke (optional, if DB running)**

Run the API, then:
`curl -s -X POST localhost:<port>/api/invoices/manual -H 'Content-Type: application/json' --cookie '<auth>' -d '{"clientId":"<id>","issueDate":"2026-06-02","lineItems":[{"description":"Test","quantity":1,"unitPrice":100}]}'`
Expected: `201` with an invoice JSON containing `origin: "MANUAL"` and one line item. Then `curl -s localhost:<port>/api/invoices/<id>/pdf -o out.pdf` produces a valid PDF.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/app.ts
git commit -m "feat(billing): manual-invoice create + PDF download routes"
```

---

## Task 7: Web — "New invoice" drawer

**Files:**
- Create: `apps/web/app/components/NewInvoiceDrawer.tsx`
- Modify: `apps/web/app/components/InvoicesWorkspace.tsx`

- [ ] **Step 1: Create the drawer component**

Create `apps/web/app/components/NewInvoiceDrawer.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface ClientOption { id: string; name: string }
interface ContactOption { id: string; firstName: string; lastName: string | null; email: string }
interface RetainerOption { id: string; serviceLine?: string; currency?: string }
interface LineRow { description: string; quantity: string; unitPrice: string }

const EMPTY_ROW: LineRow = { description: "", quantity: "1", unitPrice: "" };

export default function NewInvoiceDrawer({
  open,
  onClose,
  onCreated
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (invoiceId: string) => void;
}) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [retainers, setRetainers] = useState<RetainerOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [championContactId, setChampionContactId] = useState("");
  const [retainerId, setRetainerId] = useState("");
  const [currency, setCurrency] = useState("ZAR");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<LineRow[]>([{ ...EMPTY_ROW }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/clients", { credentials: "include" })
      .then((r) => r.json())
      .then((b) => setClients(b.clients ?? []))
      .catch(() => setClients([]));
  }, [open]);

  useEffect(() => {
    if (!clientId) {
      setContacts([]);
      setRetainers([]);
      return;
    }
    void fetch(`/api/clients/${encodeURIComponent(clientId)}/contacts`, { credentials: "include" })
      .then((r) => r.json())
      .then((b) => setContacts(b.contacts ?? []))
      .catch(() => setContacts([]));
    void fetch(`/api/clients/${encodeURIComponent(clientId)}/retainers`, { credentials: "include" })
      .then((r) => r.json())
      .then((b) => setRetainers(b.retainers ?? []))
      .catch(() => setRetainers([]));
  }, [clientId]);

  const total = rows.reduce((sum, row) => {
    const q = Number(row.quantity);
    const u = Number(row.unitPrice);
    return sum + (Number.isFinite(q) && Number.isFinite(u) ? q * u : 0);
  }, 0);

  function updateRow(index: number, patch: Partial<LineRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const lineItems = rows
        .filter((row) => row.description.trim())
        .map((row) => ({
          description: row.description.trim(),
          quantity: Number(row.quantity),
          unitPrice: Number(row.unitPrice)
        }));
      if (!clientId) throw new Error("Select a client.");
      if (lineItems.length === 0) throw new Error("Add at least one line item.");

      const response = await fetch("/api/invoices/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clientId,
          championContactId: championContactId || null,
          retainerId: retainerId || null,
          currency,
          issueDate,
          dueDate: dueDate || undefined,
          notes: notes || null,
          lineItems
        })
      });
      const body = (await response.json().catch(() => null)) as
        | { invoice?: { id: string }; error?: string }
        | null;
      if (!response.ok || !body?.invoice) {
        throw new Error(body?.error ?? "Failed to create invoice");
      }
      onCreated(body.invoice.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-ink-4 bg-ink-1 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">New invoice</h2>
          <button type="button" onClick={onClose} className="text-text-3 hover:text-white">✕</button>
        </div>

        {error ? (
          <div className="mt-4 rounded-[14px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4">
          <label className="text-sm text-text-2">
            Client
            <select
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setChampionContactId(""); setRetainerId(""); }}
              className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
            >
              <option value="">Select a client…</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </label>

          <label className="text-sm text-text-2">
            Champion (optional)
            <select
              value={championContactId}
              onChange={(e) => setChampionContactId(e.target.value)}
              disabled={!clientId}
              className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
            >
              <option value="">No champion</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.firstName} {contact.lastName ?? ""} — {contact.email}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-text-2">
            Retainer (optional)
            <select
              value={retainerId}
              onChange={(e) => setRetainerId(e.target.value)}
              disabled={!clientId}
              className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
            >
              <option value="">No retainer</option>
              {retainers.map((retainer) => (
                <option key={retainer.id} value={retainer.id}>
                  {retainer.serviceLine ?? retainer.id}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="text-sm text-text-2">
              Currency
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
              >
                {["ZAR", "USD", "GBP", "EUR", "AUD", "CAD"].map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-text-2">
              Issue date
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
                className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white" />
            </label>
            <label className="text-sm text-text-2">
              Due date
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white" />
            </label>
          </div>

          <div>
            <p className="text-sm text-text-2">Line items</p>
            <div className="mt-2 space-y-2">
              {rows.map((row, index) => (
                <div key={index} className="grid grid-cols-[1fr_70px_100px_28px] gap-2">
                  <input placeholder="Description" value={row.description}
                    onChange={(e) => updateRow(index, { description: e.target.value })}
                    className="rounded-lg border border-ink-4 bg-ink-0 px-2 py-2 text-sm text-white" />
                  <input type="number" min="0" step="0.5" placeholder="Qty" value={row.quantity}
                    onChange={(e) => updateRow(index, { quantity: e.target.value })}
                    className="rounded-lg border border-ink-4 bg-ink-0 px-2 py-2 text-sm text-white" />
                  <input type="number" min="0" step="0.01" placeholder="Unit" value={row.unitPrice}
                    onChange={(e) => updateRow(index, { unitPrice: e.target.value })}
                    className="rounded-lg border border-ink-4 bg-ink-0 px-2 py-2 text-sm text-white" />
                  <button type="button" onClick={() => setRows((c) => c.filter((_, i) => i !== index))}
                    className="text-text-3 hover:text-rose-300" disabled={rows.length === 1}>✕</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setRows((c) => [...c, { ...EMPTY_ROW }])}
              className="mt-2 text-sm font-medium text-[#51d0b0] hover:underline">+ Add line</button>
            <p className="mt-3 text-right text-sm text-white">
              Total: {new Intl.NumberFormat("en-ZA", { style: "currency", currency, maximumFractionDigits: 2 }).format(total)}
            </p>
          </div>

          <label className="text-sm text-text-2">
            Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white" />
          </label>

          <button type="button" onClick={submit} disabled={saving}
            className="inline-flex items-center justify-center rounded-xl bg-[#51d0b0] px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-[#6be0c1] disabled:opacity-60">
            {saving ? "Creating…" : "Create invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the drawer into `InvoicesWorkspace`**

In `apps/web/app/components/InvoicesWorkspace.tsx`:

Add import at top:
```tsx
import { useRouter } from "next/navigation";
import NewInvoiceDrawer from "./NewInvoiceDrawer";
```

Inside the component, add state + router (after the existing `useState` hooks ~line 75):
```tsx
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
```

Add a "New invoice" button in the filter/search row — inside the `<div className="flex flex-col gap-4 lg:flex-row ...">` (~line 212), after the search input, add a button (or place it in `PageHead` area). Simplest: wrap the existing search input and a new button. Add directly after the `<input type="search" ... />` (~line 240):
```tsx
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center justify-center rounded-xl bg-[#51d0b0] px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-[#6be0c1]"
          >
            New invoice
          </button>
```

Render the drawer just before the closing `</AppShell>` (~line 313):
```tsx
        <NewInvoiceDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onCreated={(invoiceId) => {
            setDrawerOpen(false);
            router.push(`/invoices/${invoiceId}`);
          }}
        />
```

- [ ] **Step 3: Build the web app**

Run: `pnpm --filter @muloo/web build` (or the repo's web build script — check `apps/web/package.json`).
Expected: compiles without type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/components/NewInvoiceDrawer.tsx apps/web/app/components/InvoicesWorkspace.tsx
git commit -m "feat(web): new manual invoice drawer on invoices workspace"
```

---

## Task 8: Web — Download PDF + manual fields on detail

**Files:**
- Modify: `apps/web/app/components/InvoiceDetailWorkspace.tsx`

- [ ] **Step 1: Extend the `InvoiceDetail` interface**

In `apps/web/app/components/InvoiceDetailWorkspace.tsx`, add to the `InvoiceDetail` interface (~line 8):

```tsx
  origin?: "RETAINER" | "MANUAL";
  client?: { id: string; name: string } | null;
  championContact?: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    title: string | null;
  } | null;
  lineItems?: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    sortOrder: number;
  }>;
```

- [ ] **Step 2: Add a Download PDF button in the header**

In the `<header>` block (~line 147), after the `<h1>` (~line 159), add:

```tsx
          <a
            href={`/api/invoices/${encodeURIComponent(invoiceId)}/pdf`}
            className="mt-3 inline-flex items-center rounded-xl border border-[#51d0b0]/50 bg-[#51d0b0]/10 px-4 py-2 text-sm font-semibold text-[#9be4d2] transition hover:bg-[#51d0b0]/20"
          >
            Download PDF
          </a>
```

- [ ] **Step 3: Show champion + line items for manual invoices**

In the "Invoice record" `<section>` (~line 174), after the existing `Retainer client` `<p>` (~line 190), add:

```tsx
              {invoice?.championContact ? (
                <p>
                  <span className="text-text-3">Champion:</span>{" "}
                  {invoice.championContact.firstName} {invoice.championContact.lastName ?? ""} ·{" "}
                  {invoice.championContact.email}
                </p>
              ) : null}
              {invoice?.client ? (
                <p>
                  <span className="text-text-3">Customer:</span> {invoice.client.name}
                </p>
              ) : null}
```

And after the `<div className="mt-4 space-y-3 ...">` totals block closes (~line 217), before the agency link, add a line-item table when present:

```tsx
            {invoice?.lineItems && invoice.lineItems.length > 0 ? (
              <div className="mt-5">
                <p className="text-xs uppercase tracking-[0.14em] text-text-3">Line items</p>
                <ul className="mt-2 divide-y divide-white/5 text-sm">
                  {invoice.lineItems
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((line) => (
                      <li key={line.id} className="flex items-center justify-between py-2">
                        <span className="text-text-2">
                          {line.description}{" "}
                          <span className="text-text-3">
                            ({line.quantity} × {formatMoney(line.unitPrice, invoice.currency)})
                          </span>
                        </span>
                        <span className="text-white tabular-nums">
                          {formatMoney(line.lineTotal, invoice.currency)}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
```

- [ ] **Step 4: Build the web app**

Run: `pnpm --filter @muloo/web build`
Expected: compiles without type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/components/InvoiceDetailWorkspace.tsx
git commit -m "feat(web): download PDF + champion/line items on invoice detail"
```

---

## Task 9: Full verification

- [ ] **Step 1: Run the full API build + test suite**

Run: `pnpm test`
Expected: PASS — includes `tests/manual-invoices.test.mjs` and `tests/invoice-pdf.test.mjs` (the root `test` script globs `tests/*.test.mjs`), with no regression in retainer tests.

- [ ] **Step 2: Build web**

Run: `pnpm --filter @muloo/web build`
Expected: clean build.

- [ ] **Step 3: Manual end-to-end (DB + both apps running)**

1. Invoices page → "New invoice" → pick a client → champion + retainer populate → add 2 line items → Create.
2. Redirects to detail → shows champion, customer, line items, total.
3. "Download PDF" → a `<reference>.pdf` downloads, opens, shows branded header, bill-to, line table, total, bank details.
4. Confirm retainer-driven invoices still list and open unchanged.

- [ ] **Step 4: Fill in real billing details (user)**

Replace the `TODO:` placeholders in `MULOO_BILLING_DETAILS` (`apps/api/src/invoicePdf.ts`) with real Muloo company + bank details, then rebuild API.

---

## Notes for the implementer

- The root `test` script (`package.json`) compiles `apps/api` then runs `node --test tests/*.test.mjs`. Always build before running a single test file: `node node_modules/typescript/lib/tsc.js -b apps/api`.
- Tests import compiled `dist/`, not `src/`. New exports won't appear until you rebuild.
- This touches a protected data model (Invoice). The retainer-driven `createInvoiceRecord` path is intentionally left unchanged — `origin` defaults to `RETAINER` so existing rows and flows are unaffected.
- `prisma migrate dev` must run against a reachable dev Postgres (`DATABASE_URL`). If unavailable, hand-write the migration SQL mirroring Step 5 and apply with `prisma migrate deploy`.
