"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useLazyQuery } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import {
  GET_TEAM,
  GET_ORGANIZATION_USERS,
  GET_ORGANIZATION_VENUES,
  CREATE_EVENT,
  DELETE_EVENT,
  CREATE_RECURRING_EVENT,
  DELETE_RECURRING_EVENT,
  UPDATE_TEAM_MEMBER_ROLE,
  ADD_TEAM_MEMBER,
  REMOVE_TEAM_MEMBER,
  EXCLUDE_ATHLETE_FROM_RECURRING_EVENT,
  UNEXCLUDE_ATHLETE_FROM_RECURRING_EVENT,
  ADD_ATHLETE_TO_RECURRING_EVENT,
  REMOVE_ATHLETE_FROM_RECURRING_EVENT,
} from "@/lib/graphql";
import {
  Plus,
  Calendar,
  CalendarDays,
  MapPin,
  Clock,
  Trash2,
  X,
  Users,
  Repeat,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Shield,
  UserMinus,
  Search,
  Check,
} from "lucide-react";
import Link from "next/link";

type Event = {
  id: string;
  title: string;
  type: "PRACTICE" | "EVENT" | "MEETING" | "REST";
  date: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
  checkIns: { id: string; status: string }[];
  recurringEvent?: {
    id: string;
  } | null;
};

type Member = {
  id: string;
  role: string;
  hoursRequired: number;
  hoursLogged: number;
  attendancePercent: number;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    image?: string;
  };
};

type AthleteUser = { id: string; firstName: string; lastName: string; image?: string };

type DaySchedule = {
  active: boolean;
  recurringEventId?: string;
  startTime: string;
  endTime: string;
  venueId: string;
  coaches: AthleteUser[];
  athletes: AthleteUser[];
};

type RecurringEventData = {
  id: string;
  frequency: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
  venue?: { id: string; name: string; city?: string } | null;
  includedAthletes: AthleteUser[];
  excludedAthletes: AthleteUser[];
};

const EVENT_TYPE_COLORS = {
  PRACTICE: "bg-[#a855f7]/15 text-[#a78bfa]",
  EVENT: "bg-red-600/20 text-red-400",
  MEETING: "bg-yellow-600/20 text-yellow-400",
  REST: "bg-white/10 text-white/55",
};

export default function TeamDetail() {
  const params = useParams();
  const teamId = params.id as string;
  const { canEdit, isOwner, isAdmin, isManager } = useAuth();
  const canManageRoles = isOwner || isAdmin || isManager;
  const [activeTab, setActiveTab] = useState<"events" | "members" | "coaches" | "schedule">("events");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedTime, setSelectedTime] = useState<"upcoming" | "past">("upcoming");
  const [deleteDialogEvent, setDeleteDialogEvent] = useState<Event | null>(null);
  const [eventsPage, setEventsPage] = useState(1);
  const EVENTS_PER_PAGE = 10;

  // Assign modal state
  const [showAssignCoach, setShowAssignCoach] = useState(false);
  const [showAddAthlete, setShowAddAthlete] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [coachSearch, setCoachSearch] = useState("");
  const [athleteSearch, setAthleteSearch] = useState("");

  const { data, loading, refetch } = useQuery<any>(GET_TEAM, {
    variables: { id: teamId },
    skip: !teamId,
  });

  const [deleteEvent] = useMutation<any>(DELETE_EVENT);
  const [deleteRecurringEvent] = useMutation<any>(DELETE_RECURRING_EVENT);
  const [updateTeamMemberRole] = useMutation<any>(UPDATE_TEAM_MEMBER_ROLE);
  const [addTeamMember, { loading: assigning }] = useMutation<any>(ADD_TEAM_MEMBER);
  const [removeTeamMember] = useMutation<any>(REMOVE_TEAM_MEMBER);
  const [fetchOrgUsers, { data: orgUsersData, loading: orgUsersLoading }] = useLazyQuery<any>(GET_ORGANIZATION_USERS);

  const team = data?.team;
  const events: Event[] = team?.events || [];
  const allMembers: Member[] = team?.members || [];
  const coaches = allMembers.filter((m) => m.role === "COACH");
  const members = allMembers.filter((m) => m.role !== "COACH");

  const filteredEvents = events.filter(
    (event) => selectedType === "all" || event.type === selectedType
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parseDate = (dateStr: string) => {
    const num = Number(dateStr);
    return isNaN(num) ? new Date(dateStr) : new Date(num);
  };

  const upcoming = filteredEvents
    .filter((e) => parseDate(e.date) >= today)
    .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());

  const past = filteredEvents
    .filter((e) => parseDate(e.date) < today)
    .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());

  const displayedEvents = selectedTime === "upcoming" ? upcoming : past;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(displayedEvents.length / EVENTS_PER_PAGE));
  const safeEventsPage = Math.min(eventsPage, totalPages);
  const pageStart = (safeEventsPage - 1) * EVENTS_PER_PAGE;
  const pageEvents = displayedEvents.slice(pageStart, pageStart + EVENTS_PER_PAGE);

  const handleDeleteClick = (event: Event) => {
    if (event.recurringEvent) {
      setDeleteDialogEvent(event);
    } else {
      handleDeleteSingleEvent(event.id);
    }
  };

  const handleDeleteSingleEvent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      await deleteEvent({ variables: { id } });
      refetch();
    } catch (error) {
      console.error("Failed to delete event:", error);
    }
  };

  const handleDeleteSeries = async (recurringEventId: string) => {
    try {
      await deleteRecurringEvent({ variables: { id: recurringEventId } });
      setDeleteDialogEvent(null);
      refetch();
    } catch (error) {
      console.error("Failed to delete recurring event:", error);
    }
  };

  const handleDeleteThisOnly = async (eventId: string) => {
    try {
      await deleteEvent({ variables: { id: eventId } });
      setDeleteDialogEvent(null);
      refetch();
    } catch (error) {
      console.error("Failed to delete event:", error);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      await updateTeamMemberRole({
        variables: { userId, teamId, role: newRole },
      });
      refetch();
    } catch (error) {
      console.error("Failed to update role:", error);
    }
  };

  const openAssignCoach = () => {
    setShowAssignCoach(true);
    setAssignError("");
    setCoachSearch("");
    if (team?.organization?.id) {
      fetchOrgUsers({ variables: { id: team.organization.id } });
    }
  };

  const handleAssignCoach = async (userId: string) => {
    setAssignError("");
    try {
      const existingMember = allMembers.find((m) => m.user.id === userId);
      if (existingMember) {
        await updateTeamMemberRole({
          variables: { userId, teamId, role: "COACH" },
        });
      } else {
        await addTeamMember({
          variables: { input: { userId, teamId, role: "COACH" } },
        });
      }
      setShowAssignCoach(false);
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to assign coach";
      setAssignError(message);
    }
  };

  const handleRemoveCoach = async (userId: string) => {
    try {
      await removeTeamMember({ variables: { userId, teamId } });
      refetch();
    } catch (error) {
      console.error("Failed to remove coach:", error);
    }
  };

  const openAddAthlete = () => {
    setShowAddAthlete(true);
    setAssignError("");
    setAthleteSearch("");
    if (team?.organization?.id) {
      fetchOrgUsers({ variables: { id: team.organization.id } });
    }
  };

  const handleAddAthlete = async (userId: string) => {
    setAssignError("");
    try {
      const existingMember = allMembers.find((m) => m.user.id === userId);
      if (existingMember) {
        await updateTeamMemberRole({
          variables: { userId, teamId, role: "MEMBER" },
        });
      } else {
        await addTeamMember({
          variables: { input: { userId, teamId, role: "MEMBER" } },
        });
      }
      setShowAddAthlete(false);
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add athlete";
      setAssignError(message);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await removeTeamMember({ variables: { userId, teamId } });
      refetch();
    } catch (error) {
      console.error("Failed to remove member:", error);
    }
  };

  // Org members for the assign coach modal (exclude those already COACH on this team)
  const orgMembers: { id: string; role: string; user: { id: string; email: string; firstName: string; lastName: string } }[] =
    orgUsersData?.organization?.members || [];
  const coachCandidates = orgMembers.filter((m) => {
    const teamMember = allMembers.find((tm) => tm.user.id === m.user.id);
    return !teamMember || teamMember.role !== "COACH";
  });

  const athleteCandidates = orgMembers.filter((m) => {
    const teamMember = allMembers.find((tm) => tm.user.id === m.user.id);
    return !teamMember || teamMember.role === "COACH";
  });

  const TEAM_ROLE_OPTIONS = ["MEMBER", "CAPTAIN"];

  const teamRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN": return "bg-yellow-600/20 text-yellow-400";
      case "COACH": return "bg-green-600/20 text-green-400";
      case "CAPTAIN": return "bg-blue-600/20 text-blue-400";
      case "MEMBER": return "bg-white/10 text-white/55";
      default: return "bg-white/10 text-white/55";
    }
  };

  if (loading || !team) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6c5ce7]"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/teams"
            className="flex items-center text-white/55 hover:text-white transition-colors mb-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Teams
          </Link>
          <h1 className="text-2xl font-bold text-white">{team.name}</h1>
          <div className="flex items-center space-x-4 mt-1 text-white/55 text-sm">
            <span className="flex items-center">
              <Users className="w-4 h-4 mr-1" />
              {team.memberCount} members
            </span>
            <span
              className={`font-medium ${
                team.attendancePercent >= 90
                  ? "text-green-500"
                  : team.attendancePercent >= 75
                  ? "text-yellow-500"
                  : "text-red-500"
              }`}
            >
              {Math.round(team.attendancePercent || 0)}% attendance
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canManageRoles && activeTab === "members" && (
            <button
              onClick={openAddAthlete}
              className="flex items-center px-4 py-2 bg-[#6c5ce7] text-white rounded-lg hover:bg-[#5a4dd4] transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Athlete
            </button>
          )}
          {canManageRoles && activeTab === "coaches" && (
            <button
              onClick={openAssignCoach}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Shield className="w-5 h-5 mr-2" />
              Assign Coach
            </button>
          )}
          {canEdit && activeTab === "events" && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center px-4 py-2 bg-[#6c5ce7] text-white rounded-lg hover:bg-[#5a4dd4] transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Event
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 mb-6 border-b border-white/8">
        {([
          { key: "events" as const, label: "Events", icon: <Calendar className="w-4 h-4 mr-2" /> },
          { key: "members" as const, label: `Athletes (${members.length})`, icon: <Users className="w-4 h-4 mr-2" /> },
          { key: "coaches" as const, label: `Coaches (${coaches.length})`, icon: <Shield className="w-4 h-4 mr-2" /> },
          ...(canEdit ? [{ key: "schedule" as const, label: "Schedule", icon: <CalendarDays className="w-4 h-4 mr-2" /> }] : []),
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-[#6c5ce7] text-white"
                : "border-transparent text-white/55 hover:text-white"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Events Tab */}
      {activeTab === "events" && (
        <div>
          {/* Filters */}
          <div className="flex items-center justify-between mb-4">
            {/* Type Filters */}
            <div className="flex items-center space-x-2">
              {["all", "PRACTICE", "EVENT", "MEETING", "REST"].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setSelectedType(type);
                    setEventsPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedType === type
                      ? "bg-[#6c5ce7] text-white"
                      : "bg-white/8 text-white/55 hover:text-white"
                  }`}
                >
                  {type === "all" ? "All" : type.charAt(0) + type.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Time Filter */}
            <div className="flex items-center bg-white/8 rounded-lg p-0.5">
              {(["upcoming", "past"] as const).map((time) => (
                <button
                  key={time}
                  onClick={() => {
                    setSelectedTime(time);
                    setEventsPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    selectedTime === time
                      ? "bg-white/8 text-white"
                      : "text-white/55 hover:text-white"
                  }`}
                >
                  {time === "upcoming" ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
                </button>
              ))}
            </div>
          </div>

          {/* Event List */}
          <div className="space-y-2">
            {pageEvents.map((event) => (
              <Link key={event.id} href={`/events/${event.id}`}>
                <EventCard
                  event={event}
                  canEdit={canEdit}
                  onDelete={handleDeleteClick}
                  dimmed={selectedTime === "past"}
                />
              </Link>
            ))}

            {displayedEvents.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-white/30 mx-auto mb-4" />
                <p className="text-white/55">
                  {selectedTime === "upcoming" ? "No upcoming events" : "No past events"}
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/8">
              <p className="text-sm text-white/55">
                Showing {pageStart + 1}-{Math.min(pageStart + EVENTS_PER_PAGE, displayedEvents.length)} of {displayedEvents.length}
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
                  disabled={safeEventsPage <= 1}
                  className="p-2 rounded-lg bg-white/8 text-white/55 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setEventsPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === safeEventsPage
                        ? "bg-[#6c5ce7] text-white"
                        : "bg-white/8 text-white/55 hover:text-white"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setEventsPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeEventsPage >= totalPages}
                  className="p-2 rounded-lg bg-white/8 text-white/55 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === "members" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="bg-white/8 rounded-xl border border-white/8 p-4 flex items-center space-x-3"
            >
              <div className="w-10 h-10 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                {member.user.firstName[0]}
                {member.user.lastName[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white font-medium truncate">
                  {member.user.firstName} {member.user.lastName}
                </p>
                {canManageRoles ? (
                  <select
                    value={member.role}
                    onChange={(e) => handleChangeRole(member.user.id, e.target.value)}
                    className="mt-0.5 bg-transparent border-none text-xs font-medium cursor-pointer focus:outline-none focus:ring-0 p-0 pr-4"
                    style={{ color: member.role === "COACH" ? "#4ade80" : member.role === "ADMIN" ? "#facc15" : member.role === "CAPTAIN" ? "#60a5fa" : "#9ca3af" }}
                  >
                    {TEAM_ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role} className="bg-white/8 text-white">
                        {role.charAt(0) + role.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${teamRoleBadgeColor(member.role)}`}>
                    {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                  </span>
                )}
              </div>
              <div className="ml-auto flex items-center gap-3 flex-shrink-0">
                <p
                  className={`text-sm font-medium ${
                    member.attendancePercent >= 90
                      ? "text-green-500"
                      : member.attendancePercent >= 75
                      ? "text-yellow-500"
                      : "text-red-500"
                  }`}
                >
                  {Math.round(member.attendancePercent || 0)}%
                </p>
                {canManageRoles && (
                  <button
                    onClick={() => handleRemoveMember(member.user.id)}
                    className="p-1.5 text-white/40 hover:text-red-400 transition-colors"
                    title="Remove member"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Users className="w-12 h-12 text-white/30 mx-auto mb-4" />
              <p className="text-white/55 mb-1">No athletes yet</p>
              {canManageRoles && (
                <p className="text-white/40 text-sm">
                  Click &quot;Add Athlete&quot; to add an athlete to this team.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Coaches Tab */}
      {activeTab === "coaches" && (
        <div className="space-y-3">
          {coaches.map((coach) => (
            <div
              key={coach.id}
              className="bg-white/8 rounded-xl border border-white/8 p-4 flex items-center space-x-4"
            >
              <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                {coach.user.firstName[0]}
                {coach.user.lastName[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white font-medium">
                  {coach.user.firstName} {coach.user.lastName}
                </p>
                <p className="text-white/55 text-sm">{coach.user.email}</p>
              </div>
              {canManageRoles && (
                <button
                  onClick={() => handleRemoveCoach(coach.user.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium rounded-lg transition-colors"
                >
                  <UserMinus className="w-4 h-4" />
                  Remove
                </button>
              )}
            </div>
          ))}
          {coaches.length === 0 && (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-white/30 mx-auto mb-4" />
              <p className="text-white/55 mb-1">No coaches assigned</p>
              {canManageRoles && (
                <p className="text-white/40 text-sm">
                  Click &quot;Assign Coach&quot; to add a coach to this team.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === "schedule" && (
        <ScheduleTab
          team={team}
          organizationId={team.organization.id}
          canEdit={canEdit}
          refetch={refetch}
        />
      )}

      {/* Create Event Modal */}
      {isCreateModalOpen && (
        <CreateEventModal
          teamId={teamId}
          organizationId={team.organization.id}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            refetch();
          }}
        />
      )}

      {/* Assign Coach Modal */}
      {showAssignCoach && (() => {
        const q = coachSearch.toLowerCase();
        const filtered = q
          ? coachCandidates.filter((m) =>
              `${m.user.firstName} ${m.user.lastName}`.toLowerCase().includes(q) ||
              m.user.email.toLowerCase().includes(q)
            )
          : coachCandidates;
        return (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-white/8 backdrop-blur-xl rounded-xl border border-white/15 p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Assign Coach</h2>
                <button onClick={() => setShowAssignCoach(false)} className="text-white/55 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" />
                <input
                  type="text"
                  value={coachSearch}
                  onChange={(e) => setCoachSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-white/15 border border-white/25 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
                />
              </div>

              {orgUsersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-[#6c5ce7] animate-spin" />
                </div>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto mb-4">
                  {filtered.map((m) => {
                    const isOnTeam = allMembers.some((tm) => tm.user.id === m.user.id);
                    return (
                      <button
                        key={m.user.id}
                        onClick={() => handleAssignCoach(m.user.id)}
                        disabled={assigning}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-white/8 bg-white/5 hover:bg-white/10 text-left transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                            {m.user.firstName[0]}{m.user.lastName[0]}
                          </div>
                          <div>
                            <p className="text-sm text-white font-medium">
                              {m.user.firstName} {m.user.lastName}
                            </p>
                            <p className="text-xs text-white/55">{m.user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isOnTeam && (
                            <span className="text-xs text-white/40">on team</span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/55">
                            {m.role}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {filtered.length === 0 && coachCandidates.length > 0 && (
                    <p className="text-white/40 text-sm text-center py-4">
                      No members match &quot;{coachSearch}&quot;
                    </p>
                  )}
                  {coachCandidates.length === 0 && (
                    <p className="text-white/40 text-sm text-center py-4">
                      All organization members are already coaches on this team.
                    </p>
                  )}
                </div>
              )}

              {assignError && (
                <div className="mb-4 px-3 py-2 bg-red-600/20 border border-red-600/30 rounded-lg text-red-400 text-sm">
                  {assignError}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setShowAssignCoach(false)}
                  className="px-4 py-2 bg-white/8 hover:bg-white/12 text-white/75 text-sm font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add Athlete Modal */}
      {showAddAthlete && (() => {
        const q = athleteSearch.toLowerCase();
        const filtered = q
          ? athleteCandidates.filter((m) =>
              `${m.user.firstName} ${m.user.lastName}`.toLowerCase().includes(q) ||
              m.user.email.toLowerCase().includes(q)
            )
          : athleteCandidates;
        return (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-white/8 backdrop-blur-xl rounded-xl border border-white/15 p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Add Athlete</h2>
                <button onClick={() => setShowAddAthlete(false)} className="text-white/55 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" />
                <input
                  type="text"
                  value={athleteSearch}
                  onChange={(e) => setAthleteSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-white/15 border border-white/25 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
                />
              </div>

              {orgUsersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-[#6c5ce7] animate-spin" />
                </div>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto mb-4">
                  {filtered.map((m) => {
                    const isCoachOnTeam = allMembers.some((tm) => tm.user.id === m.user.id && tm.role === "COACH");
                    return (
                      <button
                        key={m.user.id}
                        onClick={() => handleAddAthlete(m.user.id)}
                        disabled={assigning}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-white/8 bg-white/5 hover:bg-white/10 text-left transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                            {m.user.firstName[0]}{m.user.lastName[0]}
                          </div>
                          <div>
                            <p className="text-sm text-white font-medium">
                              {m.user.firstName} {m.user.lastName}
                            </p>
                            <p className="text-xs text-white/55">{m.user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCoachOnTeam && (
                            <span className="text-xs text-white/40">coach</span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/55">
                            {m.role}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {filtered.length === 0 && athleteCandidates.length > 0 && (
                    <p className="text-white/40 text-sm text-center py-4">
                      No members match &quot;{athleteSearch}&quot;
                    </p>
                  )}
                  {athleteCandidates.length === 0 && (
                    <p className="text-white/40 text-sm text-center py-4">
                      All organization members are already athletes on this team.
                    </p>
                  )}
                </div>
              )}

              {assignError && (
                <div className="mb-4 px-3 py-2 bg-red-600/20 border border-red-600/30 rounded-lg text-red-400 text-sm">
                  {assignError}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setShowAddAthlete(false)}
                  className="px-4 py-2 bg-white/8 hover:bg-white/12 text-white/75 text-sm font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Recurring Event Dialog */}
      {deleteDialogEvent && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/8 backdrop-blur-xl rounded-xl w-full max-w-sm p-6 border border-white/15 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Delete Recurring Event</h3>
            <p className="text-white/55 text-sm mb-6">
              This event is part of a recurring series. What would you like to do?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleDeleteThisOnly(deleteDialogEvent.id)}
                className="w-full px-4 py-2 bg-white/8 text-white rounded-lg hover:bg-white/12 transition-colors text-sm"
              >
                Delete this event only
              </button>
              <button
                onClick={() => handleDeleteSeries(deleteDialogEvent.recurringEvent!.id)}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Delete all events in series
              </button>
              <button
                onClick={() => setDeleteDialogEvent(null)}
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

function EventCard({
  event,
  canEdit,
  onDelete,
  dimmed,
}: {
  event: Event;
  canEdit: boolean;
  onDelete: (event: Event) => void;
  dimmed: boolean;
}) {
  const num = Number(event.date);
  const eventDate = isNaN(num) ? new Date(event.date) : new Date(num);

  const isMultiDay = !!event.endDate;
  let dateLabel: string;
  if (isMultiDay) {
    const endNum = Number(event.endDate);
    const endDate = isNaN(endNum) ? new Date(event.endDate!) : new Date(endNum);
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
    <div
      className={`bg-white/8 rounded-xl border border-white/8 p-4 hover:border-white/10 transition-colors cursor-pointer ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <div
            className={`w-20 text-center px-3 py-1 rounded-lg text-xs font-medium ${
              EVENT_TYPE_COLORS[event.type]
            }`}
          >
            {event.type}
          </div>
          <div>
            <div className="flex items-center">
              <h3 className="text-white font-medium">{event.title}</h3>
              {event.recurringEvent && (
                <span className="ml-2 flex items-center text-xs text-[#a78bfa]">
                  <Repeat className="w-3 h-3 mr-1" />
                  Recurring
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4 mt-2 text-sm text-white/55">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {dateLabel}
              </div>
              {!isMultiDay && (
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {event.startTime} - {event.endTime}
                </div>
              )}
              {event.location && (
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  {event.location}
                </div>
              )}
            </div>
            {event.description && (
              <p className="text-white/40 text-sm mt-2">{event.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-white font-medium">{event.checkIns.length}</p>
            <p className="text-white/55 text-xs">checked in</p>
          </div>
          {canEdit && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(event);
              }}
              className="p-2 text-white/55 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Schedule Tab
// ============================================

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function computeSeasonDates(team: any): { start: string; end: string } {
  if (team.orgSeason && team.seasonYear) {
    const { startMonth, endMonth } = team.orgSeason;
    const startYear = endMonth < startMonth ? team.seasonYear - 1 : team.seasonYear;
    const endYear = endMonth < startMonth ? team.seasonYear : team.seasonYear;
    return {
      start: `${startYear}-${String(startMonth).padStart(2, "0")}-01`,
      end: `${endYear}-${String(endMonth).padStart(2, "0")}-28`,
    };
  }
  const now = new Date();
  return {
    start: now.toISOString().slice(0, 10),
    end: `${now.getUTCFullYear()}-12-31`,
  };
}

function initScheduleFromRecurringEvents(
  recurringEvents: RecurringEventData[],
  allMembers: { id: string; role: string; user: AthleteUser }[]
): DaySchedule[] {
  const schedule: DaySchedule[] = Array.from({ length: 7 }, () => ({
    active: false,
    recurringEventId: undefined,
    startTime: "6:00 PM",
    endTime: "8:00 PM",
    venueId: "",
    coaches: [],
    athletes: [],
  }));

  const teamCoachIds = new Set(allMembers.filter(m => m.role === "COACH").map(m => m.user.id));
  const teamAthleteIds = new Set(
    allMembers.filter(m => m.role === "MEMBER" || m.role === "CAPTAIN").map(m => m.user.id)
  );

  const weeklyEvents = recurringEvents.filter(
    re => re.frequency === "WEEKLY" && re.daysOfWeek.length === 1
  );

  for (const re of weeklyEvents) {
    const dayIndex = re.daysOfWeek[0];
    if (dayIndex < 0 || dayIndex > 6) continue;

    const excludedIds = new Set(re.excludedAthletes.map(u => u.id));

    const coaches = allMembers
      .filter(m => m.role === "COACH" && !excludedIds.has(m.user.id))
      .map(m => m.user);
    const athletes = allMembers
      .filter(m => (m.role === "MEMBER" || m.role === "CAPTAIN") && !excludedIds.has(m.user.id))
      .map(m => m.user);

    // Add included extras
    for (const u of re.includedAthletes) {
      if (!teamCoachIds.has(u.id) && !teamAthleteIds.has(u.id)) {
        athletes.push(u);
      }
    }

    schedule[dayIndex] = {
      active: true,
      recurringEventId: re.id,
      startTime: re.startTime,
      endTime: re.endTime,
      venueId: re.venue?.id || "",
      coaches,
      athletes,
    };
  }

  return schedule;
}

function ScheduleTab({
  team,
  organizationId,
  canEdit,
  refetch,
}: {
  team: any;
  organizationId: string;
  canEdit: boolean;
  refetch: () => void;
}) {
  const seasonDates = computeSeasonDates(team);
  const allMembers: { id: string; role: string; user: AthleteUser }[] = team.members || [];

  const [schedule, setSchedule] = useState<DaySchedule[]>(() =>
    initScheduleFromRecurringEvents(team.recurringEvents || [], allMembers)
  );
  const [startDate, setStartDate] = useState(seasonDates.start);
  const [endDate, setEndDate] = useState(seasonDates.end);
  const [applying, setApplying] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [searchModal, setSearchModal] = useState<{ day: number; role: "coach" | "athlete" } | null>(null);

  const [createRecurringEvent] = useMutation<any>(CREATE_RECURRING_EVENT);
  const [deleteRecurringEvent] = useMutation<any>(DELETE_RECURRING_EVENT);

  const existingWeeklyEvents: RecurringEventData[] = (team.recurringEvents || []).filter(
    (re: RecurringEventData) => re.frequency === "WEEKLY" && re.daysOfWeek.length === 1
  );

  const toggleDay = (dayIndex: number) => {
    setSchedule(prev => {
      const next = [...prev];
      next[dayIndex] = { ...next[dayIndex], active: !next[dayIndex].active };
      return next;
    });
  };

  const handleApplySchedule = async () => {
    if (existingWeeklyEvents.length > 0) {
      setConfirmReplace(true);
      return;
    }
    await doApply();
  };

  const doApply = async () => {
    setApplying(true);
    setConfirmReplace(false);
    try {
      // Delete existing weekly recurring events
      for (const re of existingWeeklyEvents) {
        await deleteRecurringEvent({ variables: { id: re.id } });
      }

      const allTeamIds = new Set(allMembers.map(m => m.user.id));

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const day = schedule[dayIndex];
        if (!day.active) continue;

        const participantIds = new Set([
          ...day.coaches.map(u => u.id),
          ...day.athletes.map(u => u.id),
        ]);

        // excludedUserIds = team members NOT in participants
        const excludedUserIds = allMembers
          .map(m => m.user.id)
          .filter(id => !participantIds.has(id));

        // includedUserIds = participants NOT on the team
        const includedUserIds = [
          ...day.coaches.map(u => u.id),
          ...day.athletes.map(u => u.id),
        ].filter(id => !allTeamIds.has(id));

        await createRecurringEvent({
          variables: {
            input: {
              title: `${team.name} Practice`,
              type: "PRACTICE",
              startTime: day.startTime,
              endTime: day.endTime,
              frequency: "WEEKLY",
              daysOfWeek: [dayIndex],
              startDate,
              endDate,
              organizationId,
              teamId: team.id,
              venueId: day.venueId || undefined,
              includedUserIds: includedUserIds.length > 0 ? includedUserIds : undefined,
              excludedUserIds: excludedUserIds.length > 0 ? excludedUserIds : undefined,
            },
          },
        });
      }

      refetch();
    } catch (err) {
      console.error("Failed to apply schedule:", err);
    } finally {
      setApplying(false);
    }
  };

  const { data: venuesData } = useQuery<any>(GET_ORGANIZATION_VENUES, {
    variables: { organizationId },
  });
  const venues: { id: string; name: string; city?: string }[] = venuesData?.organizationVenues || [];

  const teamCoaches = allMembers.filter(m => m.role === "COACH").map(m => m.user);
  const teamAthletes = allMembers
    .filter(m => m.role === "MEMBER" || m.role === "CAPTAIN")
    .map(m => m.user);

  return (
    <div>
      {/* Season date range + Apply button */}
      <div className="flex items-end gap-4 mb-6 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-white/55 mb-1">Season Start</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/55 mb-1">Season End</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
          />
        </div>
        <button
          onClick={handleApplySchedule}
          disabled={applying || !canEdit}
          className="flex items-center gap-2 px-4 py-2 bg-[#6c5ce7] text-white rounded-lg hover:bg-[#5a4dd4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {applying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Apply Schedule
        </button>
      </div>

      {/* Kanban board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: "max-content" }}>
          {schedule.map((day, dayIndex) => (
            <DayColumn
              key={dayIndex}
              dayIndex={dayIndex}
              day={day}
              canEdit={canEdit}
              venues={venues}
              onToggle={() => toggleDay(dayIndex)}
              onTimeChange={(field, value) =>
                setSchedule(prev => {
                  const next = [...prev];
                  next[dayIndex] = { ...next[dayIndex], [field]: value };
                  return next;
                })
              }
              onVenueChange={venueId =>
                setSchedule(prev => {
                  const next = [...prev];
                  next[dayIndex] = { ...next[dayIndex], venueId };
                  return next;
                })
              }
              onAddAllCoaches={() =>
                setSchedule(prev => {
                  const next = [...prev];
                  const existing = new Set(next[dayIndex].coaches.map(u => u.id));
                  const merged = [
                    ...next[dayIndex].coaches,
                    ...teamCoaches.filter(u => !existing.has(u.id)),
                  ];
                  next[dayIndex] = { ...next[dayIndex], coaches: merged };
                  return next;
                })
              }
              onAddAllAthletes={() =>
                setSchedule(prev => {
                  const next = [...prev];
                  const existing = new Set(next[dayIndex].athletes.map(u => u.id));
                  const merged = [
                    ...next[dayIndex].athletes,
                    ...teamAthletes.filter(u => !existing.has(u.id)),
                  ];
                  next[dayIndex] = { ...next[dayIndex], athletes: merged };
                  return next;
                })
              }
              onRemoveCoach={userId =>
                setSchedule(prev => {
                  const next = [...prev];
                  next[dayIndex] = {
                    ...next[dayIndex],
                    coaches: next[dayIndex].coaches.filter(u => u.id !== userId),
                  };
                  return next;
                })
              }
              onRemoveAthlete={userId =>
                setSchedule(prev => {
                  const next = [...prev];
                  next[dayIndex] = {
                    ...next[dayIndex],
                    athletes: next[dayIndex].athletes.filter(u => u.id !== userId),
                  };
                  return next;
                })
              }
              onOpenSearch={role => setSearchModal({ day: dayIndex, role })}
            />
          ))}
        </div>
      </div>

      {/* Search modal */}
      {searchModal !== null && (
        <ScheduleSearchModal
          organizationId={organizationId}
          day={searchModal.day}
          role={searchModal.role}
          existingIds={new Set([
            ...(searchModal.role === "coach"
              ? schedule[searchModal.day].coaches.map(u => u.id)
              : schedule[searchModal.day].athletes.map(u => u.id)),
          ])}
          onAdd={user => {
            setSchedule(prev => {
              const next = [...prev];
              const field = searchModal.role === "coach" ? "coaches" : "athletes";
              if (!next[searchModal.day][field].find(u => u.id === user.id)) {
                next[searchModal.day] = {
                  ...next[searchModal.day],
                  [field]: [...next[searchModal.day][field], user],
                };
              }
              return next;
            });
          }}
          onClose={() => setSearchModal(null)}
        />
      )}

      {/* Confirm replace dialog */}
      {confirmReplace && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/8 backdrop-blur-xl rounded-xl w-full max-w-sm p-6 border border-white/15 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Replace Existing Schedule?</h3>
            <p className="text-white/55 text-sm mb-6">
              This will delete all {existingWeeklyEvents.length} existing weekly practice series and create new ones from the current schedule.
            </p>
            <div className="space-y-3">
              <button
                onClick={doApply}
                className="w-full px-4 py-2 bg-[#6c5ce7] text-white rounded-lg hover:bg-[#5a4dd4] transition-colors text-sm font-medium"
              >
                Replace Schedule
              </button>
              <button
                onClick={() => setConfirmReplace(false)}
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

function DayColumn({
  dayIndex,
  day,
  canEdit,
  venues,
  onToggle,
  onTimeChange,
  onVenueChange,
  onAddAllCoaches,
  onAddAllAthletes,
  onRemoveCoach,
  onRemoveAthlete,
  onOpenSearch,
}: {
  dayIndex: number;
  day: DaySchedule;
  canEdit: boolean;
  venues: { id: string; name: string; city?: string }[];
  onToggle: () => void;
  onTimeChange: (field: "startTime" | "endTime", value: string) => void;
  onVenueChange: (venueId: string) => void;
  onAddAllCoaches: () => void;
  onAddAllAthletes: () => void;
  onRemoveCoach: (userId: string) => void;
  onRemoveAthlete: (userId: string) => void;
  onOpenSearch: (role: "coach" | "athlete") => void;
}) {
  return (
    <div
      className={`w-48 rounded-xl border flex-shrink-0 overflow-hidden transition-all ${
        day.active
          ? "border-[#6c5ce7]/50 bg-[#6c5ce7]/8"
          : "border-white/8 bg-white/4 opacity-60"
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 py-2.5 ${
          day.active ? "bg-[#6c5ce7]/20" : "bg-white/5"
        }`}
      >
        <span className="text-sm font-semibold text-white">{DAY_NAMES_FULL[dayIndex]}</span>
        {canEdit && (
          <button
            onClick={onToggle}
            className={`w-8 h-5 rounded-full transition-colors relative flex-shrink-0 ${
              day.active ? "bg-[#6c5ce7]" : "bg-white/20"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                day.active ? "translate-x-3" : "translate-x-0.5"
              }`}
            />
          </button>
        )}
      </div>

      {day.active && (
        <div className="p-3 space-y-3">
          {/* Times */}
          <div className="space-y-1.5">
            <input
              type="text"
              value={day.startTime}
              onChange={e => onTimeChange("startTime", e.target.value)}
              disabled={!canEdit}
              placeholder="Start time"
              className="w-full px-2 py-1.5 bg-white/8 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#6c5ce7] disabled:opacity-50"
            />
            <input
              type="text"
              value={day.endTime}
              onChange={e => onTimeChange("endTime", e.target.value)}
              disabled={!canEdit}
              placeholder="End time"
              className="w-full px-2 py-1.5 bg-white/8 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#6c5ce7] disabled:opacity-50"
            />
          </div>

          {/* Venue */}
          <select
            value={day.venueId}
            onChange={e => onVenueChange(e.target.value)}
            disabled={!canEdit}
            className="w-full px-2 py-1.5 bg-white/8 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#6c5ce7] disabled:opacity-50"
          >
            <option value="">No venue</option>
            {venues.map(v => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          {/* Coaches section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-white/55 uppercase tracking-wide">Coaches</span>
              {canEdit && (
                <div className="flex gap-1">
                  <button
                    onClick={onAddAllCoaches}
                    className="text-xs text-[#a78bfa] hover:text-white transition-colors px-1"
                    title="Add all team coaches"
                  >
                    +All
                  </button>
                  <button
                    onClick={() => onOpenSearch("coach")}
                    className="text-xs text-[#a78bfa] hover:text-white transition-colors px-1"
                  >
                    +Add
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-1">
              {day.coaches.map(u => (
                <div key={u.id} className="flex items-center justify-between gap-1">
                  <span className="text-xs text-white/80 truncate">
                    {u.firstName} {u.lastName}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => onRemoveCoach(u.id)}
                      className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {day.coaches.length === 0 && (
                <p className="text-xs text-white/30 italic">No coaches</p>
              )}
            </div>
          </div>

          {/* Athletes section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-white/55 uppercase tracking-wide">Athletes</span>
              {canEdit && (
                <div className="flex gap-1">
                  <button
                    onClick={onAddAllAthletes}
                    className="text-xs text-[#a78bfa] hover:text-white transition-colors px-1"
                    title="Add all team athletes"
                  >
                    +All
                  </button>
                  <button
                    onClick={() => onOpenSearch("athlete")}
                    className="text-xs text-[#a78bfa] hover:text-white transition-colors px-1"
                  >
                    +Add
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {day.athletes.map(u => (
                <div key={u.id} className="flex items-center justify-between gap-1">
                  <span className="text-xs text-white/80 truncate">
                    {u.firstName} {u.lastName}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => onRemoveAthlete(u.id)}
                      className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {day.athletes.length === 0 && (
                <p className="text-xs text-white/30 italic">No athletes</p>
              )}
            </div>
          </div>
        </div>
      )}

      {!day.active && (
        <div className="px-3 py-4 text-center">
          <p className="text-xs text-white/30">Off</p>
        </div>
      )}
    </div>
  );
}

function ScheduleSearchModal({
  organizationId,
  day,
  role,
  existingIds,
  onAdd,
  onClose,
}: {
  organizationId: string;
  day: number;
  role: "coach" | "athlete";
  existingIds: Set<string>;
  onAdd: (user: AthleteUser) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const { data: orgUsersData, loading } = useQuery<any>(GET_ORGANIZATION_USERS, {
    variables: { id: organizationId },
  });

  const orgMembers: { id: string; role: string; user: AthleteUser & { email: string } }[] =
    orgUsersData?.organization?.members || [];

  const coachRoles = new Set(["COACH", "ADMIN", "OWNER"]);
  const candidates = orgMembers.filter(m => {
    if (existingIds.has(m.user.id)) return false;
    if (role === "coach") return coachRoles.has(m.role);
    return m.role === "ATHLETE";
  });

  const q = search.toLowerCase();
  const filtered = q
    ? candidates.filter(m =>
        `${m.user.firstName} ${m.user.lastName}`.toLowerCase().includes(q) ||
        m.user.email.toLowerCase().includes(q)
      )
    : candidates;

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white/8 backdrop-blur-xl rounded-xl border border-white/15 p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Add {role === "coach" ? "Coach" : "Athlete"} — {DAY_NAMES_FULL[day]}
          </h2>
          <button onClick={onClose} className="text-white/55 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            autoFocus
            className="w-full pl-10 pr-4 py-2.5 bg-white/15 border border-white/25 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-[#6c5ce7] animate-spin" />
          </div>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto mb-4">
            {filtered.map(m => (
              <button
                key={m.user.id}
                onClick={() => {
                  onAdd(m.user);
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/8 bg-white/5 hover:bg-white/10 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                  {m.user.firstName[0]}{m.user.lastName[0]}
                </div>
                <div>
                  <p className="text-sm text-white font-medium">
                    {m.user.firstName} {m.user.lastName}
                  </p>
                  <p className="text-xs text-white/55">{m.user.email}</p>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-white/40 text-sm text-center py-4">
                {candidates.length === 0 ? "No eligible members found" : `No results for "${search}"`}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/8 hover:bg-white/12 text-white/75 text-sm font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateEventModal({
  teamId,
  organizationId,
  onClose,
  onSuccess,
}: {
  teamId: string;
  organizationId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    title: "",
    type: "PRACTICE" as const,
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    description: "",
    isRecurring: false,
    frequency: "WEEKLY" as "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY",
    daysOfWeek: [] as number[],
    endDate: "",
  });

  const [createEvent] = useMutation<any>(CREATE_EVENT);
  const [createRecurringEvent] = useMutation<any>(CREATE_RECURRING_EVENT);

  const toggleDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.isRecurring) {
        await createRecurringEvent({
          variables: {
            input: {
              title: formData.title,
              type: formData.type,
              startTime: formData.startTime,
              endTime: formData.endTime,
              location: formData.location || undefined,
              description: formData.description || undefined,
              frequency: formData.frequency,
              daysOfWeek:
                formData.frequency === "DAILY" || formData.frequency === "MONTHLY"
                  ? undefined
                  : formData.daysOfWeek,
              startDate: formData.date,
              endDate: formData.endDate,
              organizationId,
              teamId,
            },
          },
        });
      } else {
        await createEvent({
          variables: {
            input: {
              title: formData.title,
              type: formData.type,
              date: formData.date,
              startTime: formData.startTime,
              endTime: formData.endTime,
              location: formData.location || undefined,
              description: formData.description || undefined,
              organizationId,
              teamId,
            },
          },
        });
      }
      onSuccess();
    } catch (error) {
      console.error("Failed to create event:", error);
    }
  };

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/8 backdrop-blur-xl rounded-xl w-full max-w-lg p-6 border border-white/15 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Create Event</h2>
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
              placeholder="e.g., Team Practice"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/55 mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
            >
              <option value="PRACTICE">Practice</option>
              <option value="EVENT">Event</option>
              <option value="MEETING">Meeting</option>
              <option value="REST">Rest Day</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/55 mb-1">
              {formData.isRecurring ? "Start Date" : "Date"}
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
            />
          </div>

          {/* Recurring Event Toggle */}
          <div className="flex items-center justify-between py-2">
            <label className="text-sm font-medium text-white/55 flex items-center">
              <Repeat className="w-4 h-4 mr-2" />
              Recurring Event
            </label>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, isRecurring: !formData.isRecurring })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.isRecurring ? "bg-[#6c5ce7]" : "bg-white/12"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.isRecurring ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Recurring Event Fields */}
          {formData.isRecurring && (
            <div className="space-y-4 p-4 bg-white/8 border border-white/10 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-white/55 mb-1">Frequency</label>
                <select
                  value={formData.frequency}
                  onChange={(e) =>
                    setFormData({ ...formData, frequency: e.target.value as typeof formData.frequency })
                  }
                  className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="BIWEEKLY">Biweekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>

              {(formData.frequency === "WEEKLY" || formData.frequency === "BIWEEKLY") && (
                <div>
                  <label className="block text-sm font-medium text-white/55 mb-2">Days of Week</label>
                  <div className="flex gap-2">
                    {DAY_LABELS.map((label, index) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleDay(index)}
                        className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${
                          formData.daysOfWeek.includes(index)
                            ? "bg-[#6c5ce7] text-white"
                            : "bg-white/8 text-white/55 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
            </div>
          )}

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

          <div>
            <label className="block text-sm font-medium text-white/55 mb-1">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
              placeholder="e.g., Main Gym"
            />
          </div>

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
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-white/55 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#6c5ce7] text-white rounded-lg hover:bg-[#5a4dd4] transition-colors"
            >
              Create Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
