"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import {
  GET_PENDING_EXCUSE_REQUESTS,
  GET_ALL_ATTENDANCE_RECORDS,
  GET_PENDING_AD_HOC_CHECK_INS,
  UPDATE_EXCUSE_REQUEST,
  CHECK_OUT,
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
  EXCUSED: { icon: AlertCircle, color: "text-purple-500", bg: "bg-purple-500/20", label: "Excused" },
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
      className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-white transition-colors"
    >
      {label}
      {isActive ? (
        currentDir === "asc" ? (
          <ChevronUp className="w-3.5 h-3.5 text-purple-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 text-gray-600" />
      )}
    </button>
  );
}

// ============================================
// Main Attendance Page
// ============================================

export default function Attendance() {
  const { selectedOrganizationId, canEdit } = useAuth();
  const [activeTab, setActiveTab] = useState<"attendance" | "excuses" | "adhoc">("attendance");
  const autoAbsentFired = useRef(false);

  // Table state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED">("ALL");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Queries
  const {
    data: recordsData,
    loading: recordsLoading,
    refetch: refetchRecords,
  } = useQuery<any>(GET_ALL_ATTENDANCE_RECORDS, {
    variables: { organizationId: selectedOrganizationId, limit: 200 },
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
        .then(() => refetchRecords())
        .catch((err) => console.error("Auto-absent failed:", err));
    }
  }, [selectedOrganizationId, canEdit]);

  const allRecords: AttendanceRecord[] = recordsData?.allAttendanceRecords || [];
  const pendingExcuses = excusesData?.pendingExcuseRequests || [];
  const pendingAdHocCheckIns = adHocData?.pendingAdHocCheckIns || [];

  // Filter + sort
  const filteredSorted = useMemo(() => {
    let result = [...allRecords];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          `${r.user.firstName} ${r.user.lastName}`.toLowerCase().includes(q) ||
          r.event.title.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "ALL") {
      result = result.filter((r) => r.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = `${a.user.firstName} ${a.user.lastName}`.localeCompare(
            `${b.user.firstName} ${b.user.lastName}`
          );
          break;
        case "event":
          cmp = a.event.title.localeCompare(b.event.title);
          break;
        case "date":
          cmp = new Date(isNaN(Number(a.event.date)) ? a.event.date : Number(a.event.date)).getTime() - new Date(isNaN(Number(b.event.date)) ? b.event.date : Number(b.event.date)).getTime();
          break;
        case "status": {
          const order = { ON_TIME: 0, LATE: 1, ABSENT: 2, EXCUSED: 3 };
          cmp = order[a.status] - order[b.status];
          break;
        }
        case "checkIn":
          cmp =
            (a.checkInTime ? new Date(a.checkInTime).getTime() : 0) -
            (b.checkInTime ? new Date(b.checkInTime).getTime() : 0);
          break;
        case "checkOut":
          cmp =
            (a.checkOutTime ? new Date(a.checkOutTime).getTime() : 0) -
            (b.checkOutTime ? new Date(b.checkOutTime).getTime() : 0);
          break;
        case "hours":
          cmp = (a.hoursLogged || 0) - (b.hoursLogged || 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [allRecords, searchQuery, statusFilter, sortField, sortDir]);

  // Reset to first page when filters/search/sort change
  useEffect(() => {
    setPage(0);
  }, [searchQuery, statusFilter, sortField, sortDir, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const paginatedRecords = filteredSorted.slice(page * pageSize, (page + 1) * pageSize);

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
    refetchExcuses();
    refetchAdHoc();
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Attendance</h1>
          <p className="text-gray-400 mt-1">Track and manage event attendance</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setActiveTab("attendance")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "attendance"
              ? "bg-purple-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          Attendance
        </button>
        <button
          onClick={() => setActiveTab("excuses")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === "excuses"
              ? "bg-purple-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white"
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
              ? "bg-purple-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white"
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
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          {/* Toolbar: search + status filter */}
          <div className="px-6 py-4 border-b border-gray-700 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or event..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none pr-9 text-sm"
              >
                <option value="ALL">All Statuses</option>
                <option value="ON_TIME">On Time</option>
                <option value="LATE">Late</option>
                <option value="ABSENT">Absent</option>
                <option value="EXCUSED">Excused</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Table */}
          {recordsLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : filteredSorted.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                {allRecords.length === 0 ? "No attendance records yet" : "No records match your filters"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
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
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {paginatedRecords.map((record) => {
                    const config = STATUS_CONFIG[record.status];
                    const Icon = config.icon;
                    const canDoCheckOut =
                      canEdit &&
                      record.checkInTime &&
                      !record.checkOutTime &&
                      (record.status === "ON_TIME" || record.status === "LATE");

                    return (
                      <tr key={record.id} className="hover:bg-gray-700/30 transition-colors">
                        {/* Athlete */}
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-medium shrink-0">
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
                          <span className="text-gray-300 text-sm">{record.event.title}</span>
                        </td>
                        {/* Date */}
                        <td className="px-6 py-3">
                          <span className="text-gray-400 text-sm">
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
                          <span className="text-gray-400 text-sm">
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
                          <span className="text-gray-400 text-sm">
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
                          <span className="text-gray-400 text-sm">
                            {record.hoursLogged != null && record.hoursLogged > 0
                              ? `${record.hoursLogged.toFixed(1)}h`
                              : "—"}
                          </span>
                        </td>
                        {/* Actions */}
                        {canEdit && (
                          <td className="px-6 py-3">
                            {canDoCheckOut && (
                              <button
                                onClick={() => handleCheckOut(record.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-500/30 transition-colors"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                                Check Out
                              </button>
                            )}
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
          {!recordsLoading && filteredSorted.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs">Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 appearance-none"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-gray-500 text-xs">
                  &middot; {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filteredSorted.length)} of {filteredSorted.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-gray-400 text-xs px-2">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
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
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">Pending Excuse Requests</h2>
            <p className="text-gray-400 text-sm">{pendingExcuses.length} requests awaiting review</p>
          </div>

          {pendingExcuses.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-gray-400">All caught up! No pending excuse requests.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {pendingExcuses.map((excuse: any) => (
                <div key={excuse.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-medium">
                        {excuse.user.firstName[0]}
                        {excuse.user.lastName[0]}
                      </div>
                      <div className="ml-3">
                        <p className="text-white font-medium text-sm">
                          {excuse.user.firstName} {excuse.user.lastName}
                        </p>
                        <p className="text-gray-400 text-xs">
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
                  <p className="text-gray-300 text-sm mt-2 ml-[52px]">{excuse.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ad-Hoc Check-Ins Tab */}
      {activeTab === "adhoc" && (
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">Pending Ad-Hoc Check-Ins</h2>
            <p className="text-gray-400 text-sm">
              {pendingAdHocCheckIns.length} ad-hoc check-in{pendingAdHocCheckIns.length !== 1 ? "s" : ""} awaiting approval
            </p>
          </div>

          {adHocLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : pendingAdHocCheckIns.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-gray-400">No pending ad-hoc check-ins.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {pendingAdHocCheckIns.map((checkIn: any) => (
                <div key={checkIn.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-medium">
                        {checkIn.user.firstName[0]}
                        {checkIn.user.lastName[0]}
                      </div>
                      <div className="ml-3">
                        <p className="text-white font-medium text-sm">
                          {checkIn.user.firstName} {checkIn.user.lastName}
                        </p>
                        <p className="text-gray-400 text-xs">
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
                      <MessageCircle className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
                      <p className="text-gray-300 text-sm">{checkIn.note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
