"use client";

import { useEffect, useState } from "react";

interface Invoice {
  id: string;
  reference: string;
  invoiceType: "RETAINER_BLOCK" | "TOP_UP" | "OTHER";
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOID";
  xeroUrl: string | null;
  notes: string | null;
  billToEntity: {
    id: string;
    name: string;
    type: string;
  };
  retainer: {
    id: string;
    client: {
      id: string;
      name: string;
    };
  };
  retainerPeriod: {
    id: string;
    periodMonth: string;
    blockHours: number;
  } | null;
}

interface BillToEntity {
  id: string;
  name: string;
  type: string;
}

interface Retainer {
  id: string;
  name: string;
  billToEntities: BillToEntity[];
}

interface ClientInvoicesPanelProps {
  clientId: string;
  clientName: string;
}

const invoiceTypeOptions = [
  { value: "RETAINER_BLOCK", label: "Retainer Block" },
  { value: "TOP_UP", label: "Top-up" },
  { value: "OTHER", label: "Other" }
];

const invoiceStatuses = [
  { value: "DRAFT", label: "Draft", bgColor: "bg-[#4a4a4a]", textColor: "text-white" },
  { value: "SENT", label: "Sent", bgColor: "bg-[rgba(59,130,246,0.14)]", textColor: "text-blue-400" },
  { value: "PAID", label: "Paid", bgColor: "bg-[rgba(81,208,176,0.14)]", textColor: "text-[#51d0b0]" },
  { value: "OVERDUE", label: "Overdue", bgColor: "bg-[rgba(239,68,68,0.14)]", textColor: "text-red-400" },
  { value: "VOID", label: "Void", bgColor: "bg-[rgba(107,114,128,0.14)]", textColor: "text-gray-400" }
];

function getStatusColor(status: string) {
  const statusOption = invoiceStatuses.find((s) => s.value === status);
  return statusOption
    ? { bgColor: statusOption.bgColor, textColor: statusOption.textColor }
    : { bgColor: "bg-[#4a4a4a]", textColor: "text-white" };
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: currency
  }).format(amount);
}

export default function ClientInvoicesPanel({
  clientId,
  clientName
}: ClientInvoicesPanelProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [retainers, setRetainers] = useState<Retainer[]>([]);
  const [billToEntities, setBillToEntities] = useState<BillToEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    reference: "",
    billToEntityId: "",
    retainerId: "",
    invoiceType: "RETAINER_BLOCK",
    amount: "",
    currency: "ZAR",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    xeroUrl: "",
    status: "DRAFT",
    notes: ""
  });

  useEffect(() => {
    void loadInvoicesAndRetainers();
  }, [clientId]);

  async function loadInvoicesAndRetainers() {
    setLoading(true);
    setError(null);

    try {
      // Load invoices for this client (via retainers)
      // First, we need to get the client's retainers to filter invoices
      const retainersResponse = await fetch(
        `/api/clients/${encodeURIComponent(clientId)}/retainers`
      );

      if (!retainersResponse.ok) {
        throw new Error("Failed to load retainers");
      }

      const retainersData = await retainersResponse.json();
      const clientRetainers = retainersData.retainers ?? [];
      setRetainers(clientRetainers);

      // Collect all billToEntities from retainers
      const allBillToEntities: BillToEntity[] = [];
      const seenIds = new Set<string>();

      for (const retainer of clientRetainers) {
        for (const entity of retainer.billToEntities ?? []) {
          if (!seenIds.has(entity.id)) {
            allBillToEntities.push(entity);
            seenIds.add(entity.id);
          }
        }
      }

      setBillToEntities(allBillToEntities);

      // Load all invoices and filter by retainers
      const invoicesResponse = await fetch("/api/invoices");

      if (!invoicesResponse.ok) {
        throw new Error("Failed to load invoices");
      }

      const invoicesData = await invoicesResponse.json();
      const allInvoices = invoicesData.invoices ?? [];

      // Filter invoices for this client's retainers
      const retainerIds = new Set(clientRetainers.map((r: Retainer) => r.id));
      const filteredInvoices = allInvoices.filter(
        (invoice: Invoice) => retainerIds.has(invoice.retainer.id)
      );

      setInvoices(filteredInvoices);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load invoices and retainers"
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveInvoice() {
    if (!formData.reference.trim()) {
      setError("Reference is required");
      return;
    }

    if (!formData.retainerId) {
      setError("Retainer is required");
      return;
    }

    if (!formData.billToEntityId) {
      setError("Bill-to entity is required");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const payload = {
        reference: formData.reference.trim(),
        retainerId: formData.retainerId,
        invoiceType: formData.invoiceType,
        amount: formData.amount ? parseFloat(formData.amount) : undefined,
        issueDate: new Date(formData.issueDate),
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        xeroUrl: formData.xeroUrl.trim() || null,
        status: formData.status,
        notes: formData.notes.trim() || null
      };

      const method = editingInvoiceId ? "PATCH" : "POST";
      const url = editingInvoiceId
        ? `/api/invoices/${encodeURIComponent(editingInvoiceId)}`
        : "/api/invoices";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? `Failed to ${editingInvoiceId ? "update" : "create"} invoice`);
      }

      setFeedback(editingInvoiceId ? "Invoice updated." : "Invoice created.");
      setShowAddForm(false);
      setEditingInvoiceId(null);
      resetFormData();
      await loadInvoicesAndRetainers();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : `Failed to ${editingInvoiceId ? "update" : "create"} invoice`
      );
    } finally {
      setSaving(false);
    }
  }

  function resetFormData() {
    setFormData({
      reference: "",
      billToEntityId: "",
      retainerId: "",
      invoiceType: "RETAINER_BLOCK",
      amount: "",
      currency: "ZAR",
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      xeroUrl: "",
      status: "DRAFT",
      notes: ""
    });
  }

  function startEditingInvoice(invoice: Invoice) {
    setEditingInvoiceId(invoice.id);
    setFormData({
      reference: invoice.reference,
      billToEntityId: invoice.billToEntity.id,
      retainerId: invoice.retainer.id,
      invoiceType: invoice.invoiceType,
      amount: invoice.amount.toString(),
      currency: invoice.currency,
      issueDate: invoice.issueDate.split("T")[0],
      dueDate: invoice.dueDate.split("T")[0],
      xeroUrl: invoice.xeroUrl || "",
      status: invoice.status,
      notes: invoice.notes || ""
    });
    setShowAddForm(true);
  }

  function cancelEdit() {
    setShowAddForm(false);
    setEditingInvoiceId(null);
    resetFormData();
  }

  // Get bill-to entities for the selected retainer
  const selectedRetainer = retainers.find((r) => r.id === formData.retainerId);
  const relevantBillToEntities = selectedRetainer
    ? selectedRetainer.billToEntities || []
    : billToEntities;

  const sortedInvoices = [...invoices].sort(
    (a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
  );

  return (
    <div className="mt-5 rounded-[14px] border border-ink-4 bg-ink-2 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-text-3">
            Invoices
          </p>
          <p className="mt-2 text-sm text-text-2">
            Manage invoices for {clientName}'s retainers.
          </p>
        </div>
        {!showAddForm ? (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="rounded-[14px] border border-[rgba(81,208,176,0.22)] bg-[rgba(81,208,176,0.08)] px-4 py-3 text-sm font-medium text-[#8de7d1] disabled:cursor-not-allowed disabled:text-text-3"
          >
            + Add invoice
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-[14px] bg-[rgba(239,68,68,0.14)] px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      {feedback ? (
        <div className="mt-4 rounded-[14px] bg-[rgba(81,208,176,0.14)] px-4 py-3 text-sm text-[#51d0b0]">
          {feedback}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 text-sm text-text-2">Loading invoices...</div>
      ) : showAddForm ? (
        <div className="mt-5 space-y-4 rounded-[14px] bg-ink-2 p-5">
          <h3 className="text-sm font-semibold text-white">
            {editingInvoiceId ? "Edit invoice" : "Add new invoice"}
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-white">Reference *</span>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) =>
                  setFormData({ ...formData, reference: e.target.value })
                }
                placeholder="INV-001"
                className="mt-2 w-full rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white">Retainer *</span>
              <select
                value={formData.retainerId}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    retainerId: e.target.value,
                    billToEntityId: ""
                  })
                }
                className="mt-2 w-full rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">Select retainer</option>
                {retainers.map((retainer) => (
                  <option key={retainer.id} value={retainer.id}>
                    {retainer.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white">Bill-to entity *</span>
              <select
                value={formData.billToEntityId}
                onChange={(e) =>
                  setFormData({ ...formData, billToEntityId: e.target.value })
                }
                className="mt-2 w-full rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">Select entity</option>
                {relevantBillToEntities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white">Invoice type</span>
              <select
                value={formData.invoiceType}
                onChange={(e) =>
                  setFormData({ ...formData, invoiceType: e.target.value })
                }
                className="mt-2 w-full rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm text-white outline-none"
              >
                {invoiceTypeOptions.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white">Amount</span>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                placeholder="0.00"
                className="mt-2 w-full rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white">Currency</span>
              <select
                value={formData.currency}
                onChange={(e) =>
                  setFormData({ ...formData, currency: e.target.value })
                }
                className="mt-2 w-full rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="ZAR">ZAR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white">Issue date</span>
              <input
                type="date"
                value={formData.issueDate}
                onChange={(e) =>
                  setFormData({ ...formData, issueDate: e.target.value })
                }
                className="mt-2 w-full rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white">Due date</span>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
                className="mt-2 w-full rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm text-white outline-none"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-white">Xero URL</span>
              <input
                type="text"
                value={formData.xeroUrl}
                onChange={(e) =>
                  setFormData({ ...formData, xeroUrl: e.target.value })
                }
                placeholder="https://..."
                className="mt-2 w-full rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white">Status</span>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="mt-2 w-full rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm text-white outline-none"
              >
                {invoiceStatuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white">Notes</span>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Optional"
                className="mt-2 w-full rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm text-white outline-none"
                rows={3}
              />
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={saveInvoice}
              disabled={saving}
              className="rounded-[14px] bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : editingInvoiceId ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="rounded-[14px] border border-ink-4 bg-ink-2 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : sortedInvoices.length === 0 ? (
        <div className="mt-5 rounded-[14px] border border-dashed border-ink-4 px-5 py-5 text-sm text-text-2">
          No invoices yet. Click "Add invoice" to create one.
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-4">
              <tr>
                <th className="text-left px-4 py-3 text-text-3 font-medium">
                  Reference
                </th>
                <th className="text-left px-4 py-3 text-text-3 font-medium">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-text-3 font-medium">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-text-3 font-medium">
                  Issue Date
                </th>
                <th className="text-left px-4 py-3 text-text-3 font-medium">
                  Due Date
                </th>
                <th className="text-left px-4 py-3 text-text-3 font-medium">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-text-3 font-medium">
                  Xero
                </th>
                <th className="text-left px-4 py-3 text-text-3 font-medium">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedInvoices.map((invoice) => {
                const statusColor = getStatusColor(invoice.status);
                const typeLabel =
                  invoiceTypeOptions.find((t) => t.value === invoice.invoiceType)
                    ?.label || invoice.invoiceType;

                return (
                  <tr
                    key={invoice.id}
                    className="border-b border-ink-4 hover:bg-ink-2 cursor-pointer"
                    onClick={() => startEditingInvoice(invoice)}
                  >
                    <td className="px-4 py-3 text-white">{invoice.reference}</td>
                    <td className="px-4 py-3 text-text-2">{typeLabel}</td>
                    <td className="px-4 py-3 text-white">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </td>
                    <td className="px-4 py-3 text-text-2">
                      {formatDate(invoice.issueDate)}
                    </td>
                    <td className="px-4 py-3 text-text-2">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor.bgColor} ${statusColor.textColor}`}
                      >
                        {invoiceStatuses.find((s) => s.value === invoice.status)
                          ?.label || invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {invoice.xeroUrl ? (
                        <a
                          href={invoice.xeroUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[#8de7d1] hover:underline"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="text-text-3">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingInvoice(invoice);
                        }}
                        className="text-[#8de7d1] hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
