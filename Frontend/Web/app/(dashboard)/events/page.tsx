"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import {
  GET_EVENTS,
  GET_TEAMS,
  CREATE_EVENT,
  DELETE_EVENT,
  DELETE_RECURRING_EVENT,
} from "@/lib/graphql";
import { Plus, Calendar, MapPin, Clock, Trash2, X, Repeat, Search, Users } from "lucide-react";

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
  team?: {
    id: string;
    name: string;
  };
  participatingTeams: { id: string; name: string }[];
  checkIns: { id: string; status: string }[];
  recurringEvent?: {
    id: string;
  } | null;
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  EVENT: "bg-red-600/20 text-red-400",
  MEETING: "bg-yellow-600/20 text-yellow-400",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  EVENT: "Tournament",
  MEETING: "Meeting",
};

export default function Events() {
  const { selectedOrganizationId, canEdit } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [deleteDialogEvent, setDeleteDialogEvent] = useState<Event | null>(null);

  const { data, loading, refetch } = useQuery(GET_EVENTS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const [deleteEvent] = useMutation(DELETE_EVENT);
  const [deleteRecurringEvent] = useMutation(DELETE_RECURRING_EVENT);

  const events: Event[] = data?.events || [];

  // Only show org-wide events (no team assigned)
  const orgEvents = events.filter((e) => !e.team);

  const filteredEvents = orgEvents.filter(
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Events</h1>
          <p className="text-gray-400 mt-1">Organization-wide events like tournaments and competitions</p>
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

      {/* Filters */}
      <div className="flex items-center space-x-2 mb-6">
        {[
          { value: "all", label: "All" },
          { value: "MEETING", label: "Meeting" },
          { value: "EVENT", label: "Tournament" },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSelectedType(value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedType === value
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Event List */}
      <div className="space-y-2">
        {upcoming.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            canEdit={canEdit}
            onDelete={handleDeleteClick}
            dimmed={false}
          />
        ))}

        {past.length > 0 && upcoming.length > 0 && (
          <div className="flex items-center gap-3 py-2">
            <div className="h-px flex-1 bg-gray-700" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Past</span>
            <div className="h-px flex-1 bg-gray-700" />
          </div>
        )}

        {past.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            canEdit={canEdit}
            onDelete={handleDeleteClick}
            dimmed
          />
        ))}

        {upcoming.length === 0 && past.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No events found</p>
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {isCreateModalOpen && (
        <CreateEventModal
          organizationId={selectedOrganizationId!}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            refetch();
          }}
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
      className={`bg-gray-800 rounded-xl border border-gray-700 p-4 hover:border-gray-600 transition-colors ${
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
            {event.participatingTeams?.length > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Users className="w-3.5 h-3.5 text-gray-500" />
                {event.participatingTeams.map((team) => (
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
              <p className="text-gray-500 text-sm mt-2">{event.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-white font-medium">{event.checkIns.length}</p>
            <p className="text-gray-400 text-xs">checked in</p>
          </div>
          {canEdit && (
            <button
              onClick={() => onDelete(event)}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateEventModal({
  organizationId,
  onClose,
  onSuccess,
}: {
  organizationId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    title: "",
    type: "EVENT" as "EVENT" | "MEETING",
    date: "",
    endDate: "",
    isMultiDay: false,
    startTime: "",
    endTime: "",
    location: "",
    description: "",
  });
  const [selectedTeams, setSelectedTeams] = useState<{ id: string; name: string }[]>([]);
  const [teamSearch, setTeamSearch] = useState("");
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: teamsData } = useQuery(GET_TEAMS, {
    variables: { organizationId },
  });
  const [createEvent] = useMutation(CREATE_EVENT);

  const allTeams: { id: string; name: string }[] = teamsData?.teams || [];
  const filteredTeams = allTeams.filter(
    (team) =>
      !selectedTeams.some((s) => s.id === team.id) &&
      team.name.toLowerCase().includes(teamSearch.toLowerCase())
  );

  // Close dropdown on outside click
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
    try {
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
      onSuccess();
    } catch (error) {
      console.error("Failed to create event:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-lg p-6 border border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Create Event</h2>
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
              onChange={(e) => setFormData({ ...formData, type: e.target.value as "EVENT" | "MEETING" })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="EVENT">Tournament</option>
              <option value="MEETING">Meeting</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              {formData.isMultiDay ? "Start Date" : "Date"}
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Multi-day Toggle */}
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

          {/* Teams Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Teams</label>

            {/* Selected teams */}
            {selectedTeams.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedTeams.map((team) => (
                  <span
                    key={team.id}
                    className="flex items-center gap-1 px-2.5 py-1 bg-purple-600/20 text-purple-400 rounded-lg text-sm"
                  >
                    {team.name}
                    <button
                      type="button"
                      onClick={() => removeTeam(team.id)}
                      className="hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search input */}
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

              {/* Dropdown */}
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
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Create Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
