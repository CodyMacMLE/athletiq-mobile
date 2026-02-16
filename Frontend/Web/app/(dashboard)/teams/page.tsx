"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { GET_TEAMS, GET_ORG_SEASONS, CREATE_TEAM, UPDATE_TEAM, DELETE_TEAM, RESTORE_TEAM } from "@/lib/graphql";
import { Plus, Edit2, Trash2, Users, X, ChevronRight, Archive, ArchiveRestore, Search, ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

type OrgSeason = {
  id: string;
  name: string;
  startMonth: number;
  endMonth: number;
};

type Team = {
  id: string;
  name: string;
  season?: string | null;
  sport?: string;
  color?: string;
  description?: string;
  memberCount: number;
  attendancePercent: number;
  archivedAt?: string | null;
  orgSeason?: OrgSeason | null;
  seasonYear?: number | null;
  members: {
    id: string;
    role: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      image?: string;
    };
  }[];
};

type ViewFilter = "active" | "archived" | "all";
type SortOption = "name" | "season" | "members" | "attendance";

type TeamFormData = {
  name: string;
  season: string;
  sport: string;
  color: string;
  description: string;
  orgSeasonId: string;
  seasonYear: number;
};

function getSeasonDateRange(startMonth: number, endMonth: number, seasonYear: number): { start: Date; end: Date } {
  if (startMonth <= endMonth) {
    const start = new Date(Date.UTC(seasonYear, startMonth - 1, 1));
    const end = new Date(Date.UTC(seasonYear, endMonth, 0, 23, 59, 59));
    return { start, end };
  } else {
    const start = new Date(Date.UTC(seasonYear, startMonth - 1, 1));
    const end = new Date(Date.UTC(seasonYear + 1, endMonth, 0, 23, 59, 59));
    return { start, end };
  }
}

function getSeasonStatus(team: Team): "current" | "future" | "past" | "legacy" {
  if (!team.orgSeason || !team.seasonYear) return "legacy";
  const now = new Date();
  const { start, end } = getSeasonDateRange(team.orgSeason.startMonth, team.orgSeason.endMonth, team.seasonYear);
  if (now < start) return "future";
  if (now > end) return "past";
  return "current";
}

function getSeasonLabel(team: Team): string {
  if (team.orgSeason && team.seasonYear) {
    return `${team.orgSeason.name} ${team.seasonYear}`;
  }
  return team.season || "No Season";
}

export default function Teams() {
  const { selectedOrganizationId, canEdit } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("active");
  const [sortBy, setSortBy] = useState<SortOption>("season");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const { data, loading, refetch } = useQuery<any>(GET_TEAMS, {
    variables: { organizationId: selectedOrganizationId, includeArchived: true },
    skip: !selectedOrganizationId,
  });

  const { data: seasonsData } = useQuery<any>(GET_ORG_SEASONS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const [createTeam] = useMutation<any>(CREATE_TEAM);
  const [updateTeam] = useMutation<any>(UPDATE_TEAM);
  const [deleteTeam] = useMutation<any>(DELETE_TEAM);
  const [restoreTeam] = useMutation<any>(RESTORE_TEAM);

  const orgSeasons: OrgSeason[] = seasonsData?.orgSeasons || [];
  const allTeams: Team[] = data?.teams || [];
  const activeCount = allTeams.filter((t) => !t.archivedAt).length;
  const archivedCount = allTeams.filter((t) => t.archivedAt).length;

  const teams = allTeams
    .filter((t) => {
      if (viewFilter === "active" && t.archivedAt) return false;
      if (viewFilter === "archived" && !t.archivedAt) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          (t.season && t.season.toLowerCase().includes(q)) ||
          (t.sport && t.sport.toLowerCase().includes(q)) ||
          (t.orgSeason && t.orgSeason.name.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name": return a.name.localeCompare(b.name);
        case "season": return getSeasonLabel(b).localeCompare(getSeasonLabel(a));
        case "members": return b.memberCount - a.memberCount;
        case "attendance": return (b.attendancePercent || 0) - (a.attendancePercent || 0);
        default: return 0;
      }
    });

  // Group teams by season when sorted by season
  const groupedTeams = useMemo(() => {
    if (sortBy !== "season") return null;

    const groups: { label: string; status: "current" | "future" | "past" | "legacy"; teams: Team[] }[] = [];
    const groupMap = new Map<string, { label: string; status: "current" | "future" | "past" | "legacy"; teams: Team[] }>();

    for (const team of teams) {
      const label = getSeasonLabel(team);
      const status = getSeasonStatus(team);
      if (!groupMap.has(label)) {
        const group = { label, status, teams: [] as Team[] };
        groupMap.set(label, group);
        groups.push(group);
      }
      groupMap.get(label)!.teams.push(team);
    }

    // Sort: current first, then future, then past, then legacy
    const statusOrder = { current: 0, future: 1, past: 2, legacy: 3 };
    groups.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    return groups;
  }, [teams, sortBy]);

  // Auto-collapse past seasons on initial render
  const isPastCollapsed = (label: string, status: string) => {
    if (collapsedGroups.has(label)) return true;
    // Past seasons are collapsed by default unless user explicitly toggled them
    if (status === "past" && !collapsedGroups.has(`__expanded__${label}`)) return true;
    return false;
  };

  const toggleGroup = (label: string, status: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (status === "past") {
        // For past groups, toggle the expanded marker
        if (next.has(`__expanded__${label}`)) {
          next.delete(`__expanded__${label}`);
        } else {
          next.add(`__expanded__${label}`);
        }
      } else {
        if (next.has(label)) {
          next.delete(label);
        } else {
          next.add(label);
        }
      }
      return next;
    });
  };

  const handleCreateTeam = async (data: TeamFormData) => {
    try {
      await createTeam({
        variables: {
          input: {
            name: data.name,
            season: data.season || undefined,
            sport: data.sport || undefined,
            color: data.color || undefined,
            description: data.description || undefined,
            organizationId: selectedOrganizationId,
            orgSeasonId: data.orgSeasonId || undefined,
            seasonYear: data.seasonYear || undefined,
          },
        },
      });
      setIsCreateModalOpen(false);
      refetch();
    } catch (error) {
      console.error("Failed to create team:", error);
    }
  };

  const handleUpdateTeam = async (id: string, data: TeamFormData) => {
    try {
      await updateTeam({
        variables: {
          id,
          name: data.name,
          season: data.season || null,
          sport: data.sport || null,
          color: data.color || null,
          description: data.description || null,
          orgSeasonId: data.orgSeasonId || null,
          seasonYear: data.seasonYear || null,
        },
      });
      setEditingTeam(null);
      refetch();
    } catch (error) {
      console.error("Failed to update team:", error);
    }
  };

  const handleRestoreTeam = async (id: string) => {
    try {
      await restoreTeam({ variables: { id } });
      refetch();
    } catch (error) {
      console.error("Failed to restore team:", error);
    }
  };

  const handleDeleteTeam = async (hardDelete: boolean) => {
    if (!deletingTeam) return;
    try {
      await deleteTeam({ variables: { id: deletingTeam.id, hardDelete } });
      setDeletingTeam(null);
      refetch();
    } catch (error) {
      console.error("Failed to delete team:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const renderTeamCard = (team: Team) => (
    <div key={team.id} className={`bg-gray-800 rounded-xl border overflow-hidden ${team.archivedAt ? "border-gray-700/50 opacity-70" : "border-gray-700"}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {team.color && (
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: team.color }}
              />
            )}
            <h3 className="text-lg font-semibold text-white">{team.name}</h3>
            {team.archivedAt && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-600/20 text-yellow-400">
                <Archive className="w-3 h-3" />
                Archived
              </span>
            )}
          </div>
          {canEdit && !team.archivedAt && (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setEditingTeam(team)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeletingTeam(team)}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
          {canEdit && team.archivedAt && (
            <button
              onClick={() => handleRestoreTeam(team.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-sm font-medium rounded-lg transition-colors"
            >
              <ArchiveRestore className="w-4 h-4" />
              Restore
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
          <span>{getSeasonLabel(team)}</span>
          {team.sport && (
            <>
              <span className="text-gray-600">&middot;</span>
              <span>{team.sport}</span>
            </>
          )}
        </div>

        {team.description && (
          <p className="text-sm text-gray-500 mb-4 line-clamp-2">{team.description}</p>
        )}

        <div className="flex items-center space-x-6">
          <div className="flex items-center text-gray-400">
            <Users className="w-4 h-4 mr-2" />
            <span>{team.memberCount} members</span>
          </div>
          {!team.archivedAt && (
            <div
              className={`font-medium ${
                team.attendancePercent >= 90
                  ? "text-green-500"
                  : team.attendancePercent >= 75
                  ? "text-yellow-500"
                  : "text-red-500"
              }`}
            >
              {Math.round(team.attendancePercent || 0)}% attendance
            </div>
          )}
        </div>
      </div>

      <Link
        href={`/teams/${team.id}`}
        className="flex items-center justify-between px-6 py-3 bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
      >
        <span className="text-sm">View Team</span>
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Teams</h1>
          <p className="text-gray-400 mt-1">Manage teams in your organization</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Team
          </button>
        )}
      </div>

      {/* Toolbar: Filter tabs, Search, Sort */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        {/* View filter tabs */}
        <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
          {([
            { key: "active" as ViewFilter, label: "Active", count: activeCount },
            { key: "archived" as ViewFilter, label: "Archived", count: archivedCount },
            { key: "all" as ViewFilter, label: "All", count: allTeams.length },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewFilter === tab.key
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-0 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teams..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Sort */}
        <div className="relative">
          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="pl-10 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="name">Name</option>
            <option value="season">Season</option>
            <option value="members">Members</option>
            <option value="attendance">Attendance</option>
          </select>
        </div>
      </div>

      {/* Teams Grid - grouped or flat */}
      {sortBy === "season" && groupedTeams && groupedTeams.length > 0 ? (
        <div className="space-y-6">
          {groupedTeams.map((group) => {
            const collapsed = isPastCollapsed(group.label, group.status);
            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label, group.status)}
                  className="flex items-center gap-2 mb-3 group"
                >
                  {collapsed ? (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                  <h2 className="text-lg font-semibold text-white group-hover:text-purple-400 transition-colors">
                    {group.label}
                  </h2>
                  {group.status === "current" && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-600/20 text-green-400">
                      Current
                    </span>
                  )}
                  {group.status === "future" && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600/20 text-blue-400">
                      Upcoming
                    </span>
                  )}
                  {group.status === "past" && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-600/20 text-gray-400">
                      Past
                    </span>
                  )}
                  <span className="text-sm text-gray-500">({group.teams.length})</span>
                </button>
                {!collapsed && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {group.teams.map(renderTeamCard)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map(renderTeamCard)}
        </div>
      )}

      {teams.length === 0 && (
        <div className="text-center py-12">
          {searchQuery ? (
            <>
              <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No teams match &quot;{searchQuery}&quot;</p>
            </>
          ) : viewFilter === "archived" ? (
            <>
              <Archive className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No archived teams</p>
            </>
          ) : (
            <>
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No teams yet</p>
              {canEdit && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-4 text-purple-500 hover:text-purple-400"
                >
                  Create your first team
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Archive / Delete Confirmation Modal */}
      {deletingTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-sm p-6 border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-2">Remove Team</h3>
            <p className="text-gray-400 text-sm mb-6">
              What would you like to do with <span className="text-white font-medium">{deletingTeam.name}</span>?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleDeleteTeam(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                <Archive className="w-4 h-4" />
                Archive Team
              </button>
              <p className="text-xs text-gray-500 text-center -mt-1">
                Members are removed but attendance records are preserved for historical stats.
              </p>
              <button
                onClick={() => {
                  if (confirm("This will permanently delete the team and remove its association from all events. This cannot be undone. Continue?")) {
                    handleDeleteTeam(true);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Permanently Delete
              </button>
              <p className="text-xs text-gray-500 text-center -mt-1">
                Removes the team entirely. Events keep their check-ins but lose the team association.
              </p>
              <button
                onClick={() => setDeletingTeam(null)}
                className="w-full px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {isCreateModalOpen && (
        <TeamModal
          title="Create Team"
          orgSeasons={orgSeasons}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleCreateTeam}
        />
      )}

      {/* Edit Team Modal */}
      {editingTeam && (
        <TeamModal
          title="Edit Team"
          orgSeasons={orgSeasons}
          initialData={{
            name: editingTeam.name,
            season: editingTeam.season || "",
            sport: editingTeam.sport || "",
            color: editingTeam.color || "",
            description: editingTeam.description || "",
            orgSeasonId: editingTeam.orgSeason?.id || "",
            seasonYear: editingTeam.seasonYear || new Date().getFullYear(),
          }}
          onClose={() => setEditingTeam(null)}
          onSave={(data) => handleUpdateTeam(editingTeam.id, data)}
        />
      )}
    </div>
  );
}

const COLOR_PRESETS = [
  "#7C3AED", "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#EC4899", "#06B6D4", "#F97316", "#8B5CF6", "#14B8A6",
];

function TeamModal({
  title,
  initialData,
  orgSeasons,
  onClose,
  onSave,
}: {
  title: string;
  initialData?: TeamFormData;
  orgSeasons: OrgSeason[];
  onClose: () => void;
  onSave: (data: TeamFormData) => void;
}) {
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState<TeamFormData>(
    initialData || { name: "", season: "", sport: "", color: "", description: "", orgSeasonId: "", seasonYear: currentYear }
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim() && (form.orgSeasonId || form.season.trim())) {
      onSave({ ...form, name: form.name.trim(), season: form.season.trim(), seasonYear: Number(form.seasonYear) });
    }
  };

  const yearOptions = [];
  for (let y = currentYear - 2; y <= currentYear + 5; y++) {
    yearOptions.push(y);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-md p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Team Name *</label>
            <input
              type="text"
              name="name"
              required
              value={form.name}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g., Varsity, Junior Elite"
              autoFocus
            />
          </div>

          {orgSeasons.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Season *</label>
                <select
                  name="orgSeasonId"
                  value={form.orgSeasonId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select season...</option>
                  {orgSeasons.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Year *</label>
                <select
                  name="seasonYear"
                  value={form.seasonYear}
                  onChange={(e) => setForm(prev => ({ ...prev, seasonYear: Number(e.target.value) }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Season *</label>
              <input
                type="text"
                name="season"
                required
                value={form.season}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., Spring 2026, Fall 2025"
              />
              <p className="text-xs text-gray-500 mt-1">
                <Link href="/settings" className="text-purple-400 hover:text-purple-300">Define seasons in Settings</Link> for structured season management.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Sport</label>
            <input
              type="text"
              name="sport"
              value={form.sport}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g., Basketball, Track & Field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Team Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, color: c }))}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    form.color === c ? "border-white scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="text"
                name="color"
                value={form.color}
                onChange={handleChange}
                className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="#hex"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={2}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              placeholder="Optional notes about this team"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
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
              {initialData ? "Save Changes" : "Create Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
