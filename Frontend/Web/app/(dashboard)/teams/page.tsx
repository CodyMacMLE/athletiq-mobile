"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { GET_TEAMS, CREATE_TEAM, UPDATE_TEAM, DELETE_TEAM } from "@/lib/graphql";
import { Plus, Edit2, Trash2, Users, X, ChevronRight } from "lucide-react";
import Link from "next/link";

type Team = {
  id: string;
  name: string;
  season: string;
  sport?: string;
  color?: string;
  description?: string;
  memberCount: number;
  attendancePercent: number;
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

type TeamFormData = {
  name: string;
  season: string;
  sport: string;
  color: string;
  description: string;
};

export default function Teams() {
  const { selectedOrganizationId, canEdit } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const { data, loading, refetch } = useQuery(GET_TEAMS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const [createTeam] = useMutation(CREATE_TEAM);
  const [updateTeam] = useMutation(UPDATE_TEAM);
  const [deleteTeam] = useMutation(DELETE_TEAM);

  const teams: Team[] = data?.teams || [];

  const handleCreateTeam = async (data: TeamFormData) => {
    try {
      await createTeam({
        variables: {
          input: {
            name: data.name,
            season: data.season,
            sport: data.sport || undefined,
            color: data.color || undefined,
            description: data.description || undefined,
            organizationId: selectedOrganizationId,
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
          season: data.season,
          sport: data.sport || null,
          color: data.color || null,
          description: data.description || null,
        },
      });
      setEditingTeam(null);
      refetch();
    } catch (error) {
      console.error("Failed to update team:", error);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm("Are you sure you want to delete this team? All members will be removed.")) return;

    try {
      await deleteTeam({ variables: { id } });
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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
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

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <div key={team.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
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
                </div>
                {canEdit && (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setEditingTeam(team)}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(team.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                <span>{team.season}</span>
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
        ))}

        {teams.length === 0 && (
          <div className="col-span-full text-center py-12">
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
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {isCreateModalOpen && (
        <TeamModal
          title="Create Team"
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleCreateTeam}
        />
      )}

      {/* Edit Team Modal */}
      {editingTeam && (
        <TeamModal
          title="Edit Team"
          initialData={{
            name: editingTeam.name,
            season: editingTeam.season,
            sport: editingTeam.sport || "",
            color: editingTeam.color || "",
            description: editingTeam.description || "",
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
  onClose,
  onSave,
}: {
  title: string;
  initialData?: TeamFormData;
  onClose: () => void;
  onSave: (data: TeamFormData) => void;
}) {
  const [form, setForm] = useState<TeamFormData>(
    initialData || { name: "", season: "", sport: "", color: "", description: "" }
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim() && form.season.trim()) {
      onSave({ ...form, name: form.name.trim(), season: form.season.trim() });
    }
  };

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
          </div>

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
