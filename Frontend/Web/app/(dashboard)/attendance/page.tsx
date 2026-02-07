"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import {
  GET_EVENTS,
  GET_EVENT_ATTENDANCE,
  GET_EVENT_UNCHECKED_ATHLETES,
  UPDATE_EXCUSE_REQUEST,
  GET_PENDING_EXCUSE_REQUESTS,
  ADMIN_CHECK_IN,
  CHECK_OUT,
} from "@/lib/graphql";
import { CheckCircle, XCircle, Clock, AlertCircle, ChevronDown, UserPlus, LogOut, X, Search } from "lucide-react";

type AttendanceRecord = {
  id: string;
  status: "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED";
  checkInTime?: string;
  checkOutTime?: string;
  hoursLogged?: number;
  note?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    image?: string;
  };
};

type Event = {
  id: string;
  title: string;
  type: string;
  date: string;
  startTime: string;
  endTime: string;
  team?: {
    id: string;
    name: string;
  };
};

type UncheckedAthlete = {
  id: string;
  firstName: string;
  lastName: string;
};

const STATUS_CONFIG = {
  ON_TIME: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/20", label: "On Time" },
  LATE: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/20", label: "Late" },
  ABSENT: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/20", label: "Absent" },
  EXCUSED: { icon: AlertCircle, color: "text-purple-500", bg: "bg-purple-500/20", label: "Excused" },
};

function AdminCheckInModal({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<"ON_TIME" | "LATE" | "EXCUSED">("ON_TIME");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [checkInAnother, setCheckInAnother] = useState(false);

  const { data, loading, refetch: refetchUnchecked } = useQuery(GET_EVENT_UNCHECKED_ATHLETES, {
    variables: { eventId },
  });

  const [adminCheckIn, { loading: submitting }] = useMutation(ADMIN_CHECK_IN, {
    refetchQueries: [
      { query: GET_EVENT_ATTENDANCE, variables: { eventId } },
      { query: GET_EVENT_UNCHECKED_ATHLETES, variables: { eventId } },
    ],
  });

  const athletes: UncheckedAthlete[] = data?.eventUncheckedAthletes || [];
  const filtered = athletes.filter((a) =>
    `${a.firstName} ${a.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selectedUserId) return;
    try {
      await adminCheckIn({
        variables: {
          input: {
            userId: selectedUserId,
            eventId,
            status,
            ...(status === "EXCUSED" && note ? { note } : {}),
          },
        },
      });
      if (checkInAnother) {
        setSelectedUserId(null);
        setStatus("ON_TIME");
        setNote("");
        setSearch("");
      } else {
        onClose();
      }
    } catch (error) {
      console.error("Failed to check in athlete:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Check In Athlete</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search athletes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
          </div>

          {/* Athlete List */}
          <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-700 rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">
                {athletes.length === 0 ? "All athletes are checked in" : "No matching athletes"}
              </p>
            ) : (
              filtered.map((athlete) => (
                <button
                  key={athlete.id}
                  onClick={() => setSelectedUserId(athlete.id)}
                  className={`w-full flex items-center px-4 py-3 text-left transition-colors ${
                    selectedUserId === athlete.id
                      ? "bg-purple-600/20 border-l-2 border-purple-500"
                      : "hover:bg-gray-700/50"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-medium shrink-0">
                    {athlete.firstName[0]}
                    {athlete.lastName[0]}
                  </div>
                  <span className="ml-3 text-white text-sm">
                    {athlete.firstName} {athlete.lastName}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Status Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
            <div className="flex gap-2">
              {(["ON_TIME", "LATE", "EXCUSED"] as const).map((s) => {
                const colors = {
                  ON_TIME: selectedUserId && status === s ? "bg-green-600 text-white" : "bg-gray-700 text-green-400 border border-gray-600 hover:bg-green-600/20",
                  LATE: selectedUserId && status === s ? "bg-yellow-600 text-white" : "bg-gray-700 text-yellow-400 border border-gray-600 hover:bg-yellow-600/20",
                  EXCUSED: selectedUserId && status === s ? "bg-purple-600 text-white" : "bg-gray-700 text-purple-400 border border-gray-600 hover:bg-purple-600/20",
                };
                const labels = { ON_TIME: "On Time", LATE: "Late", EXCUSED: "Excused" };
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${colors[s]}`}
                  >
                    {labels[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note (conditional) */}
          {status === "EXCUSED" && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Note (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Reason for excused absence..."
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none"
              />
            </div>
          )}

          {/* Check in another toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={checkInAnother}
                onChange={(e) => setCheckInAnother(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-600 rounded-full peer-checked:bg-purple-600 transition-colors"></div>
              <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
            </div>
            <span className="text-sm text-gray-300">Check in another</span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedUserId || submitting}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Checking in..." : "Check In"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Attendance() {
  const { selectedOrganizationId, canEdit } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  const { data: eventsData, loading: eventsLoading } = useQuery(GET_EVENTS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const { data: attendanceData, loading: attendanceLoading, refetch: refetchAttendance } = useQuery(
    GET_EVENT_ATTENDANCE,
    {
      variables: { eventId: selectedEventId },
      skip: !selectedEventId,
    }
  );

  const { data: excusesData, refetch: refetchExcuses } = useQuery(GET_PENDING_EXCUSE_REQUESTS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const [updateExcuseRequest] = useMutation(UPDATE_EXCUSE_REQUEST);
  const [checkOut] = useMutation(CHECK_OUT, {
    refetchQueries: selectedEventId
      ? [{ query: GET_EVENT_ATTENDANCE, variables: { eventId: selectedEventId } }]
      : [],
  });

  const events: Event[] = eventsData?.events || [];
  const attendance: AttendanceRecord[] = attendanceData?.eventAttendance || [];
  const pendingExcuses = excusesData?.pendingExcuseRequests || [];

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  // Stats
  const stats = {
    total: attendance.length,
    onTime: attendance.filter((a) => a.status === "ON_TIME").length,
    late: attendance.filter((a) => a.status === "LATE").length,
    absent: attendance.filter((a) => a.status === "ABSENT").length,
    excused: attendance.filter((a) => a.status === "EXCUSED").length,
  };

  const handleExcuseAction = async (excuseId: string, status: "APPROVED" | "DENIED") => {
    try {
      await updateExcuseRequest({
        variables: {
          input: { id: excuseId, status },
        },
      });
      refetchExcuses();
      if (selectedEventId) refetchAttendance();
    } catch (error) {
      console.error("Failed to update excuse request:", error);
    }
  };

  const handleCheckOut = async (checkInId: string) => {
    try {
      await checkOut({ variables: { input: { checkInId } } });
    } catch (error) {
      console.error("Failed to check out:", error);
    }
  };

  if (eventsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Attendance</h1>
        <p className="text-gray-400 mt-1">Track and manage event attendance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Event Selection & Attendance */}
        <div className="lg:col-span-2 space-y-6">
          {/* Event Selector */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">Select Event</label>
            <div className="relative">
              <select
                value={selectedEventId || ""}
                onChange={(e) => setSelectedEventId(e.target.value || null)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
              >
                <option value="">Choose an event...</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} - {new Date(event.date).toLocaleDateString()} ({event.startTime})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {selectedEvent && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                  <p className="text-gray-400 text-sm">Total</p>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
                  <p className="text-2xl font-bold text-green-500">{stats.onTime}</p>
                  <p className="text-gray-400 text-sm">On Time</p>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-500">{stats.late}</p>
                  <p className="text-gray-400 text-sm">Late</p>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
                  <p className="text-2xl font-bold text-red-500">{stats.absent}</p>
                  <p className="text-gray-400 text-sm">Absent</p>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
                  <p className="text-2xl font-bold text-purple-500">{stats.excused}</p>
                  <p className="text-gray-400 text-sm">Excused</p>
                </div>
              </div>

              {/* Attendance List */}
              <div className="bg-gray-800 rounded-xl border border-gray-700">
                <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selectedEvent.title}</h2>
                    <p className="text-gray-400 text-sm">
                      {new Date(selectedEvent.date).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}{" "}
                      • {selectedEvent.startTime} - {selectedEvent.endTime}
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => setShowCheckInModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      Check In
                    </button>
                  )}
                </div>

                {attendanceLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                  </div>
                ) : attendance.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400">No attendance records yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {attendance.map((record) => {
                      const config = STATUS_CONFIG[record.status];
                      const Icon = config.icon;
                      const canCheckOut =
                        canEdit &&
                        record.checkInTime &&
                        !record.checkOutTime &&
                        (record.status === "ON_TIME" || record.status === "LATE");
                      return (
                        <div key={record.id} className="px-6 py-4 flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium">
                              {record.user.firstName[0]}
                              {record.user.lastName[0]}
                            </div>
                            <div className="ml-4">
                              <p className="text-white font-medium">
                                {record.user.firstName} {record.user.lastName}
                              </p>
                              {record.checkInTime && (
                                <p className="text-gray-400 text-sm">
                                  In: {new Date(record.checkInTime).toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                  {record.checkOutTime &&
                                    ` • Out: ${new Date(record.checkOutTime).toLocaleTimeString("en-US", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}`}
                                </p>
                              )}
                              {record.note && (
                                <p className="text-gray-500 text-sm italic">{record.note}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            {record.hoursLogged != null && record.hoursLogged > 0 && (
                              <span className="text-gray-400 text-sm">
                                {record.hoursLogged.toFixed(1)}h
                              </span>
                            )}
                            {canCheckOut && (
                              <button
                                onClick={() => handleCheckOut(record.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg text-sm font-medium hover:bg-orange-500/30 transition-colors"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                                Check Out
                              </button>
                            )}
                            <div className={`flex items-center px-3 py-1 rounded-lg ${config.bg}`}>
                              <Icon className={`w-4 h-4 ${config.color} mr-1`} />
                              <span className={`text-sm font-medium ${config.color}`}>
                                {config.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {!selectedEvent && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
              <p className="text-gray-400">Select an event to view attendance</p>
            </div>
          )}
        </div>

        {/* Right Column - Pending Excuses */}
        <div>
          <div className="bg-gray-800 rounded-xl border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Pending Excuses</h2>
              <p className="text-gray-400 text-sm">{pendingExcuses.length} requests</p>
            </div>

            {pendingExcuses.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-gray-400">All caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {pendingExcuses.map((excuse: any) => (
                  <div key={excuse.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-medium">
                          {excuse.user.firstName[0]}
                          {excuse.user.lastName[0]}
                        </div>
                        <div className="ml-3">
                          <p className="text-white font-medium text-sm">
                            {excuse.user.firstName} {excuse.user.lastName}
                          </p>
                          <p className="text-gray-400 text-xs">{excuse.event.title}</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm mb-3">{excuse.reason}</p>
                    {canEdit && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleExcuseAction(excuse.id, "APPROVED")}
                          className="flex-1 py-2 bg-green-600/20 text-green-500 rounded-lg text-sm font-medium hover:bg-green-600/30 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleExcuseAction(excuse.id, "DENIED")}
                          className="flex-1 py-2 bg-red-600/20 text-red-500 rounded-lg text-sm font-medium hover:bg-red-600/30 transition-colors"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Check In Modal */}
      {showCheckInModal && selectedEventId && (
        <AdminCheckInModal
          eventId={selectedEventId}
          onClose={() => setShowCheckInModal(false)}
        />
      )}
    </div>
  );
}
