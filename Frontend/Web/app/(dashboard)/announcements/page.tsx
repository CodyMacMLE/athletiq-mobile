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
      eventDate
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
  targetType: "ALL_TEAMS" | "SPECIFIC_TEAMS" | "EVENT_DAY";
  teamIds: string[];
  eventDate: string | null;
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
  const { selectedOrg, userRole } = useAuth();
  const [filter, setFilter] = useState<"all" | "sent" | "draft">("all");

  const { data, loading, refetch } = useQuery(GET_ANNOUNCEMENTS, {
    variables: {
      organizationId: selectedOrg?.id,
      limit: 100,
    },
    skip: !selectedOrg?.id,
  });

  const [deleteAnnouncement] = useMutation(DELETE_ANNOUNCEMENT, {
    onCompleted: () => refetch(),
  });

  const [sendAnnouncement] = useMutation(SEND_ANNOUNCEMENT, {
    onCompleted: () => refetch(),
  });

  // Check if user can create announcements
  const canCreate = ["OWNER", "ADMIN", "MANAGER", "COACH"].includes(userRole || "");

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

  const announcements = data?.organizationAnnouncements || [];
  const filteredAnnouncements = announcements.filter((a: Announcement) => {
    if (filter === "sent") return a.sentAt;
    if (filter === "draft") return !a.sentAt;
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
      case "EVENT_DAY":
        return announcement.eventDate
          ? `Events on ${new Date(announcement.eventDate).toLocaleDateString()}`
          : "Event Day";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0118] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Announcements</h1>
            <p className="text-gray-400 mt-1">
              Send messages to your team members
            </p>
          </div>
          {canCreate && (
            <Link
              href="/announcements/new"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Announcement
            </Link>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              filter === "all"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-gray-400 hover:text-gray-300"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("sent")}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              filter === "sent"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-gray-400 hover:text-gray-300"
            }`}
          >
            Sent
          </button>
          <button
            onClick={() => setFilter("draft")}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              filter === "draft"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-gray-400 hover:text-gray-300"
            }`}
          >
            Drafts
          </button>
        </div>

        {/* Announcements List */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone className="w-12 h-12 mx-auto text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-2">
              {filter === "draft"
                ? "No draft announcements"
                : filter === "sent"
                ? "No sent announcements"
                : "No announcements yet"}
            </h3>
            {canCreate && filter === "all" && (
              <Link
                href="/announcements/new"
                className="text-purple-400 hover:text-purple-300"
              >
                Create your first announcement
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAnnouncements.map((announcement: Announcement) => (
              <div
                key={announcement.id}
                className="bg-[#1a1640] border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">
                        {announcement.title}
                      </h3>
                      {announcement.sentAt ? (
                        <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs font-medium rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Sent
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 text-xs font-medium rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Draft
                        </span>
                      )}
                    </div>
                    <p className="text-gray-300 mb-4 line-clamp-2">
                      {announcement.message}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {getTargetLabel(announcement)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {announcement.sentAt
                          ? formatDate(announcement.sentAt)
                          : `Created ${formatDate(announcement.createdAt)}`}
                      </div>
                      <div>
                        By {announcement.creator.firstName}{" "}
                        {announcement.creator.lastName}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    {!announcement.sentAt && canCreate && (
                      <button
                        onClick={() => handleSend(announcement.id)}
                        className="p-2 hover:bg-purple-600/20 text-purple-400 rounded-lg transition-colors"
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
