"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { GET_ORG_EXCUSE_REQUESTS } from "@/lib/graphql/queries";
import { UPDATE_EXCUSE_REQUEST } from "@/lib/graphql/mutations";
import {
  FileCheck,
  Search,
  X,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  CalendarDays,
  User,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(val: string | number | null | undefined): string {
  if (!val) return "—";
  const d = new Date(isNaN(Number(val)) ? val : Number(val));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(val: string | null | undefined): string {
  if (!val) return "—";
  const d = new Date(val);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    PENDING:  "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
    APPROVED: "bg-green-500/20 text-green-400 border border-green-500/30",
    DENIED:   "bg-red-500/20 text-red-400 border border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg[status] ?? "bg-white/10 text-white/60"}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function Avatar({ user }: { user: any }) {
  return user?.image ? (
    <img src={user.image} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
  ) : (
    <div className="w-9 h-9 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white font-medium text-sm shrink-0">
      {user?.firstName?.[0]}{user?.lastName?.[0]}
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  excuse,
  onClose,
  onUpdate,
  updating,
}: {
  excuse: any;
  onClose: () => void;
  onUpdate: (id: string, status: "APPROVED" | "DENIED") => void;
  updating: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-[rgba(30,20,70,0.95)] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-white font-semibold text-lg">Absence Request</h2>
          <button onClick={onClose} className="p-1.5 text-white/50 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Member */}
          <div className="flex items-center gap-3">
            <Avatar user={excuse.user} />
            <div>
              <p className="text-white font-medium">{excuse.user.firstName} {excuse.user.lastName}</p>
              <p className="text-white/50 text-xs">Athlete</p>
            </div>
            <div className="ml-auto">
              <StatusBadge status={excuse.status} />
            </div>
          </div>

          {/* Event */}
          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            <p className="text-white font-medium">{excuse.event.title}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/60">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                {formatDate(excuse.event.date)}
              </span>
              {(excuse.event.startTime || excuse.event.endTime) && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTime(excuse.event.startTime)} – {formatTime(excuse.event.endTime)}
                </span>
              )}
              {excuse.event.team?.name && (
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  {excuse.event.team.name}
                </span>
              )}
            </div>
          </div>

          {/* Reason */}
          <div>
            <p className="text-white/50 text-xs font-medium uppercase tracking-wide mb-1.5">Reason</p>
            <p className="text-white/80 text-sm leading-relaxed">{excuse.reason || "No reason provided."}</p>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-white/40">
            <span>Submitted {formatDate(excuse.createdAt)}</span>
            {excuse.attemptCount > 1 && <span>{excuse.attemptCount} attempts</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={() => onUpdate(excuse.id, "DENIED")}
            disabled={updating || excuse.status === "DENIED"}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg text-sm font-medium hover:bg-red-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <XCircle className="w-4 h-4" />
            {excuse.status === "DENIED" ? "Denied" : "Deny"}
          </button>
          <button
            onClick={() => onUpdate(excuse.id, "APPROVED")}
            disabled={updating || excuse.status === "APPROVED"}
            className="flex items-center gap-2 px-4 py-2 bg-green-600/20 text-green-400 border border-green-600/30 rounded-lg text-sm font-medium hover:bg-green-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            {excuse.status === "APPROVED" ? "Approved" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type SortKey = "date" | "name" | "event";
type SortDir = "asc" | "desc";

export default function AthleteAbsenceRequestsPage() {
  const { selectedOrganizationId, canEdit } = useAuth();

  const [tab, setTab] = useState<"pending" | "handled">("pending");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const status = tab === "pending" ? "PENDING" : "HANDLED";

  const { data, loading, refetch } = useQuery<any>(GET_ORG_EXCUSE_REQUESTS, {
    variables: { organizationId: selectedOrganizationId, status, requesterType: "ATHLETE" },
    skip: !selectedOrganizationId,
    fetchPolicy: "cache-and-network",
  });

  const [updateExcuse] = useMutation(UPDATE_EXCUSE_REQUEST, {
    onCompleted: () => {
      setUpdatingId(null);
      refetch();
      if (selected) {
        setSelected((prev: any) => ({ ...prev, status: prev._pendingStatus }));
      }
    },
    onError: () => setUpdatingId(null),
    refetchQueries: ["GetPendingExcuseRequests"],
  });

  const handleUpdate = (id: string, newStatus: "APPROVED" | "DENIED") => {
    setUpdatingId(id);
    if (selected?.id === id) setSelected((prev: any) => ({ ...prev, _pendingStatus: newStatus }));
    updateExcuse({ variables: { input: { id, status: newStatus } } });
  };

  const excuses: any[] = data?.orgExcuseRequests || [];

  const filtered = excuses.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${e.user.firstName} ${e.user.lastName}`.toLowerCase().includes(q) ||
      e.event.title.toLowerCase().includes(q) ||
      (e.reason || "").toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let aVal: string, bVal: string;
    if (sortKey === "name") {
      aVal = `${a.user.lastName} ${a.user.firstName}`.toLowerCase();
      bVal = `${b.user.lastName} ${b.user.firstName}`.toLowerCase();
    } else if (sortKey === "event") {
      aVal = a.event.title.toLowerCase();
      bVal = b.event.title.toLowerCase();
    } else {
      aVal = String(a.event.date || a.createdAt);
      bVal = String(b.event.date || b.createdAt);
    }
    return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronDown className="w-3 h-3 text-white/20" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-white/70" />
      : <ChevronDown className="w-3 h-3 text-white/70" />;
  };

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
          <FileCheck className="w-8 h-8 text-white/40" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Not Authorized</h2>
        <p className="text-white/50 text-sm">You don&apos;t have permission to view absence requests.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Athlete Absence Requests</h1>
        <p className="text-white/50 text-sm mt-1">Review and manage athlete time-off requests</p>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex bg-white/5 rounded-xl p-1 gap-1">
          {(["pending", "handled"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? "bg-[#6c5ce7] text-white" : "text-white/60 hover:text-white"
              }`}
            >
              {t === "pending" ? "Pending" : "Handled"}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, event, reason…"
            className="w-full pl-9 pr-3 py-2 bg-white/8 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#6c5ce7]/60"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_1fr_120px_100px_80px] gap-4 px-5 py-3 border-b border-white/8 text-xs font-medium text-white/40 uppercase tracking-wide">
          <button className="flex items-center gap-1 text-left hover:text-white/70 transition-colors" onClick={() => toggleSort("name")}>
            Athlete <SortIcon k="name" />
          </button>
          <button className="flex items-center gap-1 text-left hover:text-white/70 transition-colors" onClick={() => toggleSort("event")}>
            Event <SortIcon k="event" />
          </button>
          <button className="flex items-center gap-1 text-left hover:text-white/70 transition-colors" onClick={() => toggleSort("date")}>
            Date <SortIcon k="date" />
          </button>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileCheck className="w-10 h-10 text-white/20 mb-3" />
            <p className="text-white/50 text-sm">
              {search ? "No results for that search." : tab === "pending" ? "No pending requests." : "No handled requests."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {sorted.map((excuse) => {
              const isUpdating = updatingId === excuse.id;
              return (
                <div
                  key={excuse.id}
                  className="grid grid-cols-[1fr_1fr_120px_100px_80px] gap-4 px-5 py-3.5 items-center hover:bg-white/4 cursor-pointer transition-colors"
                  onClick={() => setSelected(excuse)}
                >
                  {/* Athlete */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar user={excuse.user} />
                    <span className="text-white text-sm font-medium truncate">
                      {excuse.user.firstName} {excuse.user.lastName}
                    </span>
                  </div>

                  {/* Event */}
                  <div className="min-w-0">
                    <p className="text-white/80 text-sm truncate">{excuse.event.title}</p>
                    {excuse.event.team?.name && (
                      <p className="text-white/40 text-xs truncate">{excuse.event.team.name}</p>
                    )}
                  </div>

                  {/* Date */}
                  <p className="text-white/60 text-sm">{formatDate(excuse.event.date)}</p>

                  {/* Status */}
                  <StatusBadge status={excuse.status} />

                  {/* Quick actions */}
                  <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {excuse.status !== "APPROVED" && (
                      <button
                        onClick={() => handleUpdate(excuse.id, "APPROVED")}
                        disabled={isUpdating}
                        title="Approve"
                        className="p-1.5 bg-green-600/20 text-green-500 rounded hover:bg-green-600/30 disabled:opacity-40 transition-colors"
                      >
                        {isUpdating ? (
                          <div className="w-4 h-4 border border-green-500/50 border-t-green-500 rounded-full animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    {excuse.status !== "DENIED" && (
                      <button
                        onClick={() => handleUpdate(excuse.id, "DENIED")}
                        disabled={isUpdating}
                        title="Deny"
                        className="p-1.5 bg-red-600/20 text-red-500 rounded hover:bg-red-600/30 disabled:opacity-40 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <DetailModal
          excuse={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          updating={updatingId === selected.id}
        />
      )}
    </div>
  );
}
