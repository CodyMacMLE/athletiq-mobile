"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { GET_ORG_SEASONS, CREATE_ORG_SEASON, UPDATE_ORG_SEASON, DELETE_ORG_SEASON } from "@/lib/graphql";
import { HelpCircle, Calendar, Plus, Edit2, Trash2, X, Check, Shield } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

type OrgSeason = {
  id: string;
  name: string;
  startMonth: number;
  endMonth: number;
  organizationId: string;
};

export default function SettingsPage() {
  const { selectedOrganizationId, canEdit, canManageOrg } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSeason, setEditingSeason] = useState<OrgSeason | null>(null);
  const [formName, setFormName] = useState("");
  const [formStartMonth, setFormStartMonth] = useState(1);
  const [formEndMonth, setFormEndMonth] = useState(12);
  const [error, setError] = useState("");

  const { data, refetch } = useQuery<any>(GET_ORG_SEASONS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const [createOrgSeason] = useMutation<any>(CREATE_ORG_SEASON);
  const [updateOrgSeason] = useMutation<any>(UPDATE_ORG_SEASON);
  const [deleteOrgSeason] = useMutation<any>(DELETE_ORG_SEASON);

  const seasons: OrgSeason[] = data?.orgSeasons || [];

  const resetForm = () => {
    setFormName("");
    setFormStartMonth(1);
    setFormEndMonth(12);
    setShowAddForm(false);
    setEditingSeason(null);
    setError("");
  };

  const handleStartEdit = (season: OrgSeason) => {
    setEditingSeason(season);
    setFormName(season.name);
    setFormStartMonth(season.startMonth);
    setFormEndMonth(season.endMonth);
    setShowAddForm(false);
    setError("");
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setError("");
    try {
      await createOrgSeason({
        variables: {
          input: {
            name: formName.trim(),
            startMonth: formStartMonth,
            endMonth: formEndMonth,
            organizationId: selectedOrganizationId,
          },
        },
      });
      resetForm();
      refetch();
    } catch (err: any) {
      setError(err.message || "Failed to create season");
    }
  };

  const handleUpdate = async () => {
    if (!editingSeason || !formName.trim()) return;
    setError("");
    try {
      await updateOrgSeason({
        variables: {
          id: editingSeason.id,
          name: formName.trim(),
          startMonth: formStartMonth,
          endMonth: formEndMonth,
        },
      });
      resetForm();
      refetch();
    } catch (err: any) {
      setError(err.message || "Failed to update season");
    }
  };

  const handleDelete = async (season: OrgSeason) => {
    if (!confirm(`Delete "${season.name}"? This cannot be undone.`)) return;
    setError("");
    try {
      await deleteOrgSeason({ variables: { id: season.id } });
      refetch();
    } catch (err: any) {
      setError(err.message || "Failed to delete season");
    }
  };

  const SeasonForm = ({ isEditing }: { isEditing: boolean }) => (
    <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Season Name</label>
        <input
          type="text"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="e.g., Hockey Season, Summer Training"
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Start Month</label>
          <select
            value={formStartMonth}
            onChange={(e) => setFormStartMonth(Number(e.target.value))}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">End Month</label>
          <select
            value={formEndMonth}
            onChange={(e) => setFormEndMonth(Number(e.target.value))}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={resetForm}
          className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={isEditing ? handleUpdate : handleCreate}
          disabled={!formName.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
          {isEditing ? "Save" : "Add Season"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      {/* Seasons */}
      {canManageOrg && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">Seasons</h2>
            </div>
            {!showAddForm && !editingSeason && (
              <button
                onClick={() => { setShowAddForm(true); setEditingSeason(null); setError(""); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Season
              </button>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <p className="text-sm text-gray-400 mb-4">
              Define reusable season templates for your organization. Teams can then be assigned to a season and year.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-600/10 border border-red-600/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {seasons.length > 0 && (
              <div className="space-y-2 mb-4">
                {seasons.map((season) => (
                  <div key={season.id}>
                    {editingSeason?.id === season.id ? (
                      <SeasonForm isEditing />
                    ) : (
                      <div className="flex items-center justify-between px-3 py-2.5 bg-gray-700/50 rounded-lg">
                        <div>
                          <span className="text-white font-medium">{season.name}</span>
                          <span className="text-gray-400 text-sm ml-3">
                            {SHORT_MONTHS[season.startMonth - 1]} &rarr; {SHORT_MONTHS[season.endMonth - 1]}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(season)}
                            className="p-1.5 text-gray-400 hover:text-white transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(season)}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {seasons.length === 0 && !showAddForm && (
              <p className="text-gray-500 text-sm text-center py-4">
                No seasons defined yet. Add one to get started.
              </p>
            )}

            {showAddForm && <SeasonForm isEditing={false} />}
          </div>
        </section>
      )}

      {/* Roles */}
      {canEdit && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Roles</h2>
          </div>
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <p className="text-sm text-gray-400 mb-4">
              Each organization role has different permissions. Here&apos;s what each role can do:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-600/20 text-yellow-400">OWNER</span>
                </div>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>Full organization control</li>
                  <li>Manage settings &amp; seasons</li>
                  <li>Manage teams &amp; users</li>
                  <li>Transfer ownership</li>
                </ul>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-600/20 text-purple-400">ADMIN</span>
                </div>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>Manage settings &amp; seasons</li>
                  <li>Manage teams &amp; users</li>
                  <li>Attendance operations</li>
                  <li>Cannot transfer ownership</li>
                </ul>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-600/20 text-blue-400">MANAGER</span>
                </div>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>Manage teams &amp; users</li>
                  <li>Attendance operations</li>
                  <li>No access to org settings</li>
                </ul>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-600/20 text-green-400">COACH</span>
                </div>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>Attendance operations (own teams)</li>
                  <li>View team members</li>
                  <li>No team/user management</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Help & Support */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Help &amp; Support</h2>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-sm text-gray-300 mb-3">
            Need help or have feedback? Reach out to us.
          </p>
          <a
            href="mailto:support@athletiq.app"
            className="inline-block text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            support@athletiq.app
          </a>
        </div>
      </section>
    </div>
  );
}
