"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import {
  GET_EVENTS,
  GET_TEAMS,
  CREATE_EVENT,
  CREATE_RECURRING_EVENT,
  UPDATE_EVENT,
  DELETE_EVENT,
  DELETE_RECURRING_EVENT,
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
} from "lucide-react";
import Link from "next/link";

// ============================================
// Types
// ============================================

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
  team?: { id: string; name: string };
  participatingTeams: { id: string; name: string }[];
  checkIns: { id: string; status: string }[];
  recurringEvent?: { id: string } | null;
};

type TabKey = "PRACTICE" | "MEETING" | "EVENT";
type TimeFilter = "TODAY" | "WEEK" | "MONTH" | "ALL";

const TAB_CONFIG: { key: TabKey; label: string; defaultFilter: TimeFilter }[] = [
  { key: "PRACTICE", label: "Practices", defaultFilter: "TODAY" },
  { key: "MEETING", label: "Meetings", defaultFilter: "WEEK" },
  { key: "EVENT", label: "Events", defaultFilter: "ALL" },
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
  const start = new Date(now);
  const end = new Date(now);

  switch (filter) {
    case "TODAY":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "WEEK": {
      const day = now.getDay();
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "MONTH":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
  }
  return { start, end };
}

// ============================================
// Main Page
// ============================================

export default function Events() {
  const { selectedOrganizationId, canEdit } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deleteDialogEvent, setDeleteDialogEvent] = useState<Event | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>("PRACTICE");
  const defaultFilter = TAB_CONFIG.find((t) => t.key === activeTab)!.defaultFilter;
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(defaultFilter);

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
  }, [timeFilter, pageSize]);

  const { data, loading, refetch } = useQuery<any>(GET_EVENTS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const [updateEvent] = useMutation<any>(UPDATE_EVENT);
  const [deleteEvent] = useMutation<any>(DELETE_EVENT);
  const [deleteRecurringEvent] = useMutation<any>(DELETE_RECURRING_EVENT);

  const allEvents: Event[] = data?.events || [];

  // Filter by type, then by time range, then sort by date desc
  const filteredEvents = useMemo(() => {
    let result = allEvents.filter((e) => e.type === activeTab);

    const range = getDateRange(timeFilter);
    if (range) {
      result = result.filter((e) => {
        const d = parseDate(e.date);
        return d >= range.start && d <= range.end;
      });
    }

    // Sort: newest first
    result.sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());
    return result;
  }, [allEvents, activeTab, timeFilter]);

  // Pagination derived values
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const paginatedEvents = filteredEvents.slice(page * pageSize, (page + 1) * pageSize);

  // Separate into upcoming and past for display within the current page
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = paginatedEvents
    .filter((e) => parseDate(e.date) >= today)
    .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());

  const past = paginatedEvents
    .filter((e) => parseDate(e.date) < today)
    .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());

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
        },
      });
      setEditingEvent(null);
      refetch();
    } catch (error) {
      console.error("Failed to update event:", error);
    }
  };

  // Delete handlers
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Events</h1>
          <p className="text-gray-400 mt-1">Manage practices, meetings, and tournaments</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Event
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {TAB_CONFIG.map(({ key, label }) => {
          const count = allEvents.filter((e) => e.type === key).length;
          return (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === key
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {label}
              <span
                className={`text-xs rounded-full px-1.5 py-0.5 ${
                  activeTab === key ? "bg-purple-500/50 text-white" : "bg-gray-700 text-gray-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Time Range Filters */}
      <div className="flex items-center gap-2 mb-6">
        {TIME_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTimeFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              timeFilter === value
                ? "bg-gray-600 text-white"
                : "bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="text-gray-600 text-xs ml-2">
          {filteredEvents.length} {filteredEvents.length === 1 ? "event" : "events"}
        </span>
      </div>

      {/* Event List */}
      <div className="space-y-2">
        {upcoming.map((event) => (
          <Link key={event.id} href={`/events/${event.id}`}>
            <EventCard event={event} canEdit={canEdit} onEdit={handleEditClick} onDelete={handleDeleteClick} dimmed={false} />
          </Link>
        ))}

        {past.length > 0 && upcoming.length > 0 && (
          <div className="flex items-center gap-3 py-2">
            <div className="h-px flex-1 bg-gray-700" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Past</span>
            <div className="h-px flex-1 bg-gray-700" />
          </div>
        )}

        {past.map((event) => (
          <Link key={event.id} href={`/events/${event.id}`}>
            <EventCard event={event} canEdit={canEdit} onEdit={handleEditClick} onDelete={handleDeleteClick} dimmed />
          </Link>
        ))}

        {filteredEvents.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No {EVENT_TYPE_LABELS[activeTab]?.toLowerCase() || "event"}s found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredEvents.length > 0 && (
        <div className="mt-4 bg-gray-800 rounded-xl border border-gray-700 px-6 py-3 flex items-center justify-between">
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
              &middot; {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filteredEvents.length)} of{" "}
              {filteredEvents.length}
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

      {/* Create Event Modal */}
      {isCreateModalOpen && (
        <EventModal
          organizationId={selectedOrganizationId!}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            refetch();
          }}
        />
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <EventModal
          organizationId={selectedOrganizationId!}
          editingEvent={editingEvent}
          onClose={() => setEditingEvent(null)}
          onUpdate={handleUpdateEvent}
        />
      )}

      {/* Delete Recurring Event Dialog */}
      {deleteDialogEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl w-full max-w-sm p-6 border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-2">Delete Recurring Event</h3>
            <p className="text-gray-400 text-sm mb-6">
              This event is part of a recurring series. What would you like to do?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleDeleteThisOnly(deleteDialogEvent.id)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
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
                className="w-full px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
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
      className={`bg-gray-800 rounded-xl border border-gray-700 p-4 hover:border-gray-600 transition-colors cursor-pointer ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <div
            className={`px-3 py-1 rounded-lg text-xs font-medium ${
              EVENT_TYPE_COLORS[event.type] || "bg-gray-600/20 text-gray-400"
            }`}
          >
            {EVENT_TYPE_LABELS[event.type] || event.type}
          </div>
          <div>
            <div className="flex items-center">
              <h3 className="text-white font-medium">{event.title}</h3>
              {event.recurringEvent && (
                <span className="ml-2 flex items-center text-xs text-purple-400">
                  <Repeat className="w-3 h-3 mr-1" />
                  Recurring
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-400">
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
            {event.team && (
              <div className="flex items-center gap-2 mt-2">
                <Users className="w-3.5 h-3.5 text-gray-500" />
                <span className="px-2 py-0.5 bg-purple-600/15 text-purple-400 rounded text-xs">
                  {event.team.name}
                </span>
              </div>
            )}
            {event.participatingTeams?.length > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Users className="w-3.5 h-3.5 text-gray-500" />
                {event.participatingTeams.map((team) => (
                  <span key={team.id} className="px-2 py-0.5 bg-purple-600/15 text-purple-400 rounded text-xs">
                    {team.name}
                  </span>
                ))}
              </div>
            )}
            {event.description && <p className="text-gray-500 text-sm mt-2">{event.description}</p>}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-white font-medium">{event.checkIns.length}</p>
            <p className="text-gray-400 text-xs">checked in</p>
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
                  className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
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
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
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
  onClose,
  onSuccess,
  onUpdate,
}: {
  organizationId: string;
  editingEvent?: Event;
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
    };
  });
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

  const allTeams: { id: string; name: string }[] = teamsData?.teams || [];
  const filteredTeams = allTeams.filter(
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-lg p-6 border border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">{isEdit ? "Edit Event" : "Create Event"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g., Spring Tournament"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as "PRACTICE" | "EVENT" | "MEETING" })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="PRACTICE">Practice</option>
              <option value="EVENT">Tournament</option>
              <option value="MEETING">Meeting</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              {formData.isMultiDay || formData.isRecurring ? "Start Date" : "Date"}
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Multi-day Toggle (hidden when recurring is on) */}
          {!formData.isRecurring && (
            <div className="flex items-center justify-between py-2">
              <label className="text-sm font-medium text-gray-400 flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Multi-day Event
              </label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isMultiDay: !formData.isMultiDay })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.isMultiDay ? "bg-purple-600" : "bg-gray-600"
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
              <label className="text-sm font-medium text-gray-400 flex items-center">
                <Repeat className="w-4 h-4 mr-2" />
                Recurring Event
              </label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isRecurring: !formData.isRecurring })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.isRecurring ? "bg-purple-600" : "bg-gray-600"
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
            <div className="space-y-4 p-4 bg-gray-750 rounded-lg border border-gray-600">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Frequency</label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as "WEEKLY" | "BIWEEKLY" | "DAILY" })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="BIWEEKLY">Biweekly</option>
                </select>
              </div>

              {formData.frequency !== "DAILY" && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Days of Week</label>
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
                            ? "bg-purple-600 text-white"
                            : "bg-gray-700 text-gray-400 hover:text-white"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Repeat Until</label>
                <input
                  type="date"
                  required
                  value={formData.recurringEndDate}
                  onChange={(e) => setFormData({ ...formData, recurringEndDate: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {formData.isMultiDay ? (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Start Time</label>
                <input
                  type="text"
                  required
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="6:00 PM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">End Time</label>
                <input
                  type="text"
                  required
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="8:00 PM"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g., Main Gym"
            />
          </div>

          {/* Teams Picker (create mode only — team changes not supported in edit) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Teams</label>

              {selectedTeams.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedTeams.map((team) => (
                    <span
                      key={team.id}
                      className="flex items-center gap-1 px-2.5 py-1 bg-purple-600/20 text-purple-400 rounded-lg text-sm"
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
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={teamSearch}
                    onChange={(e) => {
                      setTeamSearch(e.target.value);
                      setShowTeamDropdown(true);
                    }}
                    onFocus={() => setShowTeamDropdown(true)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    placeholder="Search teams..."
                  />
                </div>

                {showTeamDropdown && filteredTeams.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredTeams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => addTeam(team)}
                        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
                      >
                        {team.name}
                      </button>
                    ))}
                  </div>
                )}

                {showTeamDropdown && teamSearch && filteredTeams.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg">
                    <p className="px-4 py-2 text-sm text-gray-400">No teams found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Teams display (edit mode — read-only) */}
          {isEdit && editingEvent?.participatingTeams && editingEvent.participatingTeams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Teams</label>
              <div className="flex flex-wrap gap-2">
                {editingEvent.participatingTeams.map((team) => (
                  <span
                    key={team.id}
                    className="px-2.5 py-1 bg-purple-600/20 text-purple-400 rounded-lg text-sm"
                  >
                    {team.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              placeholder="Event details..."
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              {isEdit ? "Save Changes" : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
