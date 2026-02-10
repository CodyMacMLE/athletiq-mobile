"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { GET_EVENT_DETAIL, ADMIN_CHECK_IN, CHECK_OUT } from "@/lib/graphql";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Repeat,
  Search,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";

// ============================================
// Types
// ============================================

type TeamMember = {
  id: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    image?: string;
  };
};

type Team = {
  id: string;
  name: string;
  members: TeamMember[];
};

type CheckIn = {
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

type EventDetail = {
  id: string;
  title: string;
  type: "PRACTICE" | "EVENT" | "MEETING" | "REST";
  date: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
  recurringEvent?: { id: string } | null;
  team?: Team | null;
  participatingTeams: Team[];
  checkIns: CheckIn[];
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  PRACTICE: "bg-green-600/20 text-green-400",
  EVENT: "bg-red-600/20 text-red-400",
  MEETING: "bg-yellow-600/20 text-yellow-400",
  REST: "bg-gray-600/20 text-gray-400",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  PRACTICE: "Practice",
  EVENT: "Tournament",
  MEETING: "Meeting",
  REST: "Rest Day",
};

const STATUS_COLORS: Record<string, string> = {
  ON_TIME: "bg-green-600/20 text-green-400",
  LATE: "bg-yellow-600/20 text-yellow-400",
  ABSENT: "bg-red-600/20 text-red-400",
  EXCUSED: "bg-purple-600/20 text-purple-400",
};

const STATUS_LABELS: Record<string, string> = {
  ON_TIME: "On Time",
  LATE: "Late",
  ABSENT: "Absent",
  EXCUSED: "Excused",
};

function parseDate(dateStr: string) {
  const num = Number(dateStr);
  return isNaN(num) ? new Date(dateStr) : new Date(num);
}

// ============================================
// Main Page
// ============================================

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { canEdit } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [modifyAthlete, setModifyAthlete] = useState<{
    userId: string;
    name: string;
    checkIn?: CheckIn;
  } | null>(null);

  const { data, loading, refetch } = useQuery(GET_EVENT_DETAIL, {
    variables: { id: eventId },
    skip: !eventId,
  });

  const event: EventDetail | undefined = data?.event;

  // Collect all teams
  const allTeams = useMemo(() => {
    if (!event) return [];
    const teams: Team[] = [];
    if (event.team) teams.push(event.team);
    for (const t of event.participatingTeams) {
      if (!teams.some((existing) => existing.id === t.id)) {
        teams.push(t);
      }
    }
    return teams;
  }, [event]);

  // Extract coaches (COACH or ADMIN role) and athletes
  const { coaches, athletes } = useMemo(() => {
    const coachMap = new Map<string, TeamMember["user"]>();
    const athleteMap = new Map<string, TeamMember["user"]>();

    for (const team of allTeams) {
      for (const member of team.members) {
        if (member.role === "COACH" || member.role === "ADMIN") {
          coachMap.set(member.user.id, member.user);
        } else {
          athleteMap.set(member.user.id, member.user);
        }
      }
    }

    return {
      coaches: Array.from(coachMap.values()),
      athletes: Array.from(athleteMap.values()),
    };
  }, [allTeams]);

  // Build attendance rows: each athlete matched against checkIns
  const attendanceRows = useMemo(() => {
    if (!event) return [];
    const checkInMap = new Map<string, CheckIn>();
    for (const ci of event.checkIns) {
      checkInMap.set(ci.user.id, ci);
    }

    return athletes
      .map((athlete) => ({
        user: athlete,
        checkIn: checkInMap.get(athlete.id) || null,
      }))
      .sort((a, b) => {
        const nameA = `${a.user.firstName} ${a.user.lastName}`.toLowerCase();
        const nameB = `${b.user.firstName} ${b.user.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [event, athletes]);

  // Filter by search
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return attendanceRows;
    const q = searchQuery.toLowerCase();
    return attendanceRows.filter((row) => {
      const name = `${row.user.firstName} ${row.user.lastName}`.toLowerCase();
      return name.includes(q);
    });
  }, [attendanceRows, searchQuery]);

  const checkedInCount = attendanceRows.filter((r) => r.checkIn && r.checkIn.status !== "ABSENT").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Event not found</p>
        <Link href="/events" className="text-purple-400 hover:text-purple-300 mt-2 inline-block">
          Back to Events
        </Link>
      </div>
    );
  }

  // Date formatting
  const eventDate = parseDate(event.date);
  const isMultiDay = !!event.endDate;
  let dateLabel: string;
  if (isMultiDay) {
    const endDate = parseDate(event.endDate!);
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    dateLabel = `${fmt(eventDate)} - ${fmt(endDate)}`;
  } else {
    dateLabel = eventDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div>
      {/* Back Link */}
      <Link
        href="/events"
        className="flex items-center text-gray-400 hover:text-white transition-colors mb-4 text-sm w-fit"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Events
      </Link>

      {/* Event Summary */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <div className="flex items-start gap-3 mb-3">
          <span
            className={`px-3 py-1 rounded-lg text-xs font-medium ${
              EVENT_TYPE_COLORS[event.type] || "bg-gray-600/20 text-gray-400"
            }`}
          >
            {EVENT_TYPE_LABELS[event.type] || event.type}
          </span>
          {event.recurringEvent && (
            <span className="flex items-center text-xs text-purple-400">
              <Repeat className="w-3 h-3 mr-1" />
              Recurring
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">{event.title}</h1>

        <div className="flex items-center flex-wrap gap-4 text-sm text-gray-400">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1.5" />
            {dateLabel}
          </div>
          {!isMultiDay && (
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1.5" />
              {event.startTime} - {event.endTime}
            </div>
          )}
          {event.location && (
            <div className="flex items-center">
              <MapPin className="w-4 h-4 mr-1.5" />
              {event.location}
            </div>
          )}
        </div>

        {/* Teams */}
        {allTeams.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Users className="w-3.5 h-3.5 text-gray-500" />
            {allTeams.map((team) => (
              <span
                key={team.id}
                className="px-2 py-0.5 bg-purple-600/15 text-purple-400 rounded text-xs"
              >
                {team.name}
              </span>
            ))}
          </div>
        )}

        {event.description && (
          <p className="text-gray-500 text-sm mt-3">{event.description}</p>
        )}
      </div>

      {/* Coaches Section */}
      {coaches.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            Coaches
          </h2>
          <div className="flex flex-wrap gap-3">
            {coaches.map((coach) => (
              <div key={coach.id} className="flex items-center gap-2">
                {coach.image ? (
                  <img
                    src={coach.image}
                    alt={`${coach.firstName} ${coach.lastName}`}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-medium">
                    {coach.firstName[0]}
                    {coach.lastName[0]}
                  </div>
                )}
                <span className="text-white text-sm">
                  {coach.firstName} {coach.lastName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-medium">
            Attendance{" "}
            <span className="text-gray-400 font-normal">
              ({checkedInCount}/{athletes.length})
            </span>
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search athletes..."
              className="pl-9 pr-4 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-56"
            />
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-700">
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Check In</div>
          <div className="col-span-2">Check Out</div>
          <div className="col-span-1">Hours</div>
          <div className="col-span-2">Note</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-700/50">
          {filteredRows.map((row) => (
            <div
              key={row.user.id}
              onClick={() =>
                canEdit
                  ? setModifyAthlete({
                      userId: row.user.id,
                      name: `${row.user.firstName} ${row.user.lastName}`,
                      checkIn: row.checkIn || undefined,
                    })
                  : undefined
              }
              className={`grid grid-cols-12 gap-2 px-3 py-3 items-center text-sm ${
                canEdit ? "cursor-pointer hover:bg-gray-700/50 transition-colors" : ""
              }`}
            >
              {/* Name */}
              <div className="col-span-3 flex items-center gap-2">
                {row.user.image ? (
                  <img
                    src={row.user.image}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-medium">
                    {row.user.firstName[0]}
                    {row.user.lastName[0]}
                  </div>
                )}
                <span className="text-white truncate">
                  {row.user.firstName} {row.user.lastName}
                </span>
              </div>

              {/* Status */}
              <div className="col-span-2">
                {row.checkIn ? (
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      STATUS_COLORS[row.checkIn.status]
                    }`}
                  >
                    {STATUS_LABELS[row.checkIn.status]}
                  </span>
                ) : (
                  <span className="text-gray-500 text-xs">Not Checked In</span>
                )}
              </div>

              {/* Check In Time */}
              <div className="col-span-2 text-gray-400">
                {row.checkIn?.checkInTime
                  ? new Date(Number(row.checkIn.checkInTime)).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "—"}
              </div>

              {/* Check Out Time */}
              <div className="col-span-2 text-gray-400">
                {row.checkIn?.checkOutTime
                  ? new Date(Number(row.checkIn.checkOutTime)).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "—"}
              </div>

              {/* Hours */}
              <div className="col-span-1 text-gray-400">
                {row.checkIn?.hoursLogged != null
                  ? row.checkIn.hoursLogged.toFixed(2)
                  : "—"}
              </div>

              {/* Note */}
              <div className="col-span-2 text-gray-500 truncate">
                {row.checkIn?.note || "—"}
              </div>
            </div>
          ))}

          {filteredRows.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">
                {searchQuery ? "No athletes match your search" : "No athletes found"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modify Attendance Modal */}
      {modifyAthlete && (
        <ModifyAttendanceModal
          eventId={eventId}
          userId={modifyAthlete.userId}
          athleteName={modifyAthlete.name}
          existingCheckIn={modifyAthlete.checkIn}
          onClose={() => setModifyAthlete(null)}
          onSuccess={() => {
            setModifyAthlete(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// ============================================
// ModifyAttendanceModal
// ============================================

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
  existingCheckIn?: CheckIn;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState<string>(existingCheckIn?.status || "ON_TIME");
  const [note, setNote] = useState(existingCheckIn?.note || "");
  const [saving, setSaving] = useState(false);

  const [adminCheckIn] = useMutation(ADMIN_CHECK_IN);
  const [checkOut] = useMutation(CHECK_OUT);

  const canCheckOut =
    existingCheckIn &&
    (existingCheckIn.status === "ON_TIME" || existingCheckIn.status === "LATE") &&
    existingCheckIn.checkInTime &&
    !existingCheckIn.checkOutTime;

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

  const handleCheckOut = async () => {
    if (!existingCheckIn) return;
    setSaving(true);
    try {
      await checkOut({
        variables: {
          input: { checkInId: existingCheckIn.id },
        },
      });
      onSuccess();
    } catch (error) {
      console.error("Failed to check out:", error);
    } finally {
      setSaving(false);
    }
  };

  const STATUS_OPTIONS = [
    { value: "ON_TIME", label: "On Time", color: "bg-green-600 hover:bg-green-700" },
    { value: "LATE", label: "Late", color: "bg-yellow-600 hover:bg-yellow-700" },
    { value: "ABSENT", label: "Absent", color: "bg-red-600 hover:bg-red-700" },
    { value: "EXCUSED", label: "Excused", color: "bg-purple-600 hover:bg-purple-700" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Modify Attendance</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          Updating attendance for <span className="text-white font-medium">{athleteName}</span>
        </p>

        {/* Status Buttons */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  status === opt.value
                    ? `${opt.color} text-white`
                    : "bg-gray-700 text-gray-400 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-1">Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            placeholder="Add a note..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div>
            {canCheckOut && (
              <button
                onClick={handleCheckOut}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
              >
                Check Out
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
