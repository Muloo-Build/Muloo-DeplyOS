# Manual Invoices (Xero-down fallback) — Design

**Date:** 2026-06-02
**Status:** Approved (design), pending implementation plan
**Area:** Billing / Invoices — **protected data model** (Invoice, retainer/invoice relations)

## Problem

Xero is the system of record for invoicing. When Xero is unavailable, there is no way
to produce an invoice from Deploy OS. The user needs to: create an invoice inside
Deploy, link it to a customer (Client) and a champion (ClientContact), itemize the work,
and download a polished PDF to attach to an email manually.

## Goals

- Create a standalone (non-retainer) invoice directly in Deploy OS.
- Link the invoice to an existing **Client** and, optionally, a **champion** (ClientContact).
- Optionally attach a **retainer** when one applies.
- **Itemized line items** (description, quantity, unit price, line total) with an auto subtotal/total.
- Download a **server-rendered, branded PDF** (`.pdf` file) for manual email attachment.

## Non-Goals (YAGNI)

- Auto-emailing the PDF (user attaches manually).
- VAT/tax lines (itemized without VAT — confirmed).
- Syncing manual invoices back to Xero.
- Editing line items after creation (workflow = VOID and recreate).

## Approach

**Chosen: extend the existing `Invoice` model** (vs. a separate `ManualInvoice` model or
free-text-only). Keeps one invoice concept — one listing, one detail view, one serializer,
one PDF path — and reuses the existing `BillToEntity` plumbing (`ensureClientBillToEntity`,
`billing.ts:406`). Retainer and Xero invoices continue to work unchanged; manual invoices
are distinguished by an `origin` field.

## Data Model (Prisma migration)

### `Invoice` changes
- `retainerId` → **optional** (`String?`); relation made optional.
- Add `clientId String?` + relation to `Client` (direct customer link for manual invoices).
- Add `championContactId String?` + relation to `ClientContact` (the champion).
- Add `origin InvoiceOrigin @default(RETAINER)` — values `RETAINER` | `MANUAL`.
- `amount` stays `Decimal(12,2)` = computed sum of line totals at create time.
- `currency` set from selected retainer if present, else from request (default `ZAR`).
- `invoiceType` for manual invoices = `OTHER`.

### New `InvoiceLineItem`
```
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

### New enum
```
enum InvoiceOrigin {
  RETAINER
  MANUAL
}
```

Existing retainer-driven `createInvoiceRecord` is unaffected (defaults `origin = RETAINER`,
sets `clientId`/`championContactId = null`).

## API (`apps/api/src/billing.ts` + route wiring in `server.ts`)

### `createManualInvoiceRecord(payload, actorId)`
Zod schema:
- `clientId` (required)
- `retainerId?` (optional)
- `championContactId?` (optional; validated to belong to `clientId`)
- `reference?` (auto-generated if blank — format below)
- `currency?` (default `ZAR`; overridden by retainer currency if `retainerId` given)
- `issueDate` (required), `dueDate?` (default `issueDate + 14d`)
- `lineItems[]`: `{ description, quantity, unitPrice }` (>= 1 item)
- `notes?`

Behaviour:
- Resolve/create `BillToEntity` via existing `ensureClientBillToEntity(clientId)`.
- If `championContactId` set, verify it belongs to `clientId` (else 400).
- Compute each `lineTotal = quantity * unitPrice`; `amount = sum(lineTotal)`.
- Create `Invoice` (`origin = MANUAL`, `invoiceType = OTHER`, `status = DRAFT`) with nested
  `lineItems`.
- Reference auto-format: `INV-<YYYYMMDD>-<short>` if not supplied (must satisfy existing
  `reference @unique`).

### `GET /invoices/:id/pdf`
- Loads invoice with client, champion, lineItems, billToEntity.
- Renders with **pdfkit** (pure JS — no headless browser; reliable on Railway NIXPACKS).
- Streams `application/pdf` with `Content-Disposition: attachment; filename="<reference>.pdf"`.
- Layout: Muloo branded header + agency/bank details (hardcoded constant — see below),
  bill-to block (client name/address + champion name/email), issue/due dates, reference,
  line-item table, subtotal/total, notes, payment terms.

### Serializer
- Extend `serializeInvoice` to include `client`, `champion`, `lineItems`, `origin`.

### New dependency
- `pdfkit` + `@types/pdfkit` in `apps/api/package.json`.

### Hardcoded agency/bank constant
A single module-level constant `MULOO_BILLING_DETAILS` in the PDF module holding company
name, address, registration/VAT number, and bank account details. Values are placeholders
to be filled by the user; clearly marked `// TODO: confirm Muloo billing + bank details`.

## Frontend (`apps/web`)

### InvoicesWorkspace
- Add **"New invoice"** button → form drawer/modal:
  - Select **Client** (existing clients).
  - On client select: load that client's **champions** (ClientContact list) → optional select;
    load that client's **retainers** → optional select.
  - **Line items**: repeatable rows (description, qty, unit price) with a live computed total;
    add/remove row.
  - Issue date, due date, notes.
  - Submit → `POST` to manual-invoice endpoint; on success, refresh list / open detail.

### InvoiceDetailWorkspace
- Add **"Download PDF"** button → opens/downloads `GET /invoices/:id/pdf`.
- Show line items + champion for `origin = MANUAL` invoices.

## Data Flow

1. User opens Invoices → "New invoice".
2. Picks Client → UI fetches champions + retainers for that client.
3. Adds line items, dates, optional champion/retainer, notes → submit.
4. API resolves BillToEntity, computes totals, creates `MANUAL` Invoice + line items.
5. Invoice appears in list (DRAFT). User opens detail → "Download PDF".
6. API streams branded PDF → user attaches to email manually.

## Error Handling

- Missing/invalid `clientId` → 400.
- `championContactId` not belonging to client → 400.
- Empty `lineItems` → 400.
- Duplicate `reference` → 409 (surface friendly message; auto-gen avoids most collisions).
- PDF for non-existent invoice → 404.

## Testing

- Unit: `createManualInvoiceRecord` — total computation, default due date, champion ownership
  validation, reference auto-gen, BillToEntity reuse.
- Unit: retainer-driven `createInvoiceRecord` still defaults `origin = RETAINER` (regression).
- Integration: POST create → GET detail includes line items/champion → GET pdf returns
  `application/pdf` with non-empty body and attachment header.
- Migration: applies cleanly; existing invoices backfill `origin = RETAINER`.

## Open Items

None blocking. Bank/company details are hardcoded placeholders for the user to fill in.
