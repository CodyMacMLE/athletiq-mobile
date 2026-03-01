"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import {
  GET_ORG_INVOICES,
  GET_ORG_BALANCE_SUMMARY,
  GET_ORGANIZATION_USERS,
} from "@/lib/graphql/queries";
import {
  CREATE_INVOICE,
  DELETE_INVOICE,
  SEND_INVOICE,
  RECORD_PAYMENT,
  SEND_PAYMENT_REMINDER,
  UPDATE_INVOICE,
} from "@/lib/graphql/mutations";
import {
  DollarSign,
  Plus,
  Send,
  Trash2,
  X,
  Download,
  Bell,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  ChevronDown,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Payment = {
  id: string;
  amountCents: number;
  method: string;
  note?: string;
  paidAt: string;
  recorder: { id: string; firstName: string; lastName: string };
};

type Invoice = {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  description?: string;
  amountCents: number;
  currency: string;
  dueDate?: string;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
  sentAt?: string;
  paidAt?: string;
  totalPaidCents: number;
  balanceCents: number;
  createdAt: string;
  updatedAt: string;
  user: { id: string; firstName: string; lastName: string; email: string };
  creator: { id: string; firstName: string; lastName: string };
  payments: Payment[];
};

type BalanceSummary = {
  totalOutstandingCents: number;
  totalPaidCents: number;
  overdueCount: number;
  draftCount: number;
  sentCount: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  DRAFT:     { label: "Draft",     color: "text-gray-400 bg-gray-800",    icon: FileText },
  SENT:      { label: "Sent",      color: "text-blue-400 bg-blue-900/30", icon: Send },
  PAID:      { label: "Paid",      color: "text-green-400 bg-green-900/30", icon: CheckCircle },
  OVERDUE:   { label: "Overdue",   color: "text-red-400 bg-red-900/30",   icon: AlertCircle },
  CANCELLED: { label: "Cancelled", color: "text-gray-500 bg-gray-800",    icon: X },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportInvoicesCsv(invoices: Invoice[]) {
  const header = "Title,Recipient,Amount,Balance,Status,Due Date,Sent At,Paid At";
  const rows = invoices.map((inv) =>
    [
      `"${inv.title}"`,
      `"${inv.user.firstName} ${inv.user.lastName}"`,
      formatCents(inv.amountCents, inv.currency),
      formatCents(inv.balanceCents, inv.currency),
      inv.status,
      formatDate(inv.dueDate),
      formatDate(inv.sentAt),
      formatDate(inv.paidAt),
    ].join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoices-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CreateInvoiceModal ───────────────────────────────────────────────────────

function CreateInvoiceModal({
  organizationId,
  members,
  onClose,
  onCreated,
}: {
  organizationId: string;
  members: { userId: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    userId: "",
    title: "",
    description: "",
    amountDollars: "",
    dueDate: "",
  });
  const [error, setError] = useState("");

  const [createInvoice, { loading }] = useMutation(CREATE_INVOICE);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const amountCents = Math.round(parseFloat(form.amountDollars) * 100);
    if (!form.userId) { setError("Please select a recipient."); return; }
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (isNaN(amountCents) || amountCents < 1) { setError("Amount must be at least $0.01."); return; }

    try {
      await createInvoice({
        variables: {
          organizationId,
          userId: form.userId,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          amountCents,
          dueDate: form.dueDate || undefined,
        },
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create invoice.");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a2e] border border-white/15 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-white font-semibold">Create Invoice</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Recipient</label>
            <select
              value={form.userId}
              onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c5ce7]"
            >
              <option value="">Select member...</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Season Dues 2025"
              className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c5ce7] placeholder-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c5ce7] resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.amountDollars}
                onChange={(e) => setForm((f) => ({ ...f, amountDollars: e.target.value }))}
                placeholder="150.00"
                className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c5ce7] placeholder-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Due Date (optional)</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c5ce7]"
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-white/15 text-gray-300 text-sm hover:border-white/30">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 rounded-lg bg-[#6c5ce7] text-white text-sm font-medium hover:bg-[#5b4cd6] disabled:opacity-50">
              {loading ? "Creating..." : "Create Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── RecordPaymentModal ───────────────────────────────────────────────────────

function RecordPaymentModal({
  invoice,
  onClose,
  onRecorded,
}: {
  invoice: Invoice;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [form, setForm] = useState({ amountDollars: (invoice.balanceCents / 100).toFixed(2), method: "OTHER", note: "" });
  const [error, setError] = useState("");

  const [recordPayment, { loading }] = useMutation(RECORD_PAYMENT);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const amountCents = Math.round(parseFloat(form.amountDollars) * 100);
    if (isNaN(amountCents) || amountCents < 1) { setError("Amount must be at least $0.01."); return; }

    try {
      await recordPayment({
        variables: { invoiceId: invoice.id, amountCents, method: form.method, note: form.note.trim() || undefined },
      });
      onRecorded();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to record payment.");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a2e] border border-white/15 rounded-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-white font-semibold">Record Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-gray-400 text-sm">Invoice: <span className="text-white">{invoice.title}</span></p>
          <p className="text-gray-400 text-sm">Outstanding: <span className="text-[#a78bfa] font-semibold">{formatCents(invoice.balanceCents, invoice.currency)}</span></p>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.amountDollars}
              onChange={(e) => setForm((f) => ({ ...f, amountDollars: e.target.value }))}
              className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c5ce7]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Method</label>
            <select
              value={form.method}
              onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
              className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c5ce7]"
            >
              <option value="CASH">Cash</option>
              <option value="CHECK">Check</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="STRIPE">Stripe</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Note (optional)</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c5ce7]"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-white/15 text-gray-300 text-sm hover:border-white/30">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 rounded-lg bg-[#6c5ce7] text-white text-sm font-medium hover:bg-[#5b4cd6] disabled:opacity-50">
              {loading ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── InvoiceRow ───────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice,
  onRefetch,
}: {
  invoice: Invoice;
  onRefetch: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  const [sendInvoice, { loading: sending }] = useMutation(SEND_INVOICE);
  const [deleteInvoice, { loading: deleting }] = useMutation(DELETE_INVOICE);
  const [sendReminder, { loading: reminding }] = useMutation(SEND_PAYMENT_REMINDER);

  async function handleSend() {
    await sendInvoice({ variables: { id: invoice.id } });
    onRefetch();
  }

  async function handleDelete() {
    if (!confirm(`Delete invoice "${invoice.title}"? This cannot be undone.`)) return;
    await deleteInvoice({ variables: { id: invoice.id } });
    onRefetch();
  }

  async function handleReminder() {
    await sendReminder({ variables: { invoiceId: invoice.id } });
  }

  return (
    <>
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-medium text-sm truncate">{invoice.title}</p>
              <StatusBadge status={invoice.status} />
            </div>
            <p className="text-gray-400 text-xs mt-0.5">
              {invoice.user.firstName} {invoice.user.lastName} · {invoice.user.email}
            </p>
            {invoice.dueDate && (
              <p className="text-gray-500 text-xs mt-0.5">
                Due {formatDate(invoice.dueDate)}
              </p>
            )}
          </div>

          <div className="text-right shrink-0">
            <p className="text-[#a78bfa] font-semibold text-sm">{formatCents(invoice.amountCents, invoice.currency)}</p>
            {invoice.balanceCents < invoice.amountCents && invoice.status !== "PAID" && (
              <p className="text-green-400 text-xs">{formatCents(invoice.totalPaidCents, invoice.currency)} paid</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
          {invoice.status === "DRAFT" && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#6c5ce7]/20 text-[#a78bfa] text-xs font-medium hover:bg-[#6c5ce7]/40 disabled:opacity-50"
            >
              <Send className="w-3 h-3" /> {sending ? "Sending..." : "Send"}
            </button>
          )}
          {["SENT", "OVERDUE"].includes(invoice.status) && (
            <>
              <button
                onClick={() => setShowPayModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-900/30 text-green-400 text-xs font-medium hover:bg-green-900/50"
              >
                <CheckCircle className="w-3 h-3" /> Record Payment
              </button>
              <button
                onClick={handleReminder}
                disabled={reminding}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-900/30 text-orange-400 text-xs font-medium hover:bg-orange-900/50 disabled:opacity-50"
              >
                <Bell className="w-3 h-3" /> {reminding ? "Sending..." : "Reminder"}
              </button>
            </>
          )}
          {invoice.payments.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs hover:bg-white/10"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
              {invoice.payments.length} payment{invoice.payments.length !== 1 ? "s" : ""}
            </button>
          )}
          <div className="ml-auto">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {expanded && invoice.payments.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
            {invoice.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs text-gray-400">
                <span>{formatDate(p.paidAt)} · {p.method.replace("_", " ")}{p.note ? ` · ${p.note}` : ""}</span>
                <span className="text-green-400">{formatCents(p.amountCents, invoice.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPayModal && (
        <RecordPaymentModal
          invoice={invoice}
          onClose={() => setShowPayModal(false)}
          onRecorded={onRefetch}
        />
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: undefined,    label: "All" },
  { value: "DRAFT",      label: "Draft" },
  { value: "SENT",       label: "Sent" },
  { value: "OVERDUE",    label: "Overdue" },
  { value: "PAID",       label: "Paid" },
  { value: "CANCELLED",  label: "Cancelled" },
];

export default function PaymentsPage() {
  const { selectedOrganizationId, canEdit } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: invoiceData, loading, refetch } = useQuery(GET_ORG_INVOICES, {
    variables: { organizationId: selectedOrganizationId, status: statusFilter },
    skip: !selectedOrganizationId,
    fetchPolicy: "cache-and-network",
  });

  const { data: summaryData } = useQuery(GET_ORG_BALANCE_SUMMARY, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
    fetchPolicy: "cache-and-network",
  });

  const { data: usersData } = useQuery(GET_ORGANIZATION_USERS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId || !canEdit,
  });

  const invoices: Invoice[] = (invoiceData as any)?.orgInvoices ?? [];
  const summary: BalanceSummary | undefined = (summaryData as any)?.orgBalanceSummary;

  const members = ((usersData as any)?.organizationMembers ?? [])
    .filter((m: any) => m.user.id)
    .map((m: any) => ({ userId: m.user.id, name: `${m.user.firstName} ${m.user.lastName}` }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));

  if (!selectedOrganizationId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Select an organization to view payments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payments</h1>
          <p className="text-gray-400 text-sm mt-0.5">Track invoices and collect dues</p>
        </div>
        <div className="flex gap-2">
          {invoices.length > 0 && (
            <button
              onClick={() => exportInvoicesCsv(invoices)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 text-gray-300 text-sm hover:border-white/30"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6c5ce7] text-white text-sm font-medium hover:bg-[#5b4cd6]"
            >
              <Plus className="w-4 h-4" /> New Invoice
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-orange-400" />
              <span className="text-gray-400 text-xs">Outstanding</span>
            </div>
            <p className="text-xl font-bold text-white">{formatCents(summary.totalOutstandingCents)}</p>
          </div>
          <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-gray-400 text-xs">Collected</span>
            </div>
            <p className="text-xl font-bold text-white">{formatCents(summary.totalPaidCents)}</p>
          </div>
          <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-gray-400 text-xs">Overdue</span>
            </div>
            <p className="text-xl font-bold text-white">{summary.overdueCount}</p>
          </div>
          <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-gray-400 text-xs">Awaiting Payment</span>
            </div>
            <p className="text-xl font-bold text-white">{summary.sentCount}</p>
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setStatusFilter(f.value)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-[#6c5ce7] text-white"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {loading && invoices.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <FileText className="w-10 h-10 text-gray-600 mb-3" />
          <p className="text-gray-400 font-medium">No invoices yet</p>
          {canEdit && (
            <p className="text-gray-500 text-sm mt-1">
              Create your first invoice to start tracking dues and fees.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} onRefetch={refetch} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateInvoiceModal
          organizationId={selectedOrganizationId}
          members={members}
          onClose={() => setShowCreateModal(false)}
          onCreated={refetch}
        />
      )}
    </div>
  );
}
