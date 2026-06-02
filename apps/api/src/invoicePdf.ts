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
