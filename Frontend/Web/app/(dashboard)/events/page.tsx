"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useApolloClient } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import {
  GET_EVENTS,
  GET_EVENTS_COUNT,
  GET_TEAMS,
  GET_ORGANIZATION_VENUES,
  GET_ORGANIZATION_USERS,
  EXPORT_CALENDAR,
  CREATE_EVENT,
  CREATE_RECURRING_EVENT,
  UPDATE_EVENT,
  DELETE_EVENT,
  DELETE_RECURRING_EVENT,
  CREATE_VENUE,
  ADD_ATHLETE_TO_EVENT,
  REMOVE_ATHLETE_FROM_EVENT,
  EXCLUDE_ATHLETE_FROM_EVENT,
  UNEXCLUDE_ATHLETE_FROM_EVENT,
} from "@/lib/graphql";
import {
  Plus,
  Calendar,
  MapPin,
  Clock,
  Trash2,
  Edit2,
  X,
  Repeat,
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LayoutList,
  ChevronDown,
  Download,
  Building2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

// ============================================
// Types
// ============================================

type Venue = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  notes?: string;
};

type AthleteUser = {
  id: string;
  firstName: string;
  lastName: string;
  image?: string;
};

type TeamMemberBasic = {
  id: string;
  role: string;
  user: AthleteUser;
};

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
  venue?: Venue | null;
  team?: { id: string; name: string };
  participatingTeams: { id: string; name: string }[];
  checkIns: { id: string; status: string }[];
  recurringEvent?: { id: string } | null;
  // included/excluded not fetched in list — only in detail view
  includedAthletes?: AthleteUser[];
  excludedAthletes?: AthleteUser[];
};

type TabKey = "PRACTICE" | "MEETING" | "EVENT";
type TimeFilter = "TODAY" | "WEEK" | "MONTH" | "ALL";

const TAB_CONFIG: { key: TabKey; label: string; defaultFilter: TimeFilter }[] = [
  { key: "PRACTICE", label: "Practices", defaultFilter: "WEEK" },
  { key: "MEETING", label: "Meetings", defaultFilter: "WEEK" },
  { key: "EVENT", label: "Events", defaultFilter: "WEEK" },
];

const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
  { value: "TODAY", label: "Today" },
  { value: "WEEK", label: "This Week" },
  { value: "MONTH", label: "This Month" },
  { value: "ALL", label: "All" },
];

const EVENT_TYPE_COLORS: Record<string, string> = {
  PRACTICE: "bg-green-600/20 text-green-400",
  EVENT: "bg-red-600/20 text-red-400",
  MEETING: "bg-yellow-600/20 text-yellow-400",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  PRACTICE: "Practice",
  EVENT: "Tournament",
  MEETING: "Meeting",
};

function parseDate(dateStr: string) {
  const num = Number(dateStr);
  return isNaN(num) ? new Date(dateStr) : new Date(num);
}

function getDateRange(filter: TimeFilter): { start: Date; end: Date } | null {
  if (filter === "ALL") return null;
  const now = new Date();
  // Use local calendar date but construct UTC boundaries to match how event
  // dates are stored (noon UTC) and displayed (timeZone: "UTC" in EventCard)
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (filter) {
    case "TODAY":
      return {
        start: new Date(Date.UTC(y, m, d)),
        end: new Date(Date.UTC(y, m, d, 23, 59, 59, 999)),
      };
    case "WEEK": {
      const day = now.getDay();
      const weekStart = d - day;
      return {
        start: new Date(Date.UTC(y, m, weekStart)),
        end: new Date(Date.UTC(y, m, weekStart + 6, 23, 59, 59, 999)),
      };
    }
    case "MONTH":
      return {
        start: new Date(Date.UTC(y, m, 1)),
        end: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)),
      };
  }
}

// ============================================
// Main Page
// ============================================

export default function Events() {
  const { selectedOrganizationId, canEdit } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [deleteConfirmEvent, setDeleteConfirmEvent] = useState<Event | null>(null);
  const [deleteDialogEvent, setDeleteDialogEvent] = useState<Event | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>("PRACTICE");
  const defaultFilter = TAB_CONFIG.find((t) => t.key === activeTab)!.defaultFilter;
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(defaultFilter);

  // Team grouping
  const [groupByTeam, setGroupByTeam] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string>("ALL");

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Reset filter to tab default + reset page when switching tabs
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setTimeFilter(TAB_CONFIG.find((t) => t.key === tab)!.defaultFilter);
    setPage(0);
  };

  // Reset page when filter or page size changes
  useEffect(() => {
    setPage(0);
  }, [timeFilter, pageSize, teamFilter, activeTab]);

  // Convert time filter to date range strings for server-side filtering
  const timeFilterDates = useMemo(() => {
    if (timeFilter === "ALL") return { startDate: undefined, endDate: undefined };
    const range = getDateRange(timeFilter);
    if (!range) return { startDate: undefined, endDate: undefined };
    return {
      startDate: range.start.toISOString(),
      endDate: range.end.toISOString(),
    };
  }, [timeFilter]);

  const eventsVariables = useMemo(() => ({
    organizationId: selectedOrganizationId,
    type: activeTab,
    teamId: teamFilter !== "ALL" ? teamFilter : undefined,
    startDate: timeFilterDates.startDate,
    endDate: timeFilterDates.endDate,
    limit: pageSize,
    offset: page * pageSize,
  }), [selectedOrganizationId, activeTab, teamFilter, timeFilterDates, pageSize, page]);

  const { data, loading, refetch } = useQuery<any>(GET_EVENTS, {
    variables: eventsVariables,
    skip: !selectedOrganizationId,
  });

  // Lightweight count query for tab badges (re-fetches when teamFilter changes)
  const { data: countData, refetch: refetchCount } = useQuery<any>(GET_EVENTS_COUNT, {
    variables: {
      organizationId: selectedOrganizationId,
      teamId: teamFilter !== "ALL" ? teamFilter : undefined,
    },
    skip: !selectedOrganizationId,
  });

  const { data: teamsData } = useQuery<any>(GET_TEAMS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const { data: venuesData, refetch: refetchVenues } = useQuery<any>(GET_ORGANIZATION_VENUES, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const apolloClient = useApolloClient();

  const handleExportCalendar = async () => {
    if (!selectedOrganizationId) return;
    setIsExporting(true);
    try {
      const { data: calData } = await apolloClient.query<{ exportCalendar: string }>({
        query: EXPORT_CALENDAR,
        variables: { organizationId: selectedOrganizationId },
        fetchPolicy: "network-only",
      });
      const icalContent = calData?.exportCalendar;
      if (!icalContent) return;
      const blob = new Blob([icalContent], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "athletiq-events.ics";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export calendar:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const [updateEvent] = useMutation<any>(UPDATE_EVENT);
  const [deleteEvent] = useMutation<any>(DELETE_EVENT);
  const [deleteRecurringEvent] = useMutation<any>(DELETE_RECURRING_EVENT);

  // Server returns exactly the current page, already filtered and sorted
  const paginatedEvents: Event[] = data?.events || [];
  const allTeams: { id: string; name: string; members?: TeamMemberBasic[] }[] = teamsData?.teams || [];
  const eventCounts = countData?.eventsCount ?? { PRACTICE: 0, MEETING: 0, EVENT: 0 };

  // Total count for current tab (used for pagination math)
  const totalCount = eventCounts[activeTab] ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Split current page into upcoming / past for display
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  const upcoming = paginatedEvents
    .filter((e) => parseDate(e.date) >= today)
    .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());

  const past = paginatedEvents
    .filter((e) => parseDate(e.date) < today)
    .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());

  // Grouped events by team (when groupByTeam is enabled) — operates on current page
  const groupedEvents = useMemo(() => {
    if (!groupByTeam) return null;

    const groups = new Map<string, { teamName: string; events: Event[] }>();

    for (const event of paginatedEvents) {
      // An event belongs to its primary team, or each of its participating teams
      const teamEntries: { id: string; name: string }[] = [];
      if (event.team) {
        teamEntries.push(event.team);
      }
      if (event.participatingTeams?.length > 0) {
        for (const t of event.participatingTeams) {
          if (!teamEntries.some((te) => te.id === t.id)) {
            teamEntries.push(t);
          }
        }
      }

      if (teamEntries.length === 0) {
        // Organization-wide event (no team)
        const key = "__org_wide__";
        if (!groups.has(key)) groups.set(key, { teamName: "Organization-wide", events: [] });
        groups.get(key)!.events.push(event);
      } else {
        for (const team of teamEntries) {
          if (!groups.has(team.id)) groups.set(team.id, { teamName: team.name, events: [] });
          groups.get(team.id)!.events.push(event);
        }
      }
    }

    // Sort groups alphabetically, with org-wide last
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "__org_wide__") return 1;
      if (b[0] === "__org_wide__") return -1;
      return a[1].teamName.localeCompare(b[1].teamName);
    });
  }, [groupByTeam, paginatedEvents]);

  // Edit handler
  const handleEditClick = (event: Event) => {
    setEditingEvent(event);
  };

  const handleUpdateEvent = async (data: {
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
    if (!editingEvent) return;
    try {
      await updateEvent({
        variables: {
          id: editingEvent.id,
          title: data.title,
          type: data.type,
          date: data.date,
          endDate: data.isMultiDay ? data.endDate : null,
          startTime: data.isMultiDay ? "All Day" : data.startTime,
          endTime: data.isMultiDay ? "All Day" : data.endTime,
          location: data.location || null,
          description: data.description || null,
          venueId: data.venueId || null,
        },
      });
      setEditingEvent(null);
      refetch();
      refetchCount();
    } catch (error) {
      console.error("Failed to update event:", error);
    }
  };

  // Delete handlers
  const handleDeleteClick = (event: Event) => {
    setDeleteError(null);
    if (event.recurringEvent) {
      setDeleteDialogEvent(event);
    } else {
      setDeleteConfirmEvent(event);
    }
  };

  const handleConfirmDeleteSingle = async () => {
    if (!deleteConfirmEvent) return;
    try {
      await deleteEvent({ variables: { id: deleteConfirmEvent.id } });
      setDeleteConfirmEvent(null);
      refetch();
      refetchCount();
    } catch (error: any) {
      setDeleteError(error?.message || "Failed to delete event");
    }
  };

  const handleDeleteSeries = async (recurringEventId: string) => {
    try {
      await deleteRecurringEvent({ variables: { id: recurringEventId } });
      setDeleteDialogEvent(null);
      refetch();
      refetchCount();
    } catch (error: any) {
      setDeleteError(error?.message || "Failed to delete series");
    }
  };

  const handleDeleteThisOnly = async (eventId: string) => {
    try {
      await deleteEvent({ variables: { id: eventId } });
      setDeleteDialogEvent(null);
      refetch();
      refetchCount();
    } catch (error: any) {
      setDeleteError(error?.message || "Failed to delete event");
    }
  };

  if (loading) {
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
          <h1 className="text-2xl font-bold text-white">Events</h1>
          <p className="text-white/55 mt-1">Manage practices, meetings, and tournaments</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCalendar}
            disabled={isExporting}
            className="flex items-center px-3 py-2 bg-white/8 text-white/70 rounded-lg hover:bg-white/12 hover:text-white transition-colors text-sm disabled:opacity-50"
            title="Download .ics calendar file"
          >
            <Download className="w-4 h-4 mr-1.5" />
            {isExporting ? "Exporting..." : "Export .ics"}
          </button>
          {canEdit && (
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
      <div className="flex gap-1 mb-4">
        {TAB_CONFIG.map(({ key, label }) => {
          const count = eventCounts[key] ?? 0;
          return (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === key
                  ? "bg-[#6c5ce7] text-white"
                  : "bg-white/8 text-white/55 hover:text-white"
              }`}
            >
              {label}
              <span
                className={`text-xs rounded-full px-1.5 py-0.5 ${
                  activeTab === key ? "bg-[#6c5ce7]/50 text-white" : "bg-white/8 text-white/40"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Time Range Filters + Team Filter + Group Toggle */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {TIME_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTimeFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              timeFilter === value
                ? "bg-white/12 text-white"
                : "bg-white/8 text-white/40 border border-white/8 hover:text-white/75"
            }`}
          >
            {label}
          </button>
        ))}

        <div className="h-4 w-px bg-white/8 mx-1" />

        {/* Team Filter */}
        <div className="relative">
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="appearance-none pl-3 pr-7 py-1.5 bg-white/8 border border-white/8 rounded-lg text-xs font-medium text-white/55 hover:text-white/75 focus:outline-none focus:ring-1 focus:ring-[#6c5ce7] cursor-pointer"
          >
            <option value="ALL">All Teams</option>
            {allTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40 pointer-events-none" />
        </div>

        {/* Group by Team Toggle */}
        <button
          onClick={() => setGroupByTeam((g) => !g)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            groupByTeam
              ? "bg-[#a855f7]/15 text-[#a78bfa] border border-[#6c5ce7]/30"
              : "bg-white/8 text-white/40 border border-white/8 hover:text-white/75"
          }`}
        >
          <LayoutList className="w-3.5 h-3.5" />
          Group by Team
        </button>

        <span className="text-white/30 text-xs ml-2">
          {totalCount} {totalCount === 1 ? "event" : "events"}
        </span>
      </div>

      {/* Event List */}
      {groupByTeam && groupedEvents ? (
        <div className="space-y-6">
          {groupedEvents.map(([teamId, group]) => {
            const groupUpcoming = group.events
              .filter((e) => parseDate(e.date) >= today)
              .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
            const groupPast = group.events
              .filter((e) => parseDate(e.date) < today)
              .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());

            return (
              <div key={teamId}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#a78bfa]" />
                    <h2 className="text-sm font-semibold text-white">{group.teamName}</h2>
                  </div>
                  <span className="text-xs text-white/40">
                    {group.events.length} {group.events.length === 1 ? "event" : "events"}
                  </span>
                  <div className="h-px flex-1 bg-white/8" />
                </div>
                <div className="space-y-2">
                  {groupUpcoming.map((event) => (
                    <Link key={event.id} href={`/events/${event.id}`}>
                      <EventCard event={event} canEdit={canEdit} onEdit={handleEditClick} onDelete={handleDeleteClick} dimmed={false} />
                    </Link>
                  ))}

                  {groupPast.length > 0 && groupUpcoming.length > 0 && (
                    <div className="flex items-center gap-3 py-2">
                      <div className="h-px flex-1 bg-white/8" />
                      <span className="text-xs text-white/40 uppercase tracking-wider">Past</span>
                      <div className="h-px flex-1 bg-white/8" />
                    </div>
                  )}

                  {groupPast.map((event) => (
                    <Link key={event.id} href={`/events/${event.id}`}>
                      <EventCard event={event} canEdit={canEdit} onEdit={handleEditClick} onDelete={handleDeleteClick} dimmed />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}

          {groupedEvents.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-white/30 mx-auto mb-4" />
              <p className="text-white/55">No {EVENT_TYPE_LABELS[activeTab]?.toLowerCase() || "event"}s found</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {upcoming.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <EventCard event={event} canEdit={canEdit} onEdit={handleEditClick} onDelete={handleDeleteClick} dimmed={false} />
            </Link>
          ))}

          {past.length > 0 && upcoming.length > 0 && (
            <div className="flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-white/8" />
              <span className="text-xs text-white/40 uppercase tracking-wider">Past</span>
              <div className="h-px flex-1 bg-white/8" />
            </div>
          )}

          {past.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <EventCard event={event} canEdit={canEdit} onEdit={handleEditClick} onDelete={handleDeleteClick} dimmed />
            </Link>
          ))}

          {paginatedEvents.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-white/30 mx-auto mb-4" />
              <p className="text-white/55">No {EVENT_TYPE_LABELS[activeTab]?.toLowerCase() || "event"}s found</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="mt-4 bg-white/8 rounded-xl border border-white/8 px-6 py-3 flex items-center justify-between">
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
              &middot; {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} of{" "}
              {totalCount}
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

      {/* Create Event Modal */}
      {isCreateModalOpen && (
        <EventModal
          organizationId={selectedOrganizationId!}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            refetch();
            refetchCount();
          }}
        />
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <EventModal
          organizationId={selectedOrganizationId!}
          editingEvent={editingEvent}
          parentTeams={allTeams}
          onClose={() => setEditingEvent(null)}
          onUpdate={handleUpdateEvent}
        />
      )}

      {/* Delete Single Event Modal */}
      {deleteConfirmEvent && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/8 backdrop-blur-xl rounded-xl w-full max-w-sm p-6 border border-white/15 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-600/15 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-white">Delete Event</h3>
            </div>
            <p className="text-white/55 text-sm mb-1">
              Are you sure you want to delete{" "}
              <span className="text-white font-medium">"{deleteConfirmEvent.title}"</span>?
            </p>
            <p className="text-white/40 text-xs mb-6">
              All check-in records for this event will also be removed.
            </p>
            {deleteError && (
              <p className="text-red-400 text-xs mb-4 bg-red-600/10 rounded-lg px-3 py-2">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setDeleteConfirmEvent(null); setDeleteError(null); }}
                className="flex-1 px-4 py-2 bg-white/8 text-white rounded-lg hover:bg-white/12 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingle}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Delete Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Recurring Event Modal */}
      {deleteDialogEvent && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/8 backdrop-blur-xl rounded-xl w-full max-w-sm p-6 border border-white/15 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-600/15 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-white">Delete Recurring Event</h3>
            </div>
            <p className="text-white/55 text-sm mb-6">
              <span className="text-white font-medium">"{deleteDialogEvent.title}"</span> is part of
              a recurring series. What would you like to delete?
            </p>
            {deleteError && (
              <p className="text-red-400 text-xs mb-4 bg-red-600/10 rounded-lg px-3 py-2">{deleteError}</p>
            )}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleDeleteThisOnly(deleteDialogEvent.id)}
                className="w-full px-4 py-2 bg-white/8 text-white rounded-lg hover:bg-white/12 transition-colors text-sm text-left"
              >
                <span className="font-medium">This event only</span>
                <span className="block text-white/40 text-xs mt-0.5">Remove just this occurrence</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSeries(deleteDialogEvent.recurringEvent!.id)}
                className="w-full px-4 py-2 bg-red-600/15 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/25 transition-colors text-sm text-left"
              >
                <span className="font-medium">All events in series</span>
                <span className="block text-white/40 text-xs mt-0.5">Remove every occurrence in this series</span>
              </button>
              <button
                type="button"
                onClick={() => { setDeleteDialogEvent(null); setDeleteError(null); }}
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
// EventCard
// ============================================

function EventCard({
  event,
  canEdit,
  onEdit,
  onDelete,
  dimmed,
}: {
  event: Event;
  canEdit: boolean;
  onEdit: (event: Event) => void;
  onDelete: (event: Event) => void;
  dimmed: boolean;
}) {
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
    <div
      className={`bg-white/8 rounded-xl border border-white/8 p-4 hover:border-white/10 transition-colors cursor-pointer ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <div
            className={`px-3 py-1 rounded-lg text-xs font-medium ${
              EVENT_TYPE_COLORS[event.type] || "bg-white/10 text-white/55"
            }`}
          >
            {EVENT_TYPE_LABELS[event.type] || event.type}
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
              {(event.venue || event.location) && (
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  {event.venue
                    ? `${event.venue.name}${event.venue.city ? `, ${event.venue.city}` : ""}`
                    : event.location}
                </div>
              )}
            </div>
            {event.team && (
              <div className="flex items-center gap-2 mt-2">
                <Users className="w-3.5 h-3.5 text-white/40" />
                <span className="px-2 py-0.5 bg-[#6c5ce7]/15 text-[#a78bfa] rounded text-xs">
                  {event.team.name}
                </span>
              </div>
            )}
            {event.participatingTeams?.length > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Users className="w-3.5 h-3.5 text-white/40" />
                {event.participatingTeams.map((team) => (
                  <span key={team.id} className="px-2 py-0.5 bg-[#6c5ce7]/15 text-[#a78bfa] rounded text-xs">
                    {team.name}
                  </span>
                ))}
              </div>
            )}
            {event.description && <p className="text-white/40 text-sm mt-2">{event.description}</p>}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-white font-medium">{event.checkIns.length}</p>
            <p className="text-white/55 text-xs">checked in</p>
          </div>
          {canEdit && (
            <div className="flex items-center">
              {!dimmed && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(event);
                  }}
                  className="p-2 text-white/55 hover:text-[#a78bfa] transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// EventModal (Create & Edit)
// ============================================

type EventFormData = {
  title: string;
  type: "PRACTICE" | "EVENT" | "MEETING";
  date: string;
  endDate: string;
  isMultiDay: boolean;
  isRecurring: boolean;
  frequency: "WEEKLY" | "BIWEEKLY" | "DAILY";
  daysOfWeek: number[];
  recurringEndDate: string;
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

function EventModal({
  organizationId,
  editingEvent,
  parentTeams,
  onClose,
  onSuccess,
  onUpdate,
}: {
  organizationId: string;
  editingEvent?: Event;
  parentTeams?: { id: string; name: string; members?: TeamMemberBasic[] }[];
  onClose: () => void;
  onSuccess?: () => void;
  onUpdate?: (data: EventFormData) => void;
}) {
  const isEdit = !!editingEvent;

  const [formData, setFormData] = useState<EventFormData>(() => {
    if (editingEvent) {
      const isMultiDay = !!editingEvent.endDate;
      return {
        title: editingEvent.title,
        type: editingEvent.type as "PRACTICE" | "EVENT" | "MEETING",
        date: formatDateForInput(editingEvent.date),
        endDate: editingEvent.endDate ? formatDateForInput(editingEvent.endDate) : "",
        isMultiDay,
        isRecurring: false,
        frequency: "WEEKLY",
        daysOfWeek: [],
        recurringEndDate: "",
        startTime: isMultiDay ? "" : editingEvent.startTime,
        endTime: isMultiDay ? "" : editingEvent.endTime,
        location: editingEvent.location || "",
        description: editingEvent.description || "",
        venueId: editingEvent.venue?.id || "",
      };
    }
    return {
      title: "",
      type: "EVENT",
      date: "",
      endDate: "",
      isMultiDay: false,
      isRecurring: false,
      frequency: "WEEKLY",
      daysOfWeek: [],
      recurringEndDate: "",
      startTime: "",
      endTime: "",
      location: "",
      description: "",
      venueId: "",
    };
  });

  const { data: venuesData } = useQuery<any>(GET_ORGANIZATION_VENUES, {
    variables: { organizationId },
  });
  const { data: orgUsersData, refetch: refetchOrgUsers } = useQuery<any>(GET_ORGANIZATION_USERS, {
    variables: { id: organizationId },
    skip: !isEdit,
  });
  const [createVenue] = useMutation<any>(CREATE_VENUE);
  const [addAthlete] = useMutation<any>(ADD_ATHLETE_TO_EVENT);
  const [removeAthlete] = useMutation<any>(REMOVE_ATHLETE_FROM_EVENT);
  const [excludeAthlete] = useMutation<any>(EXCLUDE_ATHLETE_FROM_EVENT);
  const [unexcludeAthlete] = useMutation<any>(UNEXCLUDE_ATHLETE_FROM_EVENT);
  const [showNewVenueForm, setShowNewVenueForm] = useState(false);
  const [newVenueName, setNewVenueName] = useState("");
  const [newVenueCity, setNewVenueCity] = useState("");
  const [newVenueAddress, setNewVenueAddress] = useState("");
  const [creatingVenue, setCreatingVenue] = useState(false);
  const [overridesOpen, setOverridesOpen] = useState(false);
  const [showAddIncludeModal, setShowAddIncludeModal] = useState(false);
  const [showAddExcludeModal, setShowAddExcludeModal] = useState(false);
  const [includeSearch, setIncludeSearch] = useState("");
  const [excludeSearch, setExcludeSearch] = useState("");
  const [localIncluded, setLocalIncluded] = useState<AthleteUser[]>(editingEvent?.includedAthletes || []);
  const [localExcluded, setLocalExcluded] = useState<AthleteUser[]>(editingEvent?.excludedAthletes || []);

  const venues: Venue[] = venuesData?.organizationVenues || [];

  const handleCreateVenue = async () => {
    if (!newVenueName.trim()) return;
    setCreatingVenue(true);
    try {
      const { data } = await createVenue({
        variables: {
          input: {
            name: newVenueName.trim(),
            address: newVenueAddress.trim() || undefined,
            city: newVenueCity.trim() || undefined,
            organizationId,
          },
        },
        refetchQueries: [{ query: GET_ORGANIZATION_VENUES, variables: { organizationId } }],
      });
      if (data?.createVenue) {
        setFormData({ ...formData, venueId: data.createVenue.id });
        setShowNewVenueForm(false);
        setNewVenueName("");
        setNewVenueCity("");
        setNewVenueAddress("");
      }
    } catch (err) {
      console.error("Failed to create venue:", err);
    } finally {
      setCreatingVenue(false);
    }
  };
  const [selectedTeams, setSelectedTeams] = useState<{ id: string; name: string }[]>(
    () => editingEvent?.participatingTeams || []
  );
  const [teamSearch, setTeamSearch] = useState("");
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: teamsData } = useQuery<any>(GET_TEAMS, {
    variables: { organizationId },
  });
  const [createEvent] = useMutation<any>(CREATE_EVENT);
  const [createRecurringEvent] = useMutation<any>(CREATE_RECURRING_EVENT);

  const modalTeams: { id: string; name: string }[] = teamsData?.teams || [];

  // Compute sets for include/exclude pickers (only relevant in edit mode)
  const allOrgAthletes: AthleteUser[] = (orgUsersData?.organization?.members || [])
    .filter((m: any) => m.role === "ATHLETE")
    .map((m: any) => m.user);

  // Resolve team members from parentTeams (passed from parent, which has full member lists)
  const editingTeamIds = [
    editingEvent?.team?.id,
    ...(editingEvent?.participatingTeams?.map(t => t.id) || []),
  ].filter(Boolean);
  const teamAthletes: AthleteUser[] = (parentTeams || [])
    .filter(t => editingTeamIds.includes(t.id) && t.members)
    .flatMap(t => (t.members || [])
      .filter((m: TeamMemberBasic) => m.role === "MEMBER" || m.role === "CAPTAIN")
      .map((m: TeamMemberBasic) => m.user)
    )
    .filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i);

  const currentAthleteIds = new Set([
    ...localIncluded.map(u => u.id),
    ...teamAthletes.map(u => u.id),
  ]);
  const currentExcludedIds = new Set(localExcluded.map(u => u.id));
  // Candidates for "Add (include)": org athletes not already in event and not excluded
  const includeCandidates = allOrgAthletes.filter(u => !currentAthleteIds.has(u.id) && !currentExcludedIds.has(u.id));
  // Candidates for "Exclude": current team members not already excluded
  const excludeCandidates = teamAthletes.filter(u => !currentExcludedIds.has(u.id));

  const filteredTeams = modalTeams.filter(
    (team) =>
      !selectedTeams.some((s) => s.id === team.id) &&
      team.name.toLowerCase().includes(teamSearch.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowTeamDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addTeam = (team: { id: string; name: string }) => {
    setSelectedTeams((prev) => [...prev, team]);
    setTeamSearch("");
    setShowTeamDropdown(false);
  };

  const removeTeam = (teamId: string) => {
    setSelectedTeams((prev) => prev.filter((t) => t.id !== teamId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit && onUpdate) {
      onUpdate(formData);
      return;
    }
    try {
      if (formData.isRecurring) {
        await createRecurringEvent({
          variables: {
            input: {
              title: formData.title,
              type: formData.type,
              startTime: formData.startTime,
              endTime: formData.endTime,
              frequency: formData.frequency,
              daysOfWeek: formData.daysOfWeek,
              startDate: formData.date,
              endDate: formData.recurringEndDate,
              location: formData.location || undefined,
              description: formData.description || undefined,
              organizationId,
              teamId: selectedTeams.length === 1 ? selectedTeams[0].id : undefined,
              venueId: formData.venueId || undefined,
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
              ...(formData.isMultiDay
                ? { endDate: formData.endDate, startTime: "All Day", endTime: "All Day" }
                : { startTime: formData.startTime, endTime: formData.endTime }),
              location: formData.location || undefined,
              description: formData.description || undefined,
              organizationId,
              participatingTeamIds: selectedTeams.map((t) => t.id),
              venueId: formData.venueId || undefined,
            },
          },
        });
      }
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create event:", error);
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/8 backdrop-blur-xl rounded-xl w-full max-w-2xl p-6 border border-white/15 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">{isEdit ? "Edit Event" : "Create Event"}</h2>
          <button onClick={onClose} className="text-white/55 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder:text-white/35"
              placeholder="e.g., Spring Tournament"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as "PRACTICE" | "EVENT" | "MEETING" })}
              className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder:text-white/35"
            >
              <option value="PRACTICE">Practice</option>
              <option value="EVENT">Tournament</option>
              <option value="MEETING">Meeting</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">
              {formData.isMultiDay || formData.isRecurring ? "Start Date" : "Date"}
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder:text-white/35"
            />
          </div>

          {/* Multi-day Toggle (hidden when recurring is on) */}
          {!formData.isRecurring && (
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
          )}

          {/* Recurring Event Toggle (create mode only, not multi-day) */}
          {!isEdit && !formData.isMultiDay && (
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
          )}

          {/* Recurring Event Options */}
          {formData.isRecurring && !formData.isMultiDay && (
            <div className="space-y-4 p-4 bg-white/8 rounded-lg border border-white/15">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Frequency</label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as "WEEKLY" | "BIWEEKLY" | "DAILY" })}
                  className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder:text-white/35"
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="BIWEEKLY">Biweekly</option>
                </select>
              </div>

              {formData.frequency !== "DAILY" && (
                <div>
                  <label className="block text-sm font-medium text-white/55 mb-2">Days of Week</label>
                  <div className="flex gap-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const days = formData.daysOfWeek.includes(i)
                            ? formData.daysOfWeek.filter((d) => d !== i)
                            : [...formData.daysOfWeek, i];
                          setFormData({ ...formData, daysOfWeek: days });
                        }}
                        className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${
                          formData.daysOfWeek.includes(i)
                            ? "bg-[#6c5ce7] text-white"
                            : "bg-white/8 text-white/55 hover:text-white"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Repeat Until</label>
                <input
                  type="date"
                  required
                  value={formData.recurringEndDate}
                  onChange={(e) => setFormData({ ...formData, recurringEndDate: e.target.value })}
                  className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder:text-white/35"
                />
              </div>
            </div>
          )}

          {formData.isMultiDay ? (
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">End Date</label>
              <input
                type="date"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder:text-white/35"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Start Time</label>
                <input
                  type="text"
                  required
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder:text-white/35"
                  placeholder="6:00 PM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">End Time</label>
                <input
                  type="text"
                  required
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder:text-white/35"
                  placeholder="8:00 PM"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Location (free text)</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder:text-white/35"
              placeholder="e.g., Main Gym"
            />
          </div>

          {/* Venue selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-white/70">
                <Building2 className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                Venue (structured)
              </label>
              <button
                type="button"
                onClick={() => setShowNewVenueForm((v) => !v)}
                className="text-xs text-[#a78bfa] hover:text-white transition-colors"
              >
                {showNewVenueForm ? "Cancel" : "+ New venue"}
              </button>
            </div>

            {showNewVenueForm ? (
              <div className="space-y-2 p-3 bg-white/8 rounded-lg border border-white/15">
                <input
                  type="text"
                  value={newVenueName}
                  onChange={(e) => setNewVenueName(e.target.value)}
                  placeholder="Venue name *"
                  className="w-full px-3 py-1.5 bg-white/15 border border-white/25 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#6c5ce7] placeholder:text-white/35"
                />
                <input
                  type="text"
                  value={newVenueAddress}
                  onChange={(e) => setNewVenueAddress(e.target.value)}
                  placeholder="Address (optional)"
                  className="w-full px-3 py-1.5 bg-white/15 border border-white/25 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#6c5ce7] placeholder:text-white/35"
                />
                <input
                  type="text"
                  value={newVenueCity}
                  onChange={(e) => setNewVenueCity(e.target.value)}
                  placeholder="City (optional)"
                  className="w-full px-3 py-1.5 bg-white/15 border border-white/25 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#6c5ce7] placeholder:text-white/35"
                />
                <button
                  type="button"
                  onClick={handleCreateVenue}
                  disabled={creatingVenue || !newVenueName.trim()}
                  className="px-3 py-1.5 bg-[#6c5ce7] text-white rounded text-sm hover:bg-[#5a4dd4] transition-colors disabled:opacity-50"
                >
                  {creatingVenue ? "Creating..." : "Create & Select"}
                </button>
              </div>
            ) : (
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
            )}
          </div>

          {/* Teams Picker (create mode only — team changes not supported in edit) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Teams</label>

              {selectedTeams.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedTeams.map((team) => (
                    <span
                      key={team.id}
                      className="flex items-center gap-1 px-2.5 py-1 bg-[#a855f7]/15 text-[#a78bfa] rounded-lg text-sm"
                    >
                      {team.name}
                      <button type="button" onClick={() => removeTeam(team.id)} className="hover:text-white transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" />
                  <input
                    type="text"
                    value={teamSearch}
                    onChange={(e) => {
                      setTeamSearch(e.target.value);
                      setShowTeamDropdown(true);
                    }}
                    onFocus={() => setShowTeamDropdown(true)}
                    className="w-full pl-9 pr-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] text-sm placeholder:text-white/35"
                    placeholder="Search teams..."
                  />
                </div>

                {showTeamDropdown && filteredTeams.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-[#1e1a3a] border border-white/20 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                    {filteredTeams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => addTeam(team)}
                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 transition-colors"
                      >
                        {team.name}
                      </button>
                    ))}
                  </div>
                )}

                {showTeamDropdown && teamSearch && filteredTeams.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-[#1e1a3a] border border-white/20 rounded-lg shadow-xl">
                    <p className="px-4 py-2 text-sm text-white/55">No teams found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Teams display (edit mode — read-only) */}
          {isEdit && editingEvent?.participatingTeams && editingEvent.participatingTeams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Teams</label>
              <div className="flex flex-wrap gap-2">
                {editingEvent.participatingTeams.map((team) => (
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

          {/* Athlete Overrides (edit mode only) */}
          {isEdit && editingEvent && (
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setOverridesOpen(!overridesOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                <span>Athlete Overrides</span>
                {overridesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {overridesOpen && (
                <div className="px-4 pb-4 space-y-4 border-t border-white/10">
                  {/* Include athletes */}
                  <div className="pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-white/55 uppercase tracking-wider">Added (Guests)</span>
                      <button
                        type="button"
                        onClick={() => setShowAddIncludeModal(true)}
                        className="flex items-center gap-1 text-xs text-[#a78bfa] hover:text-[#c4b5fd] transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    </div>
                    {localIncluded.length === 0 ? (
                      <p className="text-white/30 text-xs">No athletes added</p>
                    ) : (
                      <div className="space-y-1.5">
                        {localIncluded.map((u) => (
                          <div key={u.id} className="flex items-center justify-between px-2.5 py-1.5 bg-white/5 rounded-lg">
                            <div className="flex items-center gap-2">
                              {u.image ? (
                                <img src={u.image} alt="" className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-xs">
                                  {u.firstName[0]}{u.lastName[0]}
                                </div>
                              )}
                              <span className="text-white text-sm">{u.firstName} {u.lastName}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                removeAthlete({ variables: { eventId: editingEvent.id, userId: u.id } });
                                setLocalIncluded(prev => prev.filter(x => x.id !== u.id));
                              }}
                              className="text-white/30 hover:text-red-400 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Exclude athletes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-white/55 uppercase tracking-wider">Excluded</span>
                      <button
                        type="button"
                        onClick={() => setShowAddExcludeModal(true)}
                        className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        Exclude
                      </button>
                    </div>
                    {localExcluded.length === 0 ? (
                      <p className="text-white/30 text-xs">No athletes excluded</p>
                    ) : (
                      <div className="space-y-1.5">
                        {localExcluded.map((u) => (
                          <div key={u.id} className="flex items-center justify-between px-2.5 py-1.5 bg-orange-500/5 rounded-lg">
                            <div className="flex items-center gap-2">
                              {u.image ? (
                                <img src={u.image} alt="" className="w-6 h-6 rounded-full object-cover opacity-50" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/40 text-xs">
                                  {u.firstName[0]}{u.lastName[0]}
                                </div>
                              )}
                              <span className="text-white/50 text-sm">{u.firstName} {u.lastName}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                unexcludeAthlete({ variables: { eventId: editingEvent.id, userId: u.id } });
                                setLocalExcluded(prev => prev.filter(x => x.id !== u.id));
                              }}
                              className="text-xs text-[#a78bfa] hover:text-[#c4b5fd] transition-colors"
                            >
                              Unexclude
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] resize-none placeholder:text-white/35"
              placeholder="Event details..."
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-white/55 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-[#6c5ce7] text-white rounded-lg hover:bg-[#5a4dd4] transition-colors">
              {isEdit ? "Save Changes" : "Create Event"}
            </button>
          </div>
        </form>
      </div>

      {/* Add (include) athlete picker */}
      {showAddIncludeModal && editingEvent && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
          <div className="bg-[#1e1a3a] border border-white/15 rounded-xl shadow-2xl p-5 w-full max-w-sm max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium text-sm">Add Guest Athlete</h3>
              <button onClick={() => setShowAddIncludeModal(false)} className="text-white/55 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" />
              <input
                autoFocus
                type="text"
                value={includeSearch}
                onChange={(e) => setIncludeSearch(e.target.value)}
                placeholder="Search athletes..."
                className="w-full pl-9 pr-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#6c5ce7]"
              />
            </div>
            <div className="overflow-y-auto flex-1 space-y-1">
              {includeCandidates.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(includeSearch.toLowerCase())).length === 0 ? (
                <p className="text-white/40 text-sm text-center py-4">No athletes available</p>
              ) : (
                includeCandidates
                  .filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(includeSearch.toLowerCase()))
                  .map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        addAthlete({ variables: { eventId: editingEvent.id, userId: u.id } });
                        setLocalIncluded(prev => [...prev, u]);
                        setLocalExcluded(prev => prev.filter(x => x.id !== u.id));
                        setShowAddIncludeModal(false);
                        setIncludeSearch("");
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/8 transition-colors text-left"
                    >
                      {u.image ? (
                        <img src={u.image} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-xs">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                      )}
                      <span className="text-white text-sm">{u.firstName} {u.lastName}</span>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Exclude athlete picker */}
      {showAddExcludeModal && editingEvent && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
          <div className="bg-[#1e1a3a] border border-white/15 rounded-xl shadow-2xl p-5 w-full max-w-sm max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium text-sm">Exclude Athlete</h3>
              <button onClick={() => setShowAddExcludeModal(false)} className="text-white/55 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" />
              <input
                autoFocus
                type="text"
                value={excludeSearch}
                onChange={(e) => setExcludeSearch(e.target.value)}
                placeholder="Search team members..."
                className="w-full pl-9 pr-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#6c5ce7]"
              />
            </div>
            <div className="overflow-y-auto flex-1 space-y-1">
              {excludeCandidates.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(excludeSearch.toLowerCase())).length === 0 ? (
                <p className="text-white/40 text-sm text-center py-4">No team members available</p>
              ) : (
                excludeCandidates
                  .filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(excludeSearch.toLowerCase()))
                  .map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        excludeAthlete({ variables: { eventId: editingEvent.id, userId: u.id } });
                        setLocalExcluded(prev => [...prev, u]);
                        setLocalIncluded(prev => prev.filter(x => x.id !== u.id));
                        setShowAddExcludeModal(false);
                        setExcludeSearch("");
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/8 transition-colors text-left"
                    >
                      {u.image ? (
                        <img src={u.image} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-xs">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                      )}
                      <span className="text-white text-sm">{u.firstName} {u.lastName}</span>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
