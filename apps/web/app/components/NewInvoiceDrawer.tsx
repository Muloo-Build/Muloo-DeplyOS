"use client";

import { useEffect, useState } from "react";

interface ClientOption { id: string; name: string }
interface ContactOption { id: string; firstName: string; lastName: string | null; email: string }
interface RetainerOption { id: string; serviceLine?: string; currency?: string }
interface LineRow { id: string; description: string; quantity: string; unitPrice: string }

let rowSeq = 0;
function makeRow(): LineRow {
  rowSeq += 1;
  return { id: `row-${rowSeq}`, description: "", quantity: "1", unitPrice: "" };
}

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
  const [rows, setRows] = useState<LineRow[]>(() => [makeRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form each time the drawer opens so a cancelled draft doesn't
  // linger into the next open.
  useEffect(() => {
    if (!open) return;
    setClientId("");
    setChampionContactId("");
    setRetainerId("");
    setCurrency("ZAR");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
    setNotes("");
    setRows([makeRow()]);
    setError(null);
  }, [open]);

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
          <button type="button" aria-label="Close" onClick={onClose} className="text-text-3 hover:text-white">✕</button>
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
                <div key={row.id} className="grid grid-cols-[1fr_70px_100px_28px] gap-2">
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
            <button type="button" onClick={() => setRows((c) => [...c, makeRow()])}
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
