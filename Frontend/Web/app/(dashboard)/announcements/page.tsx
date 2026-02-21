"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { gql } from "@apollo/client";
import {
  Plus,
  Megaphone,
  Users,
  Calendar,
  Trash2,
  Send,
  Clock,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";

const GET_ANNOUNCEMENTS = gql`
  query GetAnnouncements($organizationId: ID!, $limit: Int) {
    organizationAnnouncements(organizationId: $organizationId, limit: $limit) {
      id
      title
      message
      targetType
      teamIds
      userIds
      eventDate
      scheduledFor
      sentAt
      createdAt
      creator {
        id
        firstName
        lastName
      }
    }
  }
`;

const DELETE_ANNOUNCEMENT = gql`
  mutation DeleteAnnouncement($id: ID!) {
    deleteAnnouncement(id: $id)
  }
`;

const SEND_ANNOUNCEMENT = gql`
  mutation SendAnnouncement($id: ID!) {
    sendAnnouncement(id: $id)
  }
`;

type Announcement = {
  id: string;
  title: string;
  message: string;
  targetType: "ALL_TEAMS" | "SPECIFIC_TEAMS" | "SPECIFIC_USERS" | "CUSTOM" | "EVENT_DAY";
  teamIds: string[];
  userIds: string[];
  eventDate: string | null;
  scheduledFor: string | null;
  sentAt: string | null;
  createdAt: string;
  creator: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

export default function AnnouncementsPage() {
  const router = useRouter();
  const { selectedOrganizationId, currentOrgRole } = useAuth();
  const [filter, setFilter] = useState<"all" | "sent" | "scheduled" | "draft">("all");

  const { data, loading, refetch } = useQuery(GET_ANNOUNCEMENTS, {
    variables: {
      organizationId: selectedOrganizationId,
      limit: 100,
    },
    skip: !selectedOrganizationId,
  });

  const [deleteAnnouncement] = useMutation(DELETE_ANNOUNCEMENT, {
    onCompleted: () => refetch(),
  });

  const [sendAnnouncement] = useMutation(SEND_ANNOUNCEMENT, {
    onCompleted: () => refetch(),
  });

  const canCreate = ["OWNER", "ADMIN", "MANAGER", "COACH"].includes(currentOrgRole || "");

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      await deleteAnnouncement({ variables: { id } });
    } catch (error) {
      console.error("Failed to delete announcement:", error);
      alert("Failed to delete announcement");
    }
  };

  const handleSend = async (id: string) => {
    if (!confirm("Are you sure you want to send this announcement?")) return;
    try {
      await sendAnnouncement({ variables: { id } });
    } catch (error) {
      console.error("Failed to send announcement:", error);
      alert("Failed to send announcement");
    }
  };

  const announcements = (data as any)?.organizationAnnouncements || [];
  const filteredAnnouncements = announcements.filter((a: Announcement) => {
    if (filter === "sent") return !!a.sentAt;
    if (filter === "scheduled") return !a.sentAt && !!a.scheduledFor;
    if (filter === "draft") return !a.sentAt && !a.scheduledFor;
    return true;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getTargetLabel = (announcement: Announcement) => {
    switch (announcement.targetType) {
      case "ALL_TEAMS":
        return "All Teams";
      case "SPECIFIC_TEAMS":
        return `${announcement.teamIds.length} Team${announcement.teamIds.length !== 1 ? "s" : ""}`;
      case "SPECIFIC_USERS":
        return `${announcement.userIds.length} ${announcement.userIds.length !== 1 ? "People" : "Person"}`;
      case "CUSTOM": {
        const teams = announcement.teamIds.length;
        const people = announcement.userIds.length;
        const parts: string[] = [];
        if (teams > 0) parts.push(`${teams} Team${teams !== 1 ? "s" : ""}`);
        if (people > 0) parts.push(`${people} ${people !== 1 ? "People" : "Person"}`);
        return parts.join(" + ") || "Custom";
      }
      case "EVENT_DAY":
        return announcement.eventDate
          ? `Events on ${new Date(announcement.eventDate).toLocaleDateString()}`
          : "Event Day";
      default:
        return "Unknown";
    }
  };

  const getStatusBadge = (announcement: Announcement) => {
    if (announcement.sentAt) {
      return (
        <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs font-medium rounded-full flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Sent
        </span>
      );
    }
    if (announcement.scheduledFor) {
      return (
        <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 text-xs font-medium rounded-full flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Scheduled
        </span>
      );
    }
    return (
      <span className="px-2 py-1 bg-gray-600/30 text-white/55 text-xs font-medium rounded-full flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Draft
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-transparent text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Announcements</h1>
            <p className="text-white/55 mt-1">Send messages to your team members</p>
          </div>
          {canCreate && (
            <Link
              href="/announcements/new"
              className="px-4 py-2 bg-[#6c5ce7] hover:bg-[#5a4dd4] rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Announcement
            </Link>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/8">
          {(["all", "sent", "scheduled", "draft"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 font-medium transition-colors border-b-2 capitalize ${
                filter === tab
                  ? "border-[#6c5ce7] text-[#a78bfa]"
                  : "border-transparent text-white/55 hover:text-white/75"
              }`}
            >
              {tab === "draft" ? "Drafts" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Announcements List */}
        {loading ? (
          <div className="text-center py-12 text-white/55">Loading...</div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone className="w-12 h-12 mx-auto text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-white/55 mb-2">
              {filter === "draft"
                ? "No draft announcements"
                : filter === "sent"
                ? "No sent announcements"
                : filter === "scheduled"
                ? "No scheduled announcements"
                : "No announcements yet"}
            </h3>
            {canCreate && filter === "all" && (
              <Link href="/announcements/new" className="text-[#a78bfa] hover:text-[#c4b5fd]">
                Create your first announcement
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAnnouncements.map((announcement: Announcement) => (
              <div
                key={announcement.id}
                className="bg-white/8 border border-white/8 rounded-lg p-6 hover:border-white/10 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{announcement.title}</h3>
                      {getStatusBadge(announcement)}
                    </div>
                    <p className="text-white/75 mb-4 line-clamp-2">{announcement.message}</p>
                    <div className="flex items-center gap-4 text-sm text-white/55 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {getTargetLabel(announcement)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {announcement.sentAt
                          ? formatDate(announcement.sentAt)
                          : announcement.scheduledFor
                          ? `Scheduled for ${formatDate(announcement.scheduledFor)}`
                          : `Created ${formatDate(announcement.createdAt)}`}
                      </div>
                      <div>
                        By {announcement.creator.firstName} {announcement.creator.lastName}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    {!announcement.sentAt && !announcement.scheduledFor && canCreate && (
                      <button
                        onClick={() => handleSend(announcement.id)}
                        className="p-2 hover:bg-[#a855f7]/15 text-[#a78bfa] rounded-lg transition-colors"
                        title="Send announcement"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    {canCreate && (
                      <button
                        onClick={() => handleDelete(announcement.id)}
                        className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors"
                        title="Delete announcement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
