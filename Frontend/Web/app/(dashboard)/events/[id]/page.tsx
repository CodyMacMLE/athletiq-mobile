"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import {
  GET_EVENT_DETAIL,
  GET_EVENTS,
  GET_TEAMS,
  GET_ORGANIZATION_VENUES,
  GET_ORGANIZATION_USERS,
  CREATE_EVENT,
  UPDATE_EVENT,
  DELETE_EVENT,
  DELETE_RECURRING_EVENT,
  ADMIN_CHECK_IN,
  CHECK_OUT,
  ADD_ATHLETE_TO_EVENT,
  REMOVE_ATHLETE_FROM_EVENT,
  EXCLUDE_ATHLETE_FROM_EVENT,
  UNEXCLUDE_ATHLETE_FROM_EVENT,
} from "@/lib/graphql";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit2,
  MapPin,
  Repeat,
  Search,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ============================================
// Types
// ============================================

type TeamMember = {
  id: string;
  role: string;
  joinedAt?: string;
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

type EventRsvp = {
  id: string;
  status: "GOING" | "NOT_GOING" | "MAYBE";
  note?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

type AthleteUser = {
  id: string;
  firstName: string;
  lastName: string;
  image?: string;
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
  venue?: { id: string; name: string; address?: string; city?: string } | null;
  team?: Team | null;
  participatingTeams: Team[];
  checkIns: CheckIn[];
  rsvps: EventRsvp[];
  includedAthletes: AthleteUser[];
  excludedAthletes: AthleteUser[];
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  PRACTICE: "bg-green-600/20 text-green-400",
  EVENT: "bg-red-600/20 text-red-400",
  MEETING: "bg-yellow-600/20 text-yellow-400",
  REST: "bg-white/10 text-white/55",
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
  EXCUSED: "bg-[#a855f7]/15 text-[#a78bfa]",
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
  const router = useRouter();
  const { canEdit, selectedOrganizationId } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showAddAthleteModal, setShowAddAthleteModal] = useState(false);
  const [excludedOpen, setExcludedOpen] = useState(false);
  const [modifyAthlete, setModifyAthlete] = useState<{
    userId: string;
    name: string;
    checkIn?: CheckIn;
  } | null>(null);

  const { data, loading, refetch } = useQuery<any>(GET_EVENT_DETAIL, {
    variables: { id: eventId },
    skip: !eventId,
  });

  const event: EventDetail | undefined = data?.event;

  const [updateEvent] = useMutation<any>(UPDATE_EVENT);
  const [deleteEvent] = useMutation<any>(DELETE_EVENT);
  const [deleteRecurringEvent] = useMutation<any>(DELETE_RECURRING_EVENT);
  const [addAthleteToEvent] = useMutation<any>(ADD_ATHLETE_TO_EVENT);
  const [removeAthleteFromEvent] = useMutation<any>(REMOVE_ATHLETE_FROM_EVENT);
  const [excludeAthleteFromEvent] = useMutation<any>(EXCLUDE_ATHLETE_FROM_EVENT);
  const [unexcludeAthleteFromEvent] = useMutation<any>(UNEXCLUDE_ATHLETE_FROM_EVENT);

  // Determine if the event has ended (past its end time)
  const eventHasEnded = useMemo(() => {
    if (!event) return false;
    const now = new Date();
    const eventDate = parseDate(event.date);
    const endDate = event.endDate ? parseDate(event.endDate) : eventDate;

    // For multi-day events, check if we're past the end date
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const eventEndUTC = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
    if (todayUTC > eventEndUTC) return true;
    if (todayUTC < eventEndUTC) return false;

    // Same day — check end time
    if (event.endTime && event.endTime !== "All Day") {
      const match = event.endTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (match) {
        let hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const period = match[3].toUpperCase();
        if (period === "PM" && hours !== 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        if (nowMinutes > hours * 60 + minutes) return true;
      }
    }
    return false;
  }, [event]);

  const handleUpdateEvent = async (formData: {
    title: string;
    type: string;
    date: string;
    endDate: string;
    isMultiDay: boolean;
    startTime: string;
    endTime: string;
    location: string;
    description: string;
    venueId: string;
  }) => {
    if (!event) return;
    try {
      await updateEvent({
        variables: {
          id: event.id,
          title: formData.title,
          type: formData.type,
          date: formData.date,
          endDate: formData.isMultiDay ? formData.endDate : null,
          startTime: formData.isMultiDay ? "All Day" : formData.startTime,
          endTime: formData.isMultiDay ? "All Day" : formData.endTime,
          location: formData.location || null,
          description: formData.description || null,
          venueId: formData.venueId || null,
        },
      });
      setIsEditModalOpen(false);
      refetch();
    } catch (error) {
      console.error("Failed to update event:", error);
    }
  };

  const handleDeleteThisOnly = async () => {
    if (!event) return;
    try {
      await deleteEvent({ variables: { id: event.id } });
      setDeleteDialogOpen(false);
      router.push("/events");
    } catch (error) {
      console.error("Failed to delete event:", error);
    }
  };

  const handleDeleteSeries = async () => {
    if (!event?.recurringEvent) return;
    try {
      await deleteRecurringEvent({ variables: { id: event.recurringEvent.id } });
      setDeleteDialogOpen(false);
      router.push("/events");
    } catch (error) {
      console.error("Failed to delete recurring event:", error);
    }
  };

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

  // Extract coaches (COACH or ADMIN role) and athletes, filtering out members who joined after the event
  // Also applies include/exclude overrides
  const { coaches, athletes, includedAthleteIds } = useMemo(() => {
    if (!event) return { coaches: [], athletes: [], includedAthleteIds: new Set<string>() };
    const eventDate = parseDate(event.date);
    const coachMap = new Map<string, AthleteUser>();
    const athleteMap = new Map<string, AthleteUser>();
    const excludedIds = new Set((event.excludedAthletes || []).map(u => u.id));

    for (const team of allTeams) {
      for (const member of team.members) {
        // Skip members who joined after this event's date
        if (member.joinedAt) {
          const joinedDate = parseDate(member.joinedAt);
          if (joinedDate > eventDate) continue;
        }
        if (member.role === "COACH" || member.role === "ADMIN") {
          coachMap.set(member.user.id, member.user);
        } else if (!excludedIds.has(member.user.id)) {
          athleteMap.set(member.user.id, member.user);
        }
      }
    }

    // Add individually included athletes (not already in a team)
    const includedAthleteIds = new Set<string>();
    for (const u of (event.includedAthletes || [])) {
      if (!athleteMap.has(u.id) && !coachMap.has(u.id)) {
        athleteMap.set(u.id, u);
        includedAthleteIds.add(u.id);
      }
    }

    return {
      coaches: Array.from(coachMap.values()),
      athletes: Array.from(athleteMap.values()),
      includedAthleteIds,
    };
  }, [allTeams, event]);

  // Build RSVP lookup map by userId
  const rsvpByUser = useMemo(() => {
    if (!event) return new Map<string, EventRsvp>();
    const map = new Map<string, EventRsvp>();
    for (const r of event.rsvps) {
      map.set(r.user.id, r);
    }
    return map;
  }, [event]);

  // RSVP counts
  const rsvpCounts = useMemo(() => {
    if (!event) return { going: 0, maybe: 0, notGoing: 0 };
    return event.rsvps.reduce(
      (acc, r) => {
        if (r.status === "GOING") acc.going++;
        else if (r.status === "MAYBE") acc.maybe++;
        else if (r.status === "NOT_GOING") acc.notGoing++;
        return acc;
      },
      { going: 0, maybe: 0, notGoing: 0 }
    );
  }, [event]);

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6c5ce7]"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-white/55">Event not found</p>
        <Link href="/events" className="text-[#a78bfa] hover:text-[#c4b5fd] mt-2 inline-block">
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
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    dateLabel = `${fmt(eventDate)} - ${fmt(endDate)}`;
  } else {
    dateLabel = eventDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }

  return (
    <div>
      {/* Back Link */}
      <Link
        href="/events"
        className="flex items-center text-white/55 hover:text-white transition-colors mb-4 text-sm w-fit"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Events
      </Link>

      {/* Event Summary */}
      <div className="bg-white/8 backdrop-blur-xl rounded-xl border border-white/15 shadow-2xl p-6 mb-6">
        <div className="flex items-start gap-3 mb-3">
          <span
            className={`px-3 py-1 rounded-lg text-xs font-medium ${
              EVENT_TYPE_COLORS[event.type] || "bg-white/10 text-white/55"
            }`}
          >
            {EVENT_TYPE_LABELS[event.type] || event.type}
          </span>
          {event.recurringEvent && (
            <span className="flex items-center text-xs text-[#a78bfa]">
              <Repeat className="w-3 h-3 mr-1" />
              Recurring
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-white">{event.title}</h1>
          {canEdit && (
            <div className="flex items-center gap-1">
              {!eventHasEnded && (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="p-2 text-white/55 hover:text-[#a78bfa] transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setDeleteDialogOpen(true)}
                className="p-2 text-white/55 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-4 text-sm text-white/55">
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
          {(event.venue || event.location) && (
            <div className="flex items-start gap-1.5">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {event.venue ? (
                  <>
                    {event.venue.name}
                    {(event.venue.address || event.venue.city) && (
                      <span className="text-white/50 text-sm ml-1">
                        — {[event.venue.address, event.venue.city].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </>
                ) : event.location}
              </span>
            </div>
          )}
        </div>

        {/* Teams */}
        {allTeams.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Users className="w-3.5 h-3.5 text-white/40" />
            {allTeams.map((team) => (
              <span
                key={team.id}
                className="px-2 py-0.5 bg-[#6c5ce7]/15 text-[#a78bfa] rounded text-xs"
              >
                {team.name}
              </span>
            ))}
          </div>
        )}

        {event.description && (
          <p className="text-white/40 text-sm mt-3">{event.description}</p>
        )}
      </div>

      {/* Coaches Section */}
      {coaches.length > 0 && (
        <div className="bg-white/8 backdrop-blur-xl rounded-xl border border-white/15 shadow-2xl p-6 mb-6">
          <h2 className="text-sm font-medium text-white/55 uppercase tracking-wider mb-3">
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

      {/* RSVP Summary Card */}
      {event.rsvps.length > 0 && (
        <div className="bg-white/8 rounded-xl p-4 border border-white/8 mb-6">
          <h2 className="text-sm font-medium text-white/55 uppercase tracking-wider mb-3">
            Expected Headcount
          </h2>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-bold text-lg">✓</span>
              <span className="text-white text-sm">Going: <span className="font-bold">{rsvpCounts.going}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 font-bold text-lg">?</span>
              <span className="text-white text-sm">Maybe: <span className="font-bold">{rsvpCounts.maybe}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-400 font-bold text-lg">✗</span>
              <span className="text-white text-sm">Not Going: <span className="font-bold">{rsvpCounts.notGoing}</span></span>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Table */}
      <div className="bg-white/8 backdrop-blur-xl rounded-xl border border-white/15 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-medium">
            Attendance{" "}
            <span className="text-white/55 font-normal">
              ({checkedInCount}/{athletes.length})
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => setShowAddAthleteModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6c5ce7]/20 text-[#a78bfa] rounded-lg hover:bg-[#6c5ce7]/30 transition-colors text-sm"
              >
                <UserPlus className="w-4 h-4" />
                Add Athlete
              </button>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search athletes..."
                className="pl-9 pr-4 py-1.5 bg-white/15 border border-white/25 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#6c5ce7] w-56"
              />
            </div>
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-13 gap-2 px-3 py-2 text-xs font-medium text-white/40 uppercase tracking-wider border-b border-white/8" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1">RSVP</div>
          <div className="col-span-2">Check In</div>
          <div className="col-span-2">Check Out</div>
          <div className="col-span-1">Hours</div>
          <div className="col-span-1">Note</div>
          <div className="col-span-1"></div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/8/50">
          {filteredRows.map((row) => {
            const rsvp = rsvpByUser.get(row.user.id);
            const isIncludedAthlete = includedAthleteIds.has(row.user.id);
            return (
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
                className={`grid gap-2 px-3 py-3 items-center text-sm ${
                  canEdit ? "cursor-pointer hover:bg-white/5 transition-colors" : ""
                }`}
                style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}
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
                    <div className="w-7 h-7 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-xs font-medium">
                      {row.user.firstName[0]}
                      {row.user.lastName[0]}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-white truncate">
                      {row.user.firstName} {row.user.lastName}
                    </span>
                    {isIncludedAthlete && (
                      <span className="text-[#a78bfa] text-xs">Guest</span>
                    )}
                  </div>
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
                    <span className="text-white/40 text-xs">Not Checked In</span>
                  )}
                </div>

                {/* RSVP */}
                <div className="col-span-1">
                  {rsvp ? (
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        rsvp.status === "GOING"
                          ? "bg-green-600/20 text-green-400"
                          : rsvp.status === "MAYBE"
                          ? "bg-yellow-600/20 text-yellow-400"
                          : "bg-red-600/20 text-red-400"
                      }`}
                    >
                      {rsvp.status === "GOING" ? "Going" : rsvp.status === "MAYBE" ? "Maybe" : "Not Going"}
                    </span>
                  ) : (
                    <span className="text-white/40 text-xs">—</span>
                  )}
                </div>

                {/* Check In Time */}
                <div className="col-span-2 text-white/55">
                  {row.checkIn?.checkInTime
                    ? new Date(isNaN(Number(row.checkIn.checkInTime)) ? row.checkIn.checkInTime : Number(row.checkIn.checkInTime)).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "—"}
                </div>

                {/* Check Out Time */}
                <div className="col-span-2 text-white/55">
                  {row.checkIn?.checkOutTime
                    ? new Date(isNaN(Number(row.checkIn.checkOutTime)) ? row.checkIn.checkOutTime : Number(row.checkIn.checkOutTime)).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "—"}
                </div>

                {/* Hours */}
                <div className="col-span-1 text-white/55">
                  {row.checkIn?.hoursLogged != null
                    ? row.checkIn.hoursLogged.toFixed(2)
                    : "—"}
                </div>

                {/* Note */}
                <div className="col-span-1 text-white/40 truncate">
                  {row.checkIn?.note || "—"}
                </div>

                {/* Actions */}
                <div className="col-span-1 flex justify-end">
                  {canEdit && (
                    isIncludedAthlete ? (
                      <button
                        title="Remove from this event"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAthleteFromEvent({ variables: { eventId, userId: row.user.id } })
                            .then(() => refetch());
                        }}
                        className="p-1 text-white/30 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        title="Exclude from this event"
                        onClick={(e) => {
                          e.stopPropagation();
                          excludeAthleteFromEvent({ variables: { eventId, userId: row.user.id } })
                            .then(() => refetch());
                        }}
                        className="p-1 text-white/30 hover:text-orange-400 transition-colors"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}

          {filteredRows.length === 0 && (
            <div className="text-center py-8">
              <p className="text-white/40 text-sm">
                {searchQuery ? "No athletes match your search" : "No athletes found"}
              </p>
            </div>
          )}
        </div>

        {/* Excluded Athletes Section */}
        {(event.excludedAthletes || []).length > 0 && (
          <div className="mt-4 border-t border-white/8 pt-4">
            <button
              onClick={() => setExcludedOpen(!excludedOpen)}
              className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              {excludedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Excluded ({event.excludedAthletes.length})
            </button>
            {excludedOpen && (
              <div className="mt-3 space-y-2">
                {event.excludedAthletes.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/4">
                    <div className="flex items-center gap-2">
                      {u.image ? (
                        <img src={u.image} alt="" className="w-7 h-7 rounded-full object-cover opacity-50" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/40 text-xs font-medium">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                      )}
                      <span className="text-white/40 text-sm">{u.firstName} {u.lastName}</span>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() =>
                          unexcludeAthleteFromEvent({ variables: { eventId, userId: u.id } })
                            .then(() => refetch())
                        }
                        className="text-xs text-[#a78bfa] hover:text-[#c4b5fd] transition-colors px-2 py-1 rounded hover:bg-[#6c5ce7]/15"
                      >
                        Unexclude
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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

      {/* Add Athlete Modal */}
      {showAddAthleteModal && event && selectedOrganizationId && (
        <AddAthleteModal
          eventId={eventId}
          organizationId={selectedOrganizationId}
          existingAthleteIds={new Set(athletes.map(a => a.id))}
          onClose={() => setShowAddAthleteModal(false)}
          onAdd={(userId) =>
            addAthleteToEvent({ variables: { eventId, userId } })
              .then(() => { refetch(); setShowAddAthleteModal(false); })
          }
        />
      )}

      {/* Edit Event Modal */}
      {isEditModalOpen && event && selectedOrganizationId && (
        <EditEventModal
          organizationId={selectedOrganizationId}
          event={event}
          onClose={() => setIsEditModalOpen(false)}
          onUpdate={handleUpdateEvent}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && event && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/8 backdrop-blur-xl rounded-xl w-full max-w-sm p-6 border border-white/15 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">
              {event.recurringEvent ? "Delete Recurring Event" : "Delete Event"}
            </h3>
            <p className="text-white/55 text-sm mb-6">
              {event.recurringEvent
                ? "This event is part of a recurring series. What would you like to do?"
                : `Are you sure you want to delete "${event.title}"? This action cannot be undone.`}
            </p>
            <div className="space-y-3">
              {event.recurringEvent ? (
                <>
                  <button
                    onClick={handleDeleteThisOnly}
                    className="w-full px-4 py-2 bg-white/8 text-white rounded-lg hover:bg-white/12 transition-colors text-sm"
                  >
                    Delete this event only
                  </button>
                  <button
                    onClick={handleDeleteSeries}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    Delete all events in series
                  </button>
                </>
              ) : (
                <button
                  onClick={handleDeleteThisOnly}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  Delete Event
                </button>
              )}
              <button
                onClick={() => setDeleteDialogOpen(false)}
                className="w-full px-4 py-2 text-white/55 hover:text-white transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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
  existingCheckIn?: CheckIn;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState<string>(existingCheckIn?.status || "ON_TIME");
  const [note, setNote] = useState(existingCheckIn?.note || "");
  const [checkInTimeValue, setCheckInTimeValue] = useState(toLocalDatetimeValue(existingCheckIn?.checkInTime));
  const [checkOutTimeValue, setCheckOutTimeValue] = useState(toLocalDatetimeValue(existingCheckIn?.checkOutTime));
  const [saving, setSaving] = useState(false);

  const [adminCheckIn] = useMutation<any>(ADMIN_CHECK_IN);

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
            checkInTime: checkInTimeValue ? new Date(checkInTimeValue).toISOString() : undefined,
            checkOutTime: checkOutTimeValue ? new Date(checkOutTimeValue).toISOString() : undefined,
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
            className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
          />
        </div>

        {/* Check-Out Time */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-white/55 mb-1">Check-Out Time</label>
          <input
            type="datetime-local"
            value={checkOutTimeValue}
            onChange={(e) => setCheckOutTimeValue(e.target.value)}
            className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
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
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-white/55 hover:text-white transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[#6c5ce7] text-white rounded-lg hover:bg-[#5a4dd4] transition-colors text-sm disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// AddAthleteModal
// ============================================

function AddAthleteModal({
  eventId,
  organizationId,
  existingAthleteIds,
  onClose,
  onAdd,
}: {
  eventId: string;
  organizationId: string;
  existingAthleteIds: Set<string>;
  onClose: () => void;
  onAdd: (userId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const { data } = useQuery<any>(GET_ORGANIZATION_USERS, {
    variables: { id: organizationId },
  });

  const orgMembers: { id: string; role: string; user: AthleteUser }[] =
    data?.organization?.members || [];

  const candidates = orgMembers
    .filter(
      (m) =>
        m.role === "ATHLETE" &&
        !existingAthleteIds.has(m.user.id)
    )
    .map((m) => m.user);

  const filtered = candidates.filter((u) => {
    const name = `${u.firstName} ${u.lastName}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white/8 backdrop-blur-xl rounded-xl border border-white/15 shadow-2xl p-6 w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Add Athlete to Event</h2>
          <button onClick={onClose} className="text-white/55 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search athletes..."
            autoFocus
            className="w-full pl-9 pr-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#6c5ce7]"
          />
        </div>

        <div className="overflow-y-auto flex-1 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-6">
              {search ? "No athletes match your search" : "All org athletes are already in this event"}
            </p>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => onAdd(u.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/8 transition-colors text-left"
              >
                {u.image ? (
                  <img src={u.image} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-xs font-medium">
                    {u.firstName[0]}{u.lastName[0]}
                  </div>
                )}
                <span className="text-white text-sm">
                  {u.firstName} {u.lastName}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// EditEventModal
// ============================================

type EditEventFormData = {
  title: string;
  type: "PRACTICE" | "EVENT" | "MEETING";
  date: string;
  endDate: string;
  isMultiDay: boolean;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  venueId: string;
};

function formatDateForInput(dateStr: string): string {
  const num = Number(dateStr);
  const d = isNaN(num) ? new Date(dateStr) : new Date(num);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function EditEventModal({
  organizationId,
  event,
  onClose,
  onUpdate,
}: {
  organizationId: string;
  event: EventDetail;
  onClose: () => void;
  onUpdate: (data: EditEventFormData) => void;
}) {
  const isMultiDay = !!event.endDate;
  const { data: venuesData } = useQuery<any>(GET_ORGANIZATION_VENUES, {
    variables: { organizationId },
  });
  const venues: { id: string; name: string; city?: string }[] = venuesData?.organizationVenues || [];

  const [formData, setFormData] = useState<EditEventFormData>({
    title: event.title,
    type: event.type as "PRACTICE" | "EVENT" | "MEETING",
    date: formatDateForInput(event.date),
    endDate: event.endDate ? formatDateForInput(event.endDate) : "",
    isMultiDay,
    startTime: isMultiDay ? "" : event.startTime,
    endTime: isMultiDay ? "" : event.endTime,
    location: event.location || "",
    description: event.description || "",
    venueId: event.venue?.id || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(formData);
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/8 backdrop-blur-xl rounded-xl w-full max-w-lg p-6 border border-white/15 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Edit Event</h2>
          <button onClick={onClose} className="text-white/55 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/55 mb-1">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
              placeholder="e.g., Spring Tournament"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/55 mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as "PRACTICE" | "EVENT" | "MEETING" })}
              className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
            >
              <option value="PRACTICE">Practice</option>
              <option value="EVENT">Tournament</option>
              <option value="MEETING">Meeting</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/55 mb-1">
              {formData.isMultiDay ? "Start Date" : "Date"}
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
            />
          </div>

          {/* Multi-day Toggle */}
          <div className="flex items-center justify-between py-2">
            <label className="text-sm font-medium text-white/55 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Multi-day Event
            </label>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, isMultiDay: !formData.isMultiDay })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.isMultiDay ? "bg-[#6c5ce7]" : "bg-white/12"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.isMultiDay ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {formData.isMultiDay ? (
            <div>
              <label className="block text-sm font-medium text-white/55 mb-1">End Date</label>
              <input
                type="date"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/55 mb-1">Start Time</label>
                <input
                  type="text"
                  required
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
                  placeholder="6:00 PM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/55 mb-1">End Time</label>
                <input
                  type="text"
                  required
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
                  placeholder="8:00 PM"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/55 mb-1">Location (free text)</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
              placeholder="e.g., Main Gym"
            />
          </div>

          {venues.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-white/55 mb-1">Venue</label>
              <select
                value={formData.venueId}
                onChange={(e) => setFormData({ ...formData, venueId: e.target.value })}
                className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
              >
                <option value="">No venue selected</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.city ? ` — ${v.city}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Teams (read-only) */}
          {event.participatingTeams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-white/55 mb-1">Teams</label>
              <div className="flex flex-wrap gap-2">
                {event.participatingTeams.map((team) => (
                  <span
                    key={team.id}
                    className="px-2.5 py-1 bg-[#a855f7]/15 text-[#a78bfa] rounded-lg text-sm"
                  >
                    {team.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/55 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] resize-none"
              placeholder="Event details..."
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-white/55 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-[#6c5ce7] text-white rounded-lg hover:bg-[#5a4dd4] transition-colors">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
