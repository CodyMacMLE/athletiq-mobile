"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import {
  GET_TEAM,
  CREATE_EVENT,
  DELETE_EVENT,
  CREATE_RECURRING_EVENT,
  DELETE_RECURRING_EVENT,
} from "@/lib/graphql";
import {
  Plus,
  Calendar,
  MapPin,
  Clock,
  Trash2,
  X,
  Users,
  Repeat,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
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

const EVENT_TYPE_COLORS = {
  PRACTICE: "bg-purple-600/20 text-purple-400",
  EVENT: "bg-red-600/20 text-red-400",
  MEETING: "bg-yellow-600/20 text-yellow-400",
  REST: "bg-gray-600/20 text-gray-400",
};

export default function TeamDetail() {
  const params = useParams();
  const teamId = params.id as string;
  const { canEdit } = useAuth();
  const [activeTab, setActiveTab] = useState<"events" | "members">("events");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedTime, setSelectedTime] = useState<"upcoming" | "past">("upcoming");
  const [deleteDialogEvent, setDeleteDialogEvent] = useState<Event | null>(null);
  const [eventsPage, setEventsPage] = useState(1);
  const EVENTS_PER_PAGE = 10;

  const { data, loading, refetch } = useQuery(GET_TEAM, {
    variables: { id: teamId },
    skip: !teamId,
  });

  const [deleteEvent] = useMutation(DELETE_EVENT);
  const [deleteRecurringEvent] = useMutation(DELETE_RECURRING_EVENT);

  const team = data?.team;
  const events: Event[] = team?.events || [];
  const members: Member[] = team?.members || [];

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

  if (loading || !team) {
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
          <Link
            href="/teams"
            className="flex items-center text-gray-400 hover:text-white transition-colors mb-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Teams
          </Link>
          <h1 className="text-2xl font-bold text-white">{team.name}</h1>
          <div className="flex items-center space-x-4 mt-1 text-gray-400 text-sm">
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
        {canEdit && activeTab === "events" && (
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
      <div className="flex items-center space-x-1 mb-6 border-b border-gray-700">
        {([
          { key: "events", label: "Events", icon: <Calendar className="w-4 h-4 mr-2" /> },
          { key: "members", label: "Members", icon: <Users className="w-4 h-4 mr-2" /> },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-purple-500 text-white"
                : "border-transparent text-gray-400 hover:text-white"
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
                      ? "bg-purple-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {type === "all" ? "All" : type.charAt(0) + type.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Time Filter */}
            <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
              {(["upcoming", "past"] as const).map((time) => (
                <button
                  key={time}
                  onClick={() => {
                    setSelectedTime(time);
                    setEventsPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    selectedTime === time
                      ? "bg-gray-700 text-white"
                      : "text-gray-400 hover:text-white"
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
              <EventCard
                key={event.id}
                event={event}
                canEdit={canEdit}
                onDelete={handleDeleteClick}
                dimmed={selectedTime === "past"}
              />
            ))}

            {displayedEvents.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">
                  {selectedTime === "upcoming" ? "No upcoming events" : "No past events"}
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-400">
                Showing {pageStart + 1}-{Math.min(pageStart + EVENTS_PER_PAGE, displayedEvents.length)} of {displayedEvents.length}
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
                  disabled={safeEventsPage <= 1}
                  className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setEventsPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === safeEventsPage
                        ? "bg-purple-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setEventsPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeEventsPage >= totalPages}
                  className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
              className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center space-x-3"
            >
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                {member.user.firstName[0]}
                {member.user.lastName[0]}
              </div>
              <div className="min-w-0">
                <p className="text-white font-medium truncate">
                  {member.user.firstName} {member.user.lastName}
                </p>
                <p className="text-gray-400 text-xs capitalize">
                  {member.role.toLowerCase()}
                </p>
              </div>
              <div className="ml-auto text-right flex-shrink-0">
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
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No members yet</p>
            </div>
          )}
        </div>
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

  const [createEvent] = useMutation(CREATE_EVENT);
  const [createRecurringEvent] = useMutation(CREATE_RECURRING_EVENT);

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
              placeholder="e.g., Team Practice"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="PRACTICE">Practice</option>
              <option value="EVENT">Event</option>
              <option value="MEETING">Meeting</option>
              <option value="REST">Rest Day</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              {formData.isRecurring ? "Start Date" : "Date"}
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Recurring Event Toggle */}
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

          {/* Recurring Event Fields */}
          {formData.isRecurring && (
            <div className="space-y-4 p-4 bg-gray-750 border border-gray-600 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Frequency</label>
                <select
                  value={formData.frequency}
                  onChange={(e) =>
                    setFormData({ ...formData, frequency: e.target.value as typeof formData.frequency })
                  }
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="BIWEEKLY">Biweekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>

              {(formData.frequency === "WEEKLY" || formData.frequency === "BIWEEKLY") && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Days of Week</label>
                  <div className="flex gap-2">
                    {DAY_LABELS.map((label, index) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleDay(index)}
                        className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${
                          formData.daysOfWeek.includes(index)
                            ? "bg-purple-600 text-white"
                            : "bg-gray-700 text-gray-400 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
            </div>
          )}

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
