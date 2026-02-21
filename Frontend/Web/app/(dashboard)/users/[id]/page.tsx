"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import {
  GET_ORGANIZATION_USERS,
  GET_TEAMS,
  GET_USER_STATS,
  GET_CHECK_IN_HISTORY,
  UPDATE_ORG_MEMBER_ROLE,
  UPDATE_TEAM_MEMBER_ROLE,
  ADD_TEAM_MEMBER,
  REMOVE_TEAM_MEMBER,
  REMOVE_ORG_MEMBER,
} from "@/lib/graphql";
import {
  ArrowLeft,
  Plus,
  Trash2,
  X,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  TrendingUp,
  Trophy,
  Flame,
  BarChart3,
} from "lucide-react";

type TeamAssignment = {
  id: string;
  role: string;
  team: {
    id: string;
    name: string;
  };
};

type OrgMember = {
  id: string;
  role: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    image?: string;
    createdAt: string;
    memberships: TeamAssignment[];
  };
};

type CheckInRecord = {
  id: string;
  status: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  hoursLogged: number | null;
  note: string | null;
  createdAt: string;
  event: {
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
  };
};

const ORG_ROLES = ["ATHLETE", "COACH", "MANAGER", "ADMIN", "GUARDIAN"] as const;
const TEAM_ROLES = ["MEMBER", "CAPTAIN", "COACH"] as const;

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  ON_TIME: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/20", label: "On Time" },
  LATE: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/20", label: "Late" },
  ABSENT: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/20", label: "Absent" },
  EXCUSED: { icon: AlertCircle, color: "text-[#6c5ce7]", bg: "bg-[#6c5ce7]/20", label: "Excused" },
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { selectedOrganizationId, canEdit, isOwner, isAdmin, user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<"roles" | "attendance">("attendance");
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);

  const { data, loading, refetch } = useQuery<any>(GET_ORGANIZATION_USERS, {
    variables: { id: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const { data: statsData, loading: statsLoading } = useQuery<any>(GET_USER_STATS, {
    variables: { userId, organizationId: selectedOrganizationId, timeRange: "MONTH" },
    skip: !selectedOrganizationId || activeTab !== "attendance",
  });

  const { data: checkInData, loading: checkInLoading } = useQuery<any>(GET_CHECK_IN_HISTORY, {
    variables: { userId, limit: 20 },
    skip: activeTab !== "attendance",
  });

  const [updateOrgMemberRole] = useMutation<any>(UPDATE_ORG_MEMBER_ROLE);
  const [updateTeamMemberRole] = useMutation<any>(UPDATE_TEAM_MEMBER_ROLE);
  const [addTeamMember] = useMutation<any>(ADD_TEAM_MEMBER);
  const [removeTeamMember] = useMutation<any>(REMOVE_TEAM_MEMBER);
  const [removeOrgMember] = useMutation<any>(REMOVE_ORG_MEMBER);

  const orgMembers: OrgMember[] = data?.organization?.members || [];
  const member = orgMembers.find((m) => m.user.id === userId);

  const canRemoveMember = (member: OrgMember) => {
    if (member.role === "OWNER") return false;
    if (member.role === "ADMIN" && !isOwner) return false;
    if (member.role === "MANAGER" && !isOwner && !isAdmin) return false;
    if (member.user.id === currentUser?.id && !isOwner) return false;
    return true;
  };

  const canChangeOrgRole = (member: OrgMember) => {
    if (!canEdit) return false;
    if (member.role === "OWNER") return false;
    return true;
  };

  const getAvailableOrgRoles = () => {
    if (isOwner) return ORG_ROLES;
    if (isAdmin) return ORG_ROLES.filter((r) => r !== "ADMIN");
    return ORG_ROLES.filter((r) => r !== "ADMIN" && r !== "MANAGER");
  };

  const handleOrgRoleChange = async (newRole: string) => {
    if (!selectedOrganizationId || !member) return;
    try {
      await updateOrgMemberRole({
        variables: { userId, organizationId: selectedOrganizationId, role: newRole },
      });
      refetch();
    } catch (error) {
      console.error("Failed to update role:", error);
    }
  };

  const handleTeamRoleChange = async (teamId: string, newRole: string) => {
    try {
      await updateTeamMemberRole({
        variables: { userId, teamId, role: newRole },
      });
      refetch();
    } catch (error) {
      console.error("Failed to update team role:", error);
    }
  };

  const handleRemoveFromTeam = async (teamId: string) => {
    if (!confirm("Remove this user from the team?")) return;
    try {
      await removeTeamMember({ variables: { userId, teamId } });
      refetch();
    } catch (error) {
      console.error("Failed to remove from team:", error);
    }
  };

  const handleRemoveFromOrg = async () => {
    if (!selectedOrganizationId) return;
    if (!confirm("Are you sure you want to remove this user from the organization? This cannot be undone.")) return;
    try {
      await removeOrgMember({ variables: { userId, organizationId: selectedOrganizationId } });
      router.push("/users");
    } catch (error) {
      console.error("Failed to remove from organization:", error);
    }
  };

  const roleBadge = (role: string) => {
    const styles: Record<string, string> = {
      OWNER: "bg-yellow-600/20 text-yellow-400",
      ADMIN: "bg-[#6c5ce7]/20 text-[#a78bfa]",
      MANAGER: "bg-blue-600/20 text-blue-400",
      COACH: "bg-green-600/20 text-green-400",
      ATHLETE: "bg-green-600/20 text-green-400",
      GUARDIAN: "bg-white/10 text-white/55",
      MEMBER: "bg-green-600/20 text-green-400",
      CAPTAIN: "bg-blue-600/20 text-blue-400",
    };
    return styles[role] || "bg-white/10 text-white/55";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6c5ce7]"></div>
      </div>
    );
  }

  if (!member) {
    return (
      <div>
        <Link href="/users" className="inline-flex items-center text-white/55 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Users
        </Link>
        <div className="text-center py-12">
          <p className="text-white/55">User not found</p>
        </div>
      </div>
    );
  }

  const memberSince = member.user.createdAt
    ? new Date(isNaN(Number(member.user.createdAt)) ? member.user.createdAt : Number(member.user.createdAt)).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const userStats = statsData?.userStats;
  const checkIns: CheckInRecord[] = checkInData?.checkInHistory || [];

  return (
    <div className="max-w-3xl">
      {/* Back Link */}
      <Link href="/users" className="inline-flex items-center text-white/55 hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Users
      </Link>

      {/* Summary Card */}
      <div className="bg-[#1a1640] rounded-xl border border-white/10 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center">
            {member.user.image ? (
              <img
                src={member.user.image}
                alt={`${member.user.firstName} ${member.user.lastName}`}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-xl font-medium">
                {member.user.firstName[0]}
                {member.user.lastName[0]}
              </div>
            )}
            <div className="ml-5">
              <h1 className="text-2xl font-bold text-white">
                {member.user.firstName} {member.user.lastName}
              </h1>
              <p className="text-white/55">{member.user.email}</p>
              {memberSince && (
                <p className="text-white/40 text-sm mt-1">Member since {memberSince}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 ml-4">
            <span className={`px-3 py-1.5 text-sm font-medium rounded ${roleBadge(member.role)}`}>
              {member.role}
            </span>
            <span className="text-white/55 text-sm">
              {member.user.memberships.length} {member.user.memberships.length === 1 ? "Team" : "Teams"}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-white/10 mb-6">
        <button
          onClick={() => setActiveTab("attendance")}
          className={`px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === "attendance"
              ? "text-[#a78bfa]"
              : "text-white/55 hover:text-white"
          }`}
        >
          Attendance
          {activeTab === "attendance" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6c5ce7]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("roles")}
          className={`px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === "roles"
              ? "text-[#a78bfa]"
              : "text-white/55 hover:text-white"
          }`}
        >
          Roles & Settings
          {activeTab === "roles" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6c5ce7]" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "roles" ? (
        <>
          {/* Organization Role */}
          <div className="bg-[#1a1640] rounded-xl border border-white/10 p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Organization Role</h2>
            {canChangeOrgRole(member) ? (
              <select
                value={member.role}
                onChange={(e) => handleOrgRoleChange(e.target.value)}
                className="px-4 py-2 bg-[#261f55] border border-white/[0.12] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
              >
                {getAvailableOrgRoles().map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            ) : (
              <span className={`px-3 py-1.5 text-sm font-medium rounded ${roleBadge(member.role)}`}>
                {member.role}
              </span>
            )}
          </div>

          {/* Teams */}
          <div className="bg-[#1a1640] rounded-xl border border-white/10 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Teams</h2>
              {canEdit && (
                <button
                  onClick={() => setShowAddTeamModal(true)}
                  className="flex items-center text-sm text-[#a78bfa] hover:text-[#c4b5fd] transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add to Team
                </button>
              )}
            </div>

            {member.user.memberships.length > 0 ? (
              <div className="space-y-3">
                {member.user.memberships.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-4">
                      <Link
                        href={`/teams/${membership.team.id}`}
                        className="text-white font-medium hover:text-[#a78bfa] transition-colors"
                      >
                        {membership.team.name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-3">
                      {canEdit ? (
                        <select
                          value={membership.role}
                          onChange={(e) => handleTeamRoleChange(membership.team.id, e.target.value)}
                          className="px-3 py-1.5 text-sm bg-[#261f55] border border-white/[0.12] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
                        >
                          {TEAM_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-2 py-1 text-xs font-medium rounded ${roleBadge(membership.role)}`}>
                          {membership.role}
                        </span>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => handleRemoveFromTeam(membership.team.id)}
                          className="p-1.5 text-white/55 hover:text-red-500 transition-colors"
                          title="Remove from team"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/40 text-sm">Not assigned to any teams</p>
            )}
          </div>

          {/* Remove from Organization */}
          {canEdit && canRemoveMember(member) && (
            <div className="bg-[#1a1640] rounded-xl border border-red-900/50 p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Danger Zone</h2>
              <p className="text-white/55 text-sm mb-4">
                Removing this user from the organization will revoke their access to all teams and data.
              </p>
              <button
                onClick={handleRemoveFromOrg}
                className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30 transition-colors"
              >
                Remove from Organization
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Attendance Tab */}
          {statsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6c5ce7]"></div>
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#1a1640] rounded-xl border border-white/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-white/55">Attendance Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {userStats ? `${Math.round(userStats.attendancePercent)}%` : "--"}
                  </p>
                </div>

                <div className="bg-[#1a1640] rounded-xl border border-white/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-white/55">Hours Logged</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {userStats ? userStats.hoursLogged.toFixed(1) : "--"}
                  </p>
                  {userStats && userStats.hoursRequired > 0 && (
                    <p className="text-xs text-white/40 mt-1">of {userStats.hoursRequired} required</p>
                  )}
                </div>

                <div className="bg-[#1a1640] rounded-xl border border-white/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span className="text-xs text-white/55">Current Streak</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {userStats ? userStats.currentStreak : "--"}
                  </p>
                  <p className="text-xs text-white/40 mt-1">events</p>
                </div>

                <div className="bg-[#1a1640] rounded-xl border border-white/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-white/55">Org Rank</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {userStats && userStats.orgRank > 0 ? `#${userStats.orgRank}` : "--"}
                  </p>
                  {userStats && userStats.orgSize > 0 && (
                    <p className="text-xs text-white/40 mt-1">of {userStats.orgSize}</p>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-[#1a1640] rounded-xl border border-white/10 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
                {checkInLoading ? (
                  <div className="flex items-center justify-center h-20">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#6c5ce7]"></div>
                  </div>
                ) : checkIns.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-white/55 border-b border-white/10">
                          <th className="pb-3 font-medium">Event</th>
                          <th className="pb-3 font-medium">Date</th>
                          <th className="pb-3 font-medium">Status</th>
                          <th className="pb-3 font-medium">Check In</th>
                          <th className="pb-3 font-medium">Check Out</th>
                          <th className="pb-3 font-medium">Hours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10/50">
                        {checkIns.map((checkIn) => {
                          const config = STATUS_CONFIG[checkIn.status];
                          const StatusIcon = config?.icon || CheckCircle;
                          return (
                            <tr key={checkIn.id} className="text-sm">
                              <td className="py-3 pr-4">
                                <Link
                                  href={`/events/${checkIn.event.id}`}
                                  className="text-white hover:text-[#a78bfa] transition-colors"
                                >
                                  {checkIn.event.title}
                                </Link>
                              </td>
                              <td className="py-3 pr-4 text-white/55">
                                {new Date(isNaN(Number(checkIn.event.date)) ? checkIn.event.date : Number(checkIn.event.date)).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </td>
                              <td className="py-3 pr-4">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${config?.bg || "bg-gray-500/20"} ${config?.color || "text-white/55"}`}>
                                  <StatusIcon className="w-3 h-3" />
                                  {config?.label || checkIn.status}
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-white/55">
                                {checkIn.checkInTime
                                  ? new Date(isNaN(Number(checkIn.checkInTime)) ? checkIn.checkInTime : Number(checkIn.checkInTime)).toLocaleTimeString("en-US", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })
                                  : "--"}
                              </td>
                              <td className="py-3 pr-4 text-white/55">
                                {checkIn.checkOutTime
                                  ? new Date(isNaN(Number(checkIn.checkOutTime)) ? checkIn.checkOutTime : Number(checkIn.checkOutTime)).toLocaleTimeString("en-US", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })
                                  : "--"}
                              </td>
                              <td className="py-3 text-white/55">
                                {checkIn.hoursLogged != null ? checkIn.hoursLogged.toFixed(1) : "--"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-white/40 text-sm text-center py-8">No attendance records yet</p>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Add to Team Modal */}
      {showAddTeamModal && selectedOrganizationId && (
        <AddToTeamModal
          userId={userId}
          organizationId={selectedOrganizationId}
          currentTeamIds={member.user.memberships.map((m) => m.team.id)}
          onClose={() => setShowAddTeamModal(false)}
          onSuccess={() => {
            refetch();
            setShowAddTeamModal(false);
          }}
        />
      )}
    </div>
  );
}

function AddToTeamModal({
  userId,
  organizationId,
  currentTeamIds,
  onClose,
  onSuccess,
}: {
  userId: string;
  organizationId: string;
  currentTeamIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: teamsData } = useQuery<any>(GET_TEAMS, {
    variables: { organizationId },
  });

  const [addTeamMember] = useMutation<any>(ADD_TEAM_MEMBER);

  const allTeams: { id: string; name: string }[] = teamsData?.teams || [];
  const availableTeams = allTeams.filter(
    (team) =>
      !currentTeamIds.includes(team.id) &&
      team.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (teamId: string) => {
    setSubmitting(true);
    try {
      await addTeamMember({
        variables: {
          input: { userId, teamId, role: "MEMBER" },
        },
      });
      onSuccess();
    } catch (error) {
      console.error("Failed to add to team:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1a1640] rounded-xl w-full max-w-md p-6 border border-white/10" ref={dropdownRef}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Add to Team</h2>
          <button onClick={onClose} className="text-white/55 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#261f55] border border-white/[0.12] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] text-sm"
            placeholder="Search teams..."
            autoFocus
          />
        </div>

        <div className="max-h-64 overflow-y-auto">
          {availableTeams.length > 0 ? (
            availableTeams.map((team) => (
              <button
                key={team.id}
                onClick={() => handleAdd(team.id)}
                disabled={submitting}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
              >
                <span>{team.name}</span>
                <Plus className="w-4 h-4 text-white/55" />
              </button>
            ))
          ) : (
            <p className="text-center text-white/40 py-4 text-sm">
              {search ? "No matching teams" : "Already on all teams"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
