import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { GET_EVENTS, GET_EVENT_ATTENDANCE, UPDATE_EXCUSE_REQUEST, GET_PENDING_EXCUSE_REQUESTS } from "@/lib/graphql";
import { CheckCircle, XCircle, Clock, AlertCircle, ChevronDown } from "lucide-react";

type AttendanceRecord = {
  id: string;
  status: "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED";
  checkInTime?: string;
  checkOutTime?: string;
  hoursLogged?: number;
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

const STATUS_CONFIG = {
  ON_TIME: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/20", label: "On Time" },
  LATE: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/20", label: "Late" },
  ABSENT: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/20", label: "Absent" },
  EXCUSED: { icon: AlertCircle, color: "text-purple-500", bg: "bg-purple-500/20", label: "Excused" },
};

export function Attendance() {
  const { selectedOrganizationId, canEdit } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

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
                <div className="px-6 py-4 border-b border-gray-700">
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
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            {record.hoursLogged && (
                              <span className="text-gray-400 text-sm">
                                {record.hoursLogged.toFixed(1)}h
                              </span>
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
    </div>
  );
}
