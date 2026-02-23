"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import {
  GET_PENDING_EXCUSE_REQUESTS,
  GET_ALL_ATTENDANCE_RECORDS,
  GET_ATTENDANCE_RECORDS_COUNT,
  GET_PENDING_AD_HOC_CHECK_INS,
  GET_TEAMS,
  UPDATE_EXCUSE_REQUEST,
  CHECK_OUT,
  ADMIN_CHECK_IN,
  DELETE_CHECK_IN,
  MARK_ABSENT_FOR_PAST_EVENTS,
  APPROVE_AD_HOC_CHECK_IN,
  DENY_AD_HOC_CHECK_IN,
} from "@/lib/graphql";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  LogOut,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Users,
  MessageCircle,
  Edit2,
  X,
} from "lucide-react";

// ============================================
// Types
// ============================================

type AttendanceRecord = {
  id: string;
  status: "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED";
  checkInTime?: string;
  checkOutTime?: string;
  hoursLogged?: number;
  note?: string;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; image?: string };
  event: { id: string; title: string; date: string; startTime: string; endTime: string };
};

type SortField = "name" | "event" | "date" | "status" | "checkIn" | "checkOut" | "hours";
type SortDir = "asc" | "desc";

const STATUS_CONFIG = {
  ON_TIME: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/20", label: "On Time" },
  LATE: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/20", label: "Late" },
  ABSENT: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/20", label: "Absent" },
  EXCUSED: { icon: AlertCircle, color: "text-[#6c5ce7]", bg: "bg-[#a855f7]/15", label: "Excused" },
};

// ============================================
// Sortable Table Header
// ============================================

function SortHeader({
  label,
  field,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentSort === field;
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-white/55 uppercase tracking-wider hover:text-white transition-colors"
    >
      {label}
      {isActive ? (
        currentDir === "asc" ? (
          <ChevronUp className="w-3.5 h-3.5 text-[#a78bfa]" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[#a78bfa]" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 text-white/30" />
      )}
    </button>
  );
}

// ============================================
// Main Attendance Page
// ============================================

export default function Attendance() {
  const { selectedOrganizationId, canEdit } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"attendance" | "excuses" | "adhoc">("attendance");
  const [modifyRecord, setModifyRecord] = useState<AttendanceRecord | null>(null);
  const autoAbsentFired = useRef(false);

  // Table state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState(""); // debounced → searchQuery
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED">("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<"ALL" | "TODAY" | "WEEK" | "MONTH" | "CUSTOM">("ALL");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Debounce search input so we don't fire a query on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 0 when filters/sort change
  useEffect(() => { setPage(0); }, [searchQuery, statusFilter, teamFilter, dateFilter, customStart, customEnd, sortField, sortDir, pageSize]);

  // Compute startDate/endDate from date filter
  const dateBounds = useMemo(() => {
    if (dateFilter === "CUSTOM") {
      if (!customStart) return { startDate: undefined, endDate: undefined };
      const [sy, sm, sd] = customStart.split("-").map(Number);
      const startUTC = new Date(Date.UTC(sy, sm - 1, sd));
      const endStr = customEnd || customStart;
      const [ey, em, ed] = endStr.split("-").map(Number);
      const endUTC = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999));
      return { startDate: startUTC.toISOString(), endDate: endUTC.toISOString() };
    }
    if (dateFilter === "ALL") return { startDate: undefined, endDate: undefined };
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    if (dateFilter === "TODAY") return {
      startDate: new Date(Date.UTC(y, m, d)).toISOString(),
      endDate: new Date(Date.UTC(y, m, d, 23, 59, 59, 999)).toISOString(),
    };
    if (dateFilter === "WEEK") {
      const weekStart = d - now.getDay();
      return {
        startDate: new Date(Date.UTC(y, m, weekStart)).toISOString(),
        endDate: new Date(Date.UTC(y, m, weekStart + 6, 23, 59, 59, 999)).toISOString(),
      };
    }
    if (dateFilter === "MONTH") return {
      startDate: new Date(Date.UTC(y, m, 1)).toISOString(),
      endDate: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)).toISOString(),
    };
    return { startDate: undefined, endDate: undefined };
  }, [dateFilter, customStart, customEnd]);

  const recordsVariables = useMemo(() => ({
    organizationId: selectedOrganizationId,
    search: searchQuery || undefined,
    status: statusFilter !== "ALL" ? statusFilter : undefined,
    teamId: teamFilter !== "ALL" ? teamFilter : undefined,
    startDate: dateBounds.startDate,
    endDate: dateBounds.endDate,
    sortField,
    sortDir,
    limit: pageSize,
    offset: page * pageSize,
  }), [selectedOrganizationId, searchQuery, statusFilter, teamFilter, dateBounds, sortField, sortDir, pageSize, page]);

  const countVariables = useMemo(() => ({
    organizationId: selectedOrganizationId,
    search: searchQuery || undefined,
    status: statusFilter !== "ALL" ? statusFilter : undefined,
    teamId: teamFilter !== "ALL" ? teamFilter : undefined,
    startDate: dateBounds.startDate,
    endDate: dateBounds.endDate,
  }), [selectedOrganizationId, searchQuery, statusFilter, teamFilter, dateBounds]);

  // Queries
  const {
    data: recordsData,
    loading: recordsLoading,
    refetch: refetchRecords,
  } = useQuery<any>(GET_ALL_ATTENDANCE_RECORDS, {
    variables: recordsVariables,
    skip: !selectedOrganizationId,
  });

  const { data: countData, refetch: refetchCount } = useQuery<any>(GET_ATTENDANCE_RECORDS_COUNT, {
    variables: countVariables,
    skip: !selectedOrganizationId,
  });

  const { data: excusesData, refetch: refetchExcuses } = useQuery<any>(GET_PENDING_EXCUSE_REQUESTS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const { data: adHocData, loading: adHocLoading, refetch: refetchAdHoc } = useQuery<any>(GET_PENDING_AD_HOC_CHECK_INS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const { data: teamsData } = useQuery<any>(GET_TEAMS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });
  const allTeams: { id: string; name: string }[] = teamsData?.teams || [];

  // Mutations
  const [markAbsentForPastEvents] = useMutation<any>(MARK_ABSENT_FOR_PAST_EVENTS);
  const [approveAdHocCheckIn] = useMutation<any>(APPROVE_AD_HOC_CHECK_IN);
  const [denyAdHocCheckIn] = useMutation<any>(DENY_AD_HOC_CHECK_IN);
  const [updateExcuseRequest] = useMutation<any>(UPDATE_EXCUSE_REQUEST);
  const [checkOut] = useMutation<any>(CHECK_OUT);

  // Auto-absent on mount
  useEffect(() => {
    if (selectedOrganizationId && canEdit && !autoAbsentFired.current) {
      autoAbsentFired.current = true;
      markAbsentForPastEvents({
        variables: { organizationId: selectedOrganizationId },
      })
        .then(() => { refetchRecords(); refetchCount(); })
        .catch((err) => console.error("Auto-absent failed:", err));
    }
  }, [selectedOrganizationId, canEdit]);

  // Server returns exactly the current page, pre-filtered and pre-sorted
  const paginatedRecords: AttendanceRecord[] = recordsData?.allAttendanceRecords || [];
  const totalCount: number = countData?.attendanceRecordsCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const pendingExcuses = excusesData?.pendingExcuseRequests || [];
  const pendingAdHocCheckIns = adHocData?.pendingAdHocCheckIns || [];

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleExcuseAction = async (excuseId: string, status: "APPROVED" | "DENIED") => {
    try {
      await updateExcuseRequest({ variables: { input: { id: excuseId, status } } });
      refetchExcuses();
      refetchRecords();
      refetchCount();
    } catch (error) {
      console.error("Failed to update excuse request:", error);
    }
  };

  const handleCheckOut = async (checkInId: string) => {
    try {
      await checkOut({ variables: { input: { checkInId } } });
      refetchRecords();
    } catch (error) {
      console.error("Failed to check out:", error);
    }
  };

  const handleApproveAdHoc = async (checkInId: string) => {
    try {
      await approveAdHocCheckIn({ variables: { checkInId } });
      refetchAdHoc();
      refetchRecords();
      refetchCount();
    } catch (error) {
      console.error("Failed to approve ad-hoc check-in:", error);
    }
  };

  const handleDenyAdHoc = async (checkInId: string) => {
    try {
      await denyAdHocCheckIn({ variables: { checkInId } });
      refetchAdHoc();
    } catch (error) {
      console.error("Failed to deny ad-hoc check-in:", error);
    }
  };

  const refetchAll = () => {
    refetchRecords();
    refetchCount();
    refetchExcuses();
    refetchAdHoc();
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Attendance</h1>
          <p className="text-white/55 mt-1">Track and manage event attendance</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setActiveTab("attendance")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "attendance"
              ? "bg-[#6c5ce7] text-white"
              : "bg-white/8 text-white/55 hover:text-white"
          }`}
        >
          Attendance
        </button>
        <button
          onClick={() => setActiveTab("excuses")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === "excuses"
              ? "bg-[#6c5ce7] text-white"
              : "bg-white/8 text-white/55 hover:text-white"
          }`}
        >
          Pending Excuses
          {pendingExcuses.length > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {pendingExcuses.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("adhoc")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === "adhoc"
              ? "bg-[#6c5ce7] text-white"
              : "bg-white/8 text-white/55 hover:text-white"
          }`}
        >
          Ad-Hoc Check-Ins
          {pendingAdHocCheckIns.length > 0 && (
            <span className="bg-yellow-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {pendingAdHocCheckIns.length}
            </span>
          )}
        </button>
      </div>

      {/* Attendance Tab */}
      {activeTab === "attendance" && (
        <div className="bg-white/8 rounded-xl border border-white/8">
          {/* Toolbar */}
          <div className="px-6 py-4 border-b border-white/8 flex flex-col gap-3">
            {/* Row 1: Date filter pills | date inputs */}
            <div className="flex items-center gap-2 flex-wrap">
              {(["ALL", "TODAY", "WEEK", "MONTH", "CUSTOM"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setDateFilter(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    dateFilter === v
                      ? "bg-white/12 text-white"
                      : "bg-white/8 text-white/40 border border-white/8 hover:text-white/75"
                  }`}
                >
                  {v === "ALL" ? "All Time" : v === "TODAY" ? "Today" : v === "WEEK" ? "This Week" : v === "MONTH" ? "This Month" : "Custom"}
                </button>
              ))}

              <div className="h-4 w-px bg-white/8 mx-1" />

              <input
                type="date"
                value={customStart}
                onChange={(e) => { setCustomStart(e.target.value); setDateFilter("CUSTOM"); }}
                className={`px-2 py-1.5 bg-white/8 border border-white/8 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#6c5ce7] [color-scheme:dark] transition-colors ${
                  dateFilter === "CUSTOM" ? "text-white/80" : "text-white/30"
                }`}
              />
              <span className="text-white/30 text-xs">—</span>
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => { setCustomEnd(e.target.value); setDateFilter("CUSTOM"); }}
                className={`px-2 py-1.5 bg-white/8 border border-white/8 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#6c5ce7] [color-scheme:dark] transition-colors ${
                  dateFilter === "CUSTOM" ? "text-white/80" : "text-white/30"
                }`}
              />
            </div>

            {/* Row 2: Search + Team + Status */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" />
                <input
                  type="text"
                  placeholder="Search by athlete or event..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/8 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] text-sm"
                />
              </div>
              {/* Team filter */}
              <div className="relative">
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="px-4 py-2 bg-white/8 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] appearance-none pr-9 text-sm"
                >
                  <option value="ALL">All Teams</option>
                  {allTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55 pointer-events-none" />
              </div>
              {/* Status filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-4 py-2 bg-white/8 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] appearance-none pr-9 text-sm"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ON_TIME">On Time</option>
                  <option value="LATE">Late</option>
                  <option value="ABSENT">Absent</option>
                  <option value="EXCUSED">Excused</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Table */}
          {recordsLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6c5ce7]"></div>
            </div>
          ) : paginatedRecords.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-white/30 mx-auto mb-4" />
              <p className="text-white/55">
                {totalCount === 0 && !searchQuery && statusFilter === "ALL" && teamFilter === "ALL" && dateFilter === "ALL"
                  ? "No attendance records yet"
                  : "No records match your filters"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="px-6 py-3 text-left">
                      <SortHeader label="Athlete" field="name" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
                    </th>
                    <th className="px-6 py-3 text-left">
                      <SortHeader label="Event" field="event" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
                    </th>
                    <th className="px-6 py-3 text-left">
                      <SortHeader label="Date" field="date" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
                    </th>
                    <th className="px-6 py-3 text-left">
                      <SortHeader label="Status" field="status" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
                    </th>
                    <th className="px-6 py-3 text-left">
                      <SortHeader label="Check In" field="checkIn" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
                    </th>
                    <th className="px-6 py-3 text-left">
                      <SortHeader label="Check Out" field="checkOut" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
                    </th>
                    <th className="px-6 py-3 text-left">
                      <SortHeader label="Hours" field="hours" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
                    </th>
                    {canEdit && (
                      <th className="px-6 py-3 text-left">
                        <span className="text-xs font-medium text-white/55 uppercase tracking-wider">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {paginatedRecords.map((record) => {
                    const config = STATUS_CONFIG[record.status];
                    const Icon = config.icon;
                    const canDoCheckOut =
                      canEdit &&
                      record.checkInTime &&
                      !record.checkOutTime &&
                      (record.status === "ON_TIME" || record.status === "LATE");

                    return (
                      <tr
                        key={record.id}
                        onClick={() => router.push(`/events/${record.event.id}`)}
                        className="hover:bg-white/4 transition-colors cursor-pointer"
                      >
                        {/* Athlete */}
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-xs font-medium shrink-0">
                              {record.user.firstName[0]}
                              {record.user.lastName[0]}
                            </div>
                            <span className="text-white text-sm font-medium">
                              {record.user.firstName} {record.user.lastName}
                            </span>
                          </div>
                        </td>
                        {/* Event */}
                        <td className="px-6 py-3">
                          <span className="text-white/75 text-sm">{record.event.title}</span>
                        </td>
                        {/* Date */}
                        <td className="px-6 py-3">
                          <span className="text-white/55 text-sm">
                            {new Date(isNaN(Number(record.event.date)) ? record.event.date : Number(record.event.date)).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </td>
                        {/* Status */}
                        <td className="px-6 py-3">
                          <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg ${config.bg}`}>
                            <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                            <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                          </div>
                        </td>
                        {/* Check In */}
                        <td className="px-6 py-3">
                          <span className="text-white/55 text-sm">
                            {record.checkInTime
                              ? new Date(record.checkInTime).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </span>
                        </td>
                        {/* Check Out */}
                        <td className="px-6 py-3">
                          <span className="text-white/55 text-sm">
                            {record.checkOutTime
                              ? new Date(record.checkOutTime).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </span>
                        </td>
                        {/* Hours */}
                        <td className="px-6 py-3">
                          <span className="text-white/55 text-sm">
                            {record.hoursLogged != null && record.hoursLogged > 0
                              ? `${record.hoursLogged.toFixed(1)}h`
                              : "—"}
                          </span>
                        </td>
                        {/* Actions */}
                        {canEdit && (
                          <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              {canDoCheckOut && (
                                <button
                                  onClick={() => handleCheckOut(record.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-500/30 transition-colors"
                                >
                                  <LogOut className="w-3.5 h-3.5" />
                                  Check Out
                                </button>
                              )}
                              <button
                                onClick={() => setModifyRecord(record)}
                                className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                title="Edit attendance"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!recordsLoading && totalCount > 0 && (
            <div className="px-6 py-3 border-t border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs">Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 bg-white/8 border border-white/10 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#6c5ce7] appearance-none"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-white/40 text-xs">
                  &middot; {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/55 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-white/55 text-xs px-2">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/55 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Excuses Tab */}
      {activeTab === "excuses" && (
        <div className="bg-white/8 rounded-xl border border-white/8">
          <div className="px-6 py-4 border-b border-white/8">
            <h2 className="text-lg font-semibold text-white">Pending Excuse Requests</h2>
            <p className="text-white/55 text-sm">{pendingExcuses.length} requests awaiting review</p>
          </div>

          {pendingExcuses.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-white/55">All caught up! No pending excuse requests.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/8">
              {pendingExcuses.map((excuse: any) => (
                <div key={excuse.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-sm font-medium">
                        {excuse.user.firstName[0]}
                        {excuse.user.lastName[0]}
                      </div>
                      <div className="ml-3">
                        <p className="text-white font-medium text-sm">
                          {excuse.user.firstName} {excuse.user.lastName}
                        </p>
                        <p className="text-white/55 text-xs">
                          {excuse.event.title} &middot;{" "}
                          {new Date(isNaN(Number(excuse.event.date)) ? excuse.event.date : Number(excuse.event.date)).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2 shrink-0 ml-4">
                        <button
                          onClick={() => handleExcuseAction(excuse.id, "APPROVED")}
                          className="px-4 py-1.5 bg-green-600/20 text-green-500 rounded-lg text-sm font-medium hover:bg-green-600/30 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleExcuseAction(excuse.id, "DENIED")}
                          className="px-4 py-1.5 bg-red-600/20 text-red-500 rounded-lg text-sm font-medium hover:bg-red-600/30 transition-colors"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 ml-[52px]">
                    <p className="text-white/75 text-sm">{excuse.reason}</p>
                    <span className="shrink-0 text-xs text-white/30 bg-white/[0.06] px-2 py-0.5 rounded-full">
                      Request {excuse.attemptCount}/3
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ad-Hoc Check-Ins Tab */}
      {activeTab === "adhoc" && (
        <div className="bg-white/8 rounded-xl border border-white/8">
          <div className="px-6 py-4 border-b border-white/8">
            <h2 className="text-lg font-semibold text-white">Pending Ad-Hoc Check-Ins</h2>
            <p className="text-white/55 text-sm">
              {pendingAdHocCheckIns.length} ad-hoc check-in{pendingAdHocCheckIns.length !== 1 ? "s" : ""} awaiting approval
            </p>
          </div>

          {adHocLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6c5ce7]"></div>
            </div>
          ) : pendingAdHocCheckIns.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-white/55">No pending ad-hoc check-ins.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/8">
              {pendingAdHocCheckIns.map((checkIn: any) => (
                <div key={checkIn.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-sm font-medium">
                        {checkIn.user.firstName[0]}
                        {checkIn.user.lastName[0]}
                      </div>
                      <div className="ml-3">
                        <p className="text-white font-medium text-sm">
                          {checkIn.user.firstName} {checkIn.user.lastName}
                        </p>
                        <p className="text-white/55 text-xs">
                          {checkIn.event.team?.name || "No team"} &middot;{" "}
                          {(() => {
                            const d = Number(checkIn.event.date);
                            return new Date(isNaN(d) ? checkIn.event.date : d).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            });
                          })()}
                          {checkIn.checkInTime && (
                            <>
                              {" "}at{" "}
                              {(() => {
                                const t = Number(checkIn.checkInTime);
                                return new Date(isNaN(t) ? checkIn.checkInTime : t).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                });
                              })()}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 bg-yellow-500/20 text-yellow-500 rounded-lg text-xs font-medium">
                        Ad-Hoc
                      </span>
                      {canEdit && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleApproveAdHoc(checkIn.id)}
                            className="px-4 py-1.5 bg-green-600/20 text-green-500 rounded-lg text-sm font-medium hover:bg-green-600/30 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleDenyAdHoc(checkIn.id)}
                            className="px-4 py-1.5 bg-red-600/20 text-red-500 rounded-lg text-sm font-medium hover:bg-red-600/30 transition-colors"
                          >
                            Deny
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {checkIn.note && (
                    <div className="flex items-start gap-2 mt-2 ml-[52px]">
                      <MessageCircle className="w-3.5 h-3.5 text-white/40 mt-0.5 shrink-0" />
                      <p className="text-white/75 text-sm">{checkIn.note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modify Attendance Modal */}
      {modifyRecord && (
        <ModifyAttendanceModal
          eventId={modifyRecord.event.id}
          userId={modifyRecord.user.id}
          athleteName={`${modifyRecord.user.firstName} ${modifyRecord.user.lastName}`}
          existingCheckIn={modifyRecord}
          onClose={() => setModifyRecord(null)}
          onSuccess={() => {
            setModifyRecord(null);
            refetchRecords();
            refetchCount();
          }}
        />
      )}
    </div>
  );
}

// ============================================
// ModifyAttendanceModal
// ============================================

function toLocalDatetimeValue(dateStr?: string | null): string {
  if (!dateStr) return "";
  const num = Number(dateStr);
  const d = isNaN(num) ? new Date(dateStr) : new Date(num);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${mins}`;
}

function ModifyAttendanceModal({
  eventId,
  userId,
  athleteName,
  existingCheckIn,
  onClose,
  onSuccess,
}: {
  eventId: string;
  userId: string;
  athleteName: string;
  existingCheckIn?: { id: string; status: string; checkInTime?: string; checkOutTime?: string; note?: string };
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState<string>(existingCheckIn?.status || "ON_TIME");
  const [note, setNote] = useState(existingCheckIn?.note || "");
  const [checkInTimeValue, setCheckInTimeValue] = useState(toLocalDatetimeValue(existingCheckIn?.checkInTime));
  const [checkOutTimeValue, setCheckOutTimeValue] = useState(toLocalDatetimeValue(existingCheckIn?.checkOutTime));
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [adminCheckIn] = useMutation<any>(ADMIN_CHECK_IN);
  const [deleteCheckIn] = useMutation<any>(DELETE_CHECK_IN);

  const handleClear = async () => {
    setClearing(true);
    try {
      await deleteCheckIn({ variables: { userId, eventId } });
      onSuccess();
    } catch (error) {
      console.error("Failed to clear attendance:", error);
    } finally {
      setClearing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminCheckIn({
        variables: {
          input: {
            userId,
            eventId,
            status,
            note: note.trim() || undefined,
            checkInTime: checkInTimeValue ? new Date(checkInTimeValue).toISOString() : null,
            checkOutTime: checkOutTimeValue ? new Date(checkOutTimeValue).toISOString() : null,
          },
        },
      });
      onSuccess();
    } catch (error) {
      console.error("Failed to update attendance:", error);
    } finally {
      setSaving(false);
    }
  };

  const STATUS_OPTIONS = [
    { value: "ON_TIME", label: "On Time", color: "bg-green-600 hover:bg-green-700" },
    { value: "LATE", label: "Late", color: "bg-yellow-600 hover:bg-yellow-700" },
    { value: "ABSENT", label: "Absent", color: "bg-red-600 hover:bg-red-700" },
    { value: "EXCUSED", label: "Excused", color: "bg-[#6c5ce7] hover:bg-[#5a4dd4]" },
  ];

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white/8 backdrop-blur-xl rounded-xl border border-white/15 shadow-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Modify Attendance</h2>
          <button onClick={onClose} className="text-white/55 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-white/55 text-sm mb-4">
          Updating attendance for <span className="text-white font-medium">{athleteName}</span>
        </p>

        {/* Status Buttons */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-white/55 mb-2">Status</label>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  status === opt.value
                    ? `${opt.color} text-white`
                    : "bg-white/8 text-white/55 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Check-In Time */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-white/55 mb-1">Check-In Time</label>
          <input
            type="datetime-local"
            value={checkInTimeValue}
            onChange={(e) => setCheckInTimeValue(e.target.value)}
            className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] [color-scheme:dark]"
          />
        </div>

        {/* Check-Out Time */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-white/55 mb-1">Check-Out Time</label>
          <input
            type="datetime-local"
            value={checkOutTimeValue}
            onChange={(e) => setCheckOutTimeValue(e.target.value)}
            className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] [color-scheme:dark]"
          />
        </div>

        {/* Note */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-white/55 mb-1">Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] resize-none"
            placeholder="Add a note..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          {existingCheckIn ? (
            <button
              onClick={handleClear}
              disabled={clearing || saving}
              className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-600/10 rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              {clearing ? "Clearing..." : "Clear Status"}
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-white/55 hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || clearing}
              className="px-4 py-2 bg-[#6c5ce7] text-white rounded-lg hover:bg-[#5a4dd4] transition-colors text-sm disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
