"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { gql } from "@apollo/client";
import { ArrowLeft, Send, Users, Calendar, Megaphone } from "lucide-react";
import Link from "next/link";

const GET_TEAMS = gql`
  query GetTeams($organizationId: ID!) {
    teams(organizationId: $organizationId) {
      id
      name
    }
  }
`;

const CREATE_ANNOUNCEMENT = gql`
  mutation CreateAnnouncement($input: CreateAnnouncementInput!) {
    createAnnouncement(input: $input) {
      id
      title
      message
    }
  }
`;

const SEND_ANNOUNCEMENT = gql`
  mutation SendAnnouncement($id: ID!) {
    sendAnnouncement(id: $id)
  }
`;

type TargetType = "ALL_TEAMS" | "SPECIFIC_TEAMS" | "EVENT_DAY";

export default function NewAnnouncementPage() {
  const router = useRouter();
  const { selectedOrg } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<TargetType>("ALL_TEAMS");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [eventDate, setEventDate] = useState("");
  const [isSending, setIsSending] = useState(false);

  const { data: teamsData } = useQuery(GET_TEAMS, {
    variables: { organizationId: selectedOrg?.id },
    skip: !selectedOrg?.id,
  });

  const [createAnnouncement] = useMutation(CREATE_ANNOUNCEMENT);
  const [sendAnnouncement] = useMutation(SEND_ANNOUNCEMENT);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg?.id) return;

    setIsSending(true);
    try {
      // Create announcement
      const { data } = await createAnnouncement({
        variables: {
          input: {
            title,
            message,
            organizationId: selectedOrg.id,
            targetType,
            teamIds: targetType === "SPECIFIC_TEAMS" ? selectedTeams : [],
            eventDate: targetType === "EVENT_DAY" ? eventDate : null,
          },
        },
      });

      // Send announcement
      await sendAnnouncement({
        variables: { id: data.createAnnouncement.id },
      });

      // Redirect to announcements list
      router.push("/announcements");
    } catch (error) {
      console.error("Failed to create announcement:", error);
      alert("Failed to create announcement. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeams((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId]
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0118] text-white p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/announcements"
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">New Announcement</h1>
            <p className="text-sm text-gray-400 mt-1">
              Send a message to your team members
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Practice Cancelled Tomorrow"
              required
              maxLength={100}
              className="w-full px-4 py-3 bg-[#1a1640] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your announcement message here..."
              required
              rows={6}
              className="w-full px-4 py-3 bg-[#1a1640] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              {message.length} characters
            </p>
          </div>

          {/* Target Type */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Send To <span className="text-red-400">*</span>
            </label>
            <div className="space-y-3">
              {/* All Teams */}
              <button
                type="button"
                onClick={() => setTargetType("ALL_TEAMS")}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  targetType === "ALL_TEAMS"
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-gray-700 bg-[#1a1640] hover:border-gray-600"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">All Teams</div>
                    <div className="text-sm text-gray-400 mt-1">
                      Send to everyone in the organization
                    </div>
                  </div>
                </div>
              </button>

              {/* Specific Teams */}
              <button
                type="button"
                onClick={() => setTargetType("SPECIFIC_TEAMS")}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  targetType === "SPECIFIC_TEAMS"
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-gray-700 bg-[#1a1640] hover:border-gray-600"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Megaphone className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Specific Teams</div>
                    <div className="text-sm text-gray-400 mt-1">
                      Choose which teams to notify
                    </div>
                  </div>
                </div>
              </button>

              {/* Event Day */}
              <button
                type="button"
                onClick={() => setTargetType("EVENT_DAY")}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  targetType === "EVENT_DAY"
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-gray-700 bg-[#1a1640] hover:border-gray-600"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Event Day</div>
                    <div className="text-sm text-gray-400 mt-1">
                      Send to teams with events on a specific date
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Team Selection (for SPECIFIC_TEAMS) */}
          {targetType === "SPECIFIC_TEAMS" && (
            <div>
              <label className="block text-sm font-medium mb-3">
                Select Teams <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {teamsData?.teams.map((team: any) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => toggleTeam(team.id)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      selectedTeams.includes(team.id)
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-gray-700 bg-[#1a1640] hover:border-gray-600"
                    }`}
                  >
                    <div className="font-medium text-sm">{team.name}</div>
                  </button>
                ))}
              </div>
              {selectedTeams.length === 0 && (
                <p className="text-sm text-red-400 mt-2">
                  Please select at least one team
                </p>
              )}
            </div>
          )}

          {/* Event Date (for EVENT_DAY) */}
          {targetType === "EVENT_DAY" && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Event Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#1a1640] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Link
              href="/announcements"
              className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={
                isSending ||
                !title ||
                !message ||
                (targetType === "SPECIFIC_TEAMS" && selectedTeams.length === 0) ||
                (targetType === "EVENT_DAY" && !eventDate)
              }
              className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {isSending ? "Sending..." : "Send Announcement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
