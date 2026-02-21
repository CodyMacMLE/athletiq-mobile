import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { GET_TEAMS, CREATE_TEAM, UPDATE_TEAM, DELETE_TEAM } from "@/lib/graphql";
import { Plus, Edit2, Trash2, Users, X, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

type Team = {
  id: string;
  name: string;
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

export function Teams() {
  const { selectedOrganizationId, canEdit } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const { data, loading, refetch } = useQuery<any>(GET_TEAMS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const [createTeam] = useMutation<any>(CREATE_TEAM);
  const [updateTeam] = useMutation<any>(UPDATE_TEAM);
  const [deleteTeam] = useMutation<any>(DELETE_TEAM);

  const teams: Team[] = data?.teams || [];

  const handleCreateTeam = async (name: string) => {
    try {
      await createTeam({
        variables: {
          input: {
            name,
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

  const handleUpdateTeam = async (id: string, name: string) => {
    try {
      await updateTeam({
        variables: { id, name },
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{team.name}</h3>
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

              <div className="flex items-center space-x-6 mb-4">
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

              {/* Team Members Preview */}
              <div className="flex items-center">
                <div className="flex -space-x-2">
                  {team.members.slice(0, 5).map((member) => (
                    <div
                      key={member.id}
                      className="w-8 h-8 rounded-full bg-purple-600 border-2 border-gray-800 flex items-center justify-center text-white text-xs font-medium"
                      title={`${member.user.firstName} ${member.user.lastName}`}
                    >
                      {member.user.firstName[0]}
                      {member.user.lastName[0]}
                    </div>
                  ))}
                  {team.members.length > 5 && (
                    <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-800 flex items-center justify-center text-white text-xs">
                      +{team.members.length - 5}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Link
              to={`/teams/${team.id}`}
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
          initialName={editingTeam.name}
          onClose={() => setEditingTeam(null)}
          onSave={(name) => handleUpdateTeam(editingTeam.id, name)}
        />
      )}
    </div>
  );
}

function TeamModal({
  title,
  initialName = "",
  onClose,
  onSave,
}: {
  title: string;
  initialName?: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-md p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Team Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g., Varsity, Junior Elite"
              autoFocus
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
              {initialName ? "Save Changes" : "Create Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
