"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import {
  GET_ORGANIZATION_USERS,
  GET_TEAMS,
  REMOVE_ORG_MEMBER,
  CREATE_INVITE,
  CANCEL_INVITE,
  RESEND_INVITE,
  GET_CUSTOM_ROLES,
} from "@/lib/graphql";
import { ASSIGN_CUSTOM_ROLE } from "@/lib/graphql/mutations";
import { Search, Trash2, X, UserPlus, Mail, RefreshCw, Clock, ChevronDown, Tag } from "lucide-react";

type TeamAssignment = {
  id: string;
  role: string;
  team: {
    id: string;
    name: string;
  };
};

type CustomRole = {
  id: string;
  name: string;
};

type OrgMember = {
  id: string;
  role: string;
  customRole?: CustomRole | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    image?: string;
    memberships: TeamAssignment[];
  };
};

type Invite = {
  id: string;
  email: string;
  role: string;
  teamIds: string[];
  status: string;
  token: string;
  createdAt: string;
  expiresAt: string;
};

export default function UsersPage() {
  const { selectedOrganizationId, canEdit, isOwner, isAdmin, user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const { data, loading, refetch } = useQuery<any>(GET_ORGANIZATION_USERS, {
    variables: { id: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const [removeOrgMember] = useMutation<any>(REMOVE_ORG_MEMBER);
  const [cancelInvite] = useMutation<any>(CANCEL_INVITE);
  const [resendInvite] = useMutation<any>(RESEND_INVITE);
  const [assignCustomRole] = useMutation<any>(ASSIGN_CUSTOM_ROLE);

  const { data: rolesData } = useQuery<any>(GET_CUSTOM_ROLES, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId || (!isOwner && !isAdmin),
  });
  const customRoles: CustomRole[] = rolesData?.customRoles || [];

  const orgMembers: OrgMember[] = data?.organization?.members || [];
  const pendingInvites: Invite[] = data?.organization?.invites || [];

  const canRemoveMember = (member: OrgMember) => {
    if (member.role === "OWNER") return false;
    if (member.role === "ADMIN" && !isOwner) return false;
    if (member.role === "MANAGER" && !isOwner && !isAdmin) return false;
    if (member.user.id === currentUser?.id && !isOwner) return false;
    return true;
  };

  // Derive unique team list from existing member data — no extra query needed
  const teamOptions = useMemo(() => {
    const seen = new Set<string>();
    const teams: { id: string; name: string }[] = [];
    for (const m of orgMembers) {
      for (const t of m.user.memberships) {
        if (!seen.has(t.team.id)) {
          seen.add(t.team.id);
          teams.push(t.team);
        }
      }
    }
    return teams.sort((a, b) => a.name.localeCompare(b.name));
  }, [orgMembers]);

  const filteredMembers = useMemo(() => orgMembers.filter((member) => {
    if (roleFilter !== "ALL" && member.role !== roleFilter) return false;
    if (teamFilter !== "ALL" && !member.user.memberships.some((m) => m.team.id === teamFilter)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !`${member.user.firstName} ${member.user.lastName}`.toLowerCase().includes(q) &&
        !member.user.email.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  }), [orgMembers, roleFilter, teamFilter, searchQuery]);

  const handleDeleteUser = async (e: React.MouseEvent, userId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedOrganizationId) return;
    if (!confirm("Are you sure you want to remove this user from the organization?")) return;
    try {
      await removeOrgMember({ variables: { userId, organizationId: selectedOrganizationId } });
      refetch();
    } catch (error) {
      console.error("Failed to remove user:", error);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm("Cancel this invite?")) return;
    try {
      await cancelInvite({ variables: { id: inviteId } });
      refetch();
    } catch (error) {
      console.error("Failed to cancel invite:", error);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      await resendInvite({ variables: { id: inviteId } });
      refetch();
    } catch (error) {
      console.error("Failed to resend invite:", error);
    }
  };

  const roleBadge = (role: string) => {
    const styles: Record<string, string> = {
      OWNER: "bg-yellow-600/20 text-yellow-400",
      ADMIN: "bg-[#a855f7]/15 text-[#a78bfa]",
      MANAGER: "bg-blue-600/20 text-blue-400",
      COACH: "bg-green-600/20 text-green-400",
      ATHLETE: "bg-green-600/20 text-green-400",
      GUARDIAN: "bg-white/10 text-white/55",
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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-white/55 mt-1">Manage users in your organization</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center px-4 py-2 bg-[#6c5ce7] text-white rounded-lg hover:bg-[#5a4dd4] transition-colors"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Invite User
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/55" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/8 border border-white/8 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] text-sm"
          />
        </div>
        {/* Role filter */}
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 bg-white/8 border border-white/8 rounded-lg text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="COACH">Coach</option>
            <option value="ATHLETE">Athlete</option>
            <option value="GUARDIAN">Guardian</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
        </div>
        {/* Team filter */}
        {teamOptions.length > 0 && (
          <div className="relative">
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-white/8 border border-white/8 rounded-lg text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] cursor-pointer"
            >
              <option value="ALL">All Teams</option>
              {teamOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
          </div>
        )}
        <span className="text-white/30 text-xs ml-1">
          {filteredMembers.length} {filteredMembers.length === 1 ? "user" : "users"}
        </span>
      </div>

      {/* Users Table */}
      <div className="bg-white/8 rounded-xl border border-white/8 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/8">
              <th className="px-6 py-4 text-left text-xs font-semibold text-white/55 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-white/55 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-white/55 uppercase tracking-wider">
                Teams
              </th>
              {canEdit && (
                <th className="px-6 py-4 text-right text-xs font-semibold text-white/55 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {filteredMembers.map((member) => (
              <tr key={member.id} className="hover:bg-white/5 transition-colors cursor-pointer">
                <td className="px-6 py-4">
                  <Link href={`/users/${member.user.id}`} className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white font-medium">
                      {member.user.firstName[0]}
                      {member.user.lastName[0]}
                    </div>
                    <div className="ml-4">
                      <p className="text-white font-medium">
                        {member.user.firstName} {member.user.lastName}
                      </p>
                      <p className="text-white/55 text-sm">{member.user.email}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <Link href={`/users/${member.user.id}`}>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${roleBadge(member.role)}`}>
                        {member.role}
                      </span>
                    </Link>
                    {member.customRole && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-[#6c5ce7]/20 text-[#a78bfa] rounded text-xs w-fit">
                        <Tag className="w-3 h-3" />
                        {member.customRole.name}
                      </span>
                    )}
                    {(isOwner || isAdmin) && customRoles.length > 0 && (
                      <select
                        value={member.customRole?.id || ""}
                        onChange={(e) => {
                          assignCustomRole({
                            variables: { memberId: member.id, customRoleId: e.target.value || null },
                            onCompleted: () => refetch(),
                          });
                        }}
                        className="mt-0.5 appearance-none px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/60 hover:text-white cursor-pointer focus:outline-none max-w-[140px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="">No custom role</option>
                        {customRoles.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Link href={`/users/${member.user.id}`}>
                    <div className="flex flex-wrap gap-1.5">
                      {member.user.memberships.length > 0 ? (
                        member.user.memberships.map((m) => (
                          <span
                            key={m.id}
                            className="px-2 py-0.5 text-xs font-medium rounded bg-white/8 text-white/75"
                          >
                            {m.team.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-white/40">No teams</span>
                      )}
                    </div>
                  </Link>
                </td>
                {canEdit && (
                  <td className="px-6 py-4 text-right">
                    {canRemoveMember(member) && (
                      <button
                        onClick={(e) => handleDeleteUser(e, member.user.id)}
                        className="p-2 text-white/55 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/55">No users found</p>
          </div>
        )}
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            Pending Invites ({pendingInvites.length})
          </h2>
          <div className="bg-white/8 rounded-xl border border-white/8 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/55 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/55 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white/55 uppercase tracking-wider">
                    Status
                  </th>
                  {canEdit && (
                    <th className="px-6 py-4 text-right text-xs font-semibold text-white/55 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {pendingInvites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center">
                          <Mail className="w-5 h-5 text-white/55" />
                        </div>
                        <div className="ml-4">
                          <p className="text-white font-medium">{invite.email}</p>
                          <p className="text-white/55 text-sm">
                            Invited {new Date(isNaN(Number(invite.createdAt)) ? invite.createdAt : Number(invite.createdAt)).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${roleBadge(invite.role)}`}
                      >
                        {invite.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-yellow-400">
                        <Clock className="w-3.5 h-3.5" />
                        PENDING
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleResendInvite(invite.id)}
                          className="p-2 text-white/55 hover:text-[#a78bfa] transition-colors"
                          title="Resend invite"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCancelInvite(invite.id)}
                          className="p-2 text-white/55 hover:text-red-500 transition-colors"
                          title="Cancel invite"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {isInviteModalOpen && selectedOrganizationId && (
        <InviteUserModal
          organizationId={selectedOrganizationId}
          isOwner={isOwner}
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}

function InviteUserModal({
  organizationId,
  isOwner,
  onClose,
  onSuccess,
}: {
  organizationId: string;
  isOwner: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ATHLETE");
  const [selectedTeams, setSelectedTeams] = useState<{ id: string; name: string }[]>([]);
  const [teamSearch, setTeamSearch] = useState("");
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createAnother, setCreateAnother] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const { data: teamsData } = useQuery<any>(GET_TEAMS, {
    variables: { organizationId },
  });

  const [createInvite] = useMutation<any>(CREATE_INVITE);

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
    setSubmitting(true);
    setSuccessMessage("");
    try {
      await createInvite({
        variables: {
          input: {
            email,
            organizationId,
            role,
            teamIds: selectedTeams.map((t) => t.id),
          },
        },
      });

      onSuccess();

      if (createAnother) {
        setSuccessMessage(`Invite sent to ${email}`);
        setEmail("");
        setRole("ATHLETE");
        setSelectedTeams([]);
        setTimeout(() => emailRef.current?.focus(), 100);
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        onClose();
      }
    } catch (error: any) {
      const msg = error?.graphQLErrors?.[0]?.message || error?.message || "Failed to send invite";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/8 backdrop-blur-xl rounded-xl w-full max-w-md p-6 border border-white/15 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Invite User</h2>
          <button onClick={onClose} className="text-white/55 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMessage && (
          <div className="mb-4 px-4 py-3 bg-green-600/20 border border-green-600/30 rounded-lg text-green-400 text-sm">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/55 mb-1">Email</label>
            <input
              ref={emailRef}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
              placeholder="user@example.com"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-white/55 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
            >
              <option value="ATHLETE">Athlete</option>
              <option value="COACH">Coach</option>
              <option value="MANAGER">Manager</option>
              {isOwner && <option value="ADMIN">Admin</option>}
            </select>
          </div>

          {/* Teams Picker */}
          <div>
            <label className="block text-sm font-medium text-white/55 mb-1">
              Teams <span className="text-white/40">(optional)</span>
            </label>

            {selectedTeams.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedTeams.map((team) => (
                  <span
                    key={team.id}
                    className="flex items-center gap-1 px-2.5 py-1 bg-[#a855f7]/15 text-[#a78bfa] rounded-lg text-sm"
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
                  className="w-full pl-9 pr-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] text-sm"
                  placeholder="Search teams..."
                />
              </div>

              {showTeamDropdown && filteredTeams.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white/8 border border-white/10 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {filteredTeams.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => addTeam(team)}
                      className="w-full px-4 py-2 text-left text-sm text-white/75 hover:bg-white/12 hover:text-white transition-colors"
                    >
                      {team.name}
                    </button>
                  ))}
                </div>
              )}

              {showTeamDropdown && teamSearch && filteredTeams.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white/8 border border-white/10 rounded-lg shadow-lg">
                  <p className="px-4 py-2 text-sm text-white/55">No teams found</p>
                </div>
              )}
            </div>
          </div>

          {/* Create Another Toggle */}
          <div className="flex items-center justify-between pt-2">
            <label htmlFor="create-another" className="text-sm text-white/55 cursor-pointer">
              Create another
            </label>
            <button
              type="button"
              id="create-another"
              role="switch"
              aria-checked={createAnother}
              onClick={() => setCreateAnother(!createAnother)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                createAnother ? "bg-[#6c5ce7]" : "bg-white/12"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  createAnother ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
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
              disabled={submitting}
              className="px-4 py-2 bg-[#6c5ce7] text-white rounded-lg hover:bg-[#5a4dd4] transition-colors disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
