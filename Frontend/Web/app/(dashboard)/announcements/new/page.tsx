"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { gql } from "@apollo/client";
import { ArrowLeft, Send, Users, Calendar, Megaphone, User, Clock } from "lucide-react";
import Link from "next/link";

const GET_TEAMS = gql`
  query GetTeams($organizationId: ID!) {
    teams(organizationId: $organizationId) {
      id
      name
    }
  }
`;

const GET_MEMBERS = gql`
  query GetMembers($id: ID!) {
    organization(id: $id) {
      id
      members {
        id
        user {
          id
          firstName
          lastName
        }
      }
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

type TargetType = "ALL_TEAMS" | "SPECIFIC_TEAMS" | "SPECIFIC_USERS" | "CUSTOM" | "EVENT_DAY";

export default function NewAnnouncementPage() {
  const router = useRouter();
  const { selectedOrganizationId } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<TargetType>("ALL_TEAMS");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [eventDate, setEventDate] = useState("");
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduledFor, setScheduledFor] = useState("");
  const [isSending, setIsSending] = useState(false);

  const needsTeams = targetType === "SPECIFIC_TEAMS" || targetType === "CUSTOM";
  const needsUsers = targetType === "SPECIFIC_USERS" || targetType === "CUSTOM";

  const { data: teamsData } = useQuery(GET_TEAMS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const { data: membersData } = useQuery(GET_MEMBERS, {
    variables: { id: selectedOrganizationId },
    skip: !selectedOrganizationId || !needsUsers,
  });

  const [createAnnouncement] = useMutation(CREATE_ANNOUNCEMENT);
  const [sendAnnouncement] = useMutation(SEND_ANNOUNCEMENT);

  const members: { id: string; firstName: string; lastName: string }[] =
    (membersData as any)?.organization?.members?.map((m: any) => m.user) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrganizationId) return;

    setIsSending(true);
    try {
      const { data } = await createAnnouncement({
        variables: {
          input: {
            title,
            message,
            organizationId: selectedOrganizationId,
            targetType,
            teamIds: needsTeams ? selectedTeams : [],
            userIds: needsUsers ? selectedUsers : [],
            eventDate: targetType === "EVENT_DAY" ? eventDate : null,
            scheduledFor: sendMode === "schedule" && scheduledFor ? scheduledFor : null,
          },
        },
      });

      const announcementId = (data as any).createAnnouncement.id;

      if (sendMode === "now") {
        await sendAnnouncement({ variables: { id: announcementId } });
      }

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
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const isDisabled =
    isSending ||
    !title ||
    !message ||
    (targetType === "SPECIFIC_TEAMS" && selectedTeams.length === 0) ||
    (targetType === "SPECIFIC_USERS" && selectedUsers.length === 0) ||
    (targetType === "CUSTOM" && selectedTeams.length === 0 && selectedUsers.length === 0) ||
    (targetType === "EVENT_DAY" && !eventDate) ||
    (sendMode === "schedule" && !scheduledFor);

  return (
    <div className="min-h-screen bg-[#0a0118] text-white p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/announcements" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">New Announcement</h1>
            <p className="text-sm text-white/55 mt-1">Send a message to your team members</p>
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
              className="w-full px-4 py-3 bg-[#1a1640] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
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
              className="w-full px-4 py-3 bg-[#1a1640] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] resize-none"
            />
            <p className="text-xs text-white/55 mt-1">{message.length} characters</p>
          </div>

          {/* Target Type */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Send To <span className="text-red-400">*</span>
            </label>
            <div className="space-y-3">
              {/* Everyone */}
              <button
                type="button"
                onClick={() => setTargetType("ALL_TEAMS")}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  targetType === "ALL_TEAMS"
                    ? "border-[#6c5ce7] bg-[#6c5ce7]/10"
                    : "border-white/10 bg-[#1a1640] hover:border-white/[0.12]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Everyone</div>
                    <div className="text-sm text-white/55 mt-1">Send to everyone in the organization</div>
                  </div>
                </div>
              </button>

              {/* Specific Teams */}
              <button
                type="button"
                onClick={() => setTargetType("SPECIFIC_TEAMS")}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  targetType === "SPECIFIC_TEAMS"
                    ? "border-[#6c5ce7] bg-[#6c5ce7]/10"
                    : "border-white/10 bg-[#1a1640] hover:border-white/[0.12]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Megaphone className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Specific Teams</div>
                    <div className="text-sm text-white/55 mt-1">Choose which teams to notify</div>
                  </div>
                </div>
              </button>

              {/* Individuals */}
              <button
                type="button"
                onClick={() => setTargetType("SPECIFIC_USERS")}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  targetType === "SPECIFIC_USERS"
                    ? "border-[#6c5ce7] bg-[#6c5ce7]/10"
                    : "border-white/10 bg-[#1a1640] hover:border-white/[0.12]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Individuals</div>
                    <div className="text-sm text-white/55 mt-1">Send to specific people</div>
                  </div>
                </div>
              </button>

              {/* Custom */}
              <button
                type="button"
                onClick={() => setTargetType("CUSTOM")}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  targetType === "CUSTOM"
                    ? "border-[#6c5ce7] bg-[#6c5ce7]/10"
                    : "border-white/10 bg-[#1a1640] hover:border-white/[0.12]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Custom</div>
                    <div className="text-sm text-white/55 mt-1">Combine teams and individuals</div>
                  </div>
                </div>
              </button>

              {/* Event Day */}
              <button
                type="button"
                onClick={() => setTargetType("EVENT_DAY")}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  targetType === "EVENT_DAY"
                    ? "border-[#6c5ce7] bg-[#6c5ce7]/10"
                    : "border-white/10 bg-[#1a1640] hover:border-white/[0.12]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Event Day</div>
                    <div className="text-sm text-white/55 mt-1">
                      Send to teams with events on a specific date
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Team Selection */}
          {needsTeams && (
            <div>
              <label className="block text-sm font-medium mb-3">
                Select Teams{targetType === "SPECIFIC_TEAMS" && <span className="text-red-400"> *</span>}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(teamsData as any)?.teams.map((team: any) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => toggleTeam(team.id)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      selectedTeams.includes(team.id)
                        ? "border-[#6c5ce7] bg-[#6c5ce7]/10"
                        : "border-white/10 bg-[#1a1640] hover:border-white/[0.12]"
                    }`}
                  >
                    <div className="font-medium text-sm">{team.name}</div>
                  </button>
                ))}
              </div>
              {targetType === "SPECIFIC_TEAMS" && selectedTeams.length === 0 && (
                <p className="text-sm text-red-400 mt-2">Please select at least one team</p>
              )}
            </div>
          )}

          {/* Member Selection */}
          {needsUsers && (
            <div>
              <label className="block text-sm font-medium mb-3">
                Select Individuals{targetType === "SPECIFIC_USERS" && <span className="text-red-400"> *</span>}
              </label>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleUser(member.id)}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                      selectedUsers.includes(member.id)
                        ? "border-[#6c5ce7] bg-[#6c5ce7]/10"
                        : "border-white/10 bg-[#1a1640] hover:border-white/[0.12]"
                    }`}
                  >
                    <div className="font-medium text-sm">
                      {member.firstName} {member.lastName}
                    </div>
                  </button>
                ))}
              </div>
              {targetType === "SPECIFIC_USERS" && selectedUsers.length === 0 && (
                <p className="text-sm text-red-400 mt-2">Please select at least one person</p>
              )}
            </div>
          )}

          {/* Event Date */}
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
                className="w-full px-4 py-3 bg-[#1a1640] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
              />
            </div>
          )}

          {/* Scheduling */}
          <div>
            <label className="block text-sm font-medium mb-3">When to Send</label>
            <div className="flex gap-3 mb-4">
              <button
                type="button"
                onClick={() => setSendMode("now")}
                className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-all flex items-center justify-center gap-2 ${
                  sendMode === "now"
                    ? "border-[#6c5ce7] bg-[#6c5ce7]/10 text-white"
                    : "border-white/10 bg-[#1a1640] text-white/55 hover:border-white/[0.12]"
                }`}
              >
                <Send className="w-4 h-4" />
                Send Now
              </button>
              <button
                type="button"
                onClick={() => setSendMode("schedule")}
                className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-all flex items-center justify-center gap-2 ${
                  sendMode === "schedule"
                    ? "border-[#6c5ce7] bg-[#6c5ce7]/10 text-white"
                    : "border-white/10 bg-[#1a1640] text-white/55 hover:border-white/[0.12]"
                }`}
              >
                <Clock className="w-4 h-4" />
                Schedule
              </button>
            </div>

            {sendMode === "schedule" && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Scheduled Date &amp; Time <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  required
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  className="w-full px-4 py-3 bg-[#1a1640] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
                />
                <p className="text-xs text-white/55 mt-1">
                  The announcement will be sent automatically at the scheduled time.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Link
              href="/announcements"
              className="flex-1 px-6 py-3 bg-[#261f55] hover:bg-white/[0.12] rounded-lg font-medium transition-colors text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isDisabled}
              className="flex-1 px-6 py-3 bg-[#6c5ce7] hover:bg-[#5a4dd4] disabled:bg-[#261f55] disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {sendMode === "schedule" ? (
                <>
                  <Clock className="w-4 h-4" />
                  {isSending ? "Scheduling..." : "Schedule Announcement"}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {isSending ? "Sending..." : "Send Announcement"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
