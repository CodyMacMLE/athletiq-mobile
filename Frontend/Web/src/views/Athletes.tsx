import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { GET_ORGANIZATION_MEMBERS, UPDATE_USER, DELETE_USER, CREATE_USER, GET_USERS } from "@/lib/graphql";
import { Search, Plus, Edit2, Trash2, X, UserPlus } from "lucide-react";

type Athlete = {
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
    phone?: string;
    image?: string;
  };
};

type Team = {
  id: string;
  name: string;
  members: Athlete[];
};

export function Athletes() {
  const { selectedOrganizationId, canEdit } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all");
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const { data, loading, refetch } = useQuery<any>(GET_ORGANIZATION_MEMBERS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const [updateUser] = useMutation<any>(UPDATE_USER);
  const [deleteUser] = useMutation<any>(DELETE_USER);

  const teams: Team[] = data?.teams || [];

  // Flatten all athletes from all teams
  const allAthletes = teams.flatMap((team) =>
    team.members.map((member) => ({
      ...member,
      teamId: team.id,
      teamName: team.name,
    }))
  );

  // Filter athletes
  const filteredAthletes = allAthletes.filter((athlete) => {
    const matchesSearch =
      searchQuery === "" ||
      `${athlete.user.firstName} ${athlete.user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      athlete.user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTeam = selectedTeamFilter === "all" || athlete.teamId === selectedTeamFilter;

    return matchesSearch && matchesTeam;
  });

  const handleSaveAthlete = async (formData: any) => {
    if (!editingAthlete) return;

    try {
      await updateUser({
        variables: {
          id: editingAthlete.user.id,
          input: formData,
        },
      });
      setEditingAthlete(null);
      refetch();
    } catch (error) {
      console.error("Failed to update athlete:", error);
    }
  };

  const handleDeleteAthlete = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this athlete?")) return;

    try {
      await deleteUser({ variables: { id: userId } });
      refetch();
    } catch (error) {
      console.error("Failed to delete athlete:", error);
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
          <h1 className="text-2xl font-bold text-white">Athletes</h1>
          <p className="text-gray-400 mt-1">Manage athletes in your organization</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Invite Athlete
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search athletes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <select
          value={selectedTeamFilter}
          onChange={(e) => setSelectedTeamFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Teams</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>

      {/* Athletes Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Athlete
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Team
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Hours
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Attendance
              </th>
              {canEdit && (
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredAthletes.map((athlete: any) => (
              <tr key={athlete.id} className="hover:bg-gray-700/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium">
                      {athlete.user.firstName[0]}
                      {athlete.user.lastName[0]}
                    </div>
                    <div className="ml-4">
                      <p className="text-white font-medium">
                        {athlete.user.firstName} {athlete.user.lastName}
                      </p>
                      <p className="text-gray-400 text-sm">{athlete.user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-gray-300">{athlete.teamName}</span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      athlete.role === "ADMIN"
                        ? "bg-purple-600/20 text-purple-400"
                        : athlete.role === "COACH"
                        ? "bg-blue-600/20 text-blue-400"
                        : athlete.role === "CAPTAIN"
                        ? "bg-green-600/20 text-green-400"
                        : "bg-gray-600/20 text-gray-400"
                    }`}
                  >
                    {athlete.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-gray-300">
                    {athlete.hoursLogged?.toFixed(1) || 0} / {athlete.hoursRequired || 0}h
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-24 h-2 bg-gray-700 rounded-full mr-3">
                      <div
                        className={`h-2 rounded-full ${
                          athlete.attendancePercent >= 90
                            ? "bg-green-500"
                            : athlete.attendancePercent >= 75
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(100, athlete.attendancePercent || 0)}%` }}
                      />
                    </div>
                    <span
                      className={`font-medium ${
                        athlete.attendancePercent >= 90
                          ? "text-green-500"
                          : athlete.attendancePercent >= 75
                          ? "text-yellow-500"
                          : "text-red-500"
                      }`}
                    >
                      {Math.round(athlete.attendancePercent || 0)}%
                    </span>
                  </div>
                </td>
                {canEdit && (
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setEditingAthlete(athlete)}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAthlete(athlete.user.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAthletes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">No athletes found</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingAthlete && (
        <EditAthleteModal
          athlete={editingAthlete}
          onClose={() => setEditingAthlete(null)}
          onSave={handleSaveAthlete}
        />
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <InviteAthleteModal
          teams={teams}
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={() => {
            setIsInviteModalOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function EditAthleteModal({
  athlete,
  onClose,
  onSave,
}: {
  athlete: Athlete;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    firstName: athlete.user.firstName,
    lastName: athlete.user.lastName,
    phone: athlete.user.phone || "",
  });

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-md p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Edit Athlete</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">First Name</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Last Name</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteAthleteModal({
  teams,
  onClose,
  onSuccess,
}: {
  teams: Team[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    teamId: teams[0]?.id || "",
  });

  const [createUser] = useMutation<any>(CREATE_USER);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser({
        variables: {
          input: {
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
          },
        },
      });
      // TODO: Add team member after creating user
      onSuccess();
    } catch (error) {
      console.error("Failed to invite athlete:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-md p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Invite Athlete</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="athlete@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">First Name</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Last Name</label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Team</label>
            <select
              value={formData.teamId}
              onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
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
              Send Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
