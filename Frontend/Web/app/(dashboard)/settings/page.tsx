"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { GET_ORG_SEASONS, CREATE_ORG_SEASON, UPDATE_ORG_SEASON, DELETE_ORG_SEASON, GET_ORGANIZATION, UPDATE_ORGANIZATION_SETTINGS } from "@/lib/graphql";
import { HelpCircle, Calendar, Plus, Edit2, Trash2, X, Check, Shield, Heart } from "lucide-react";

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
  const [healthVisibility, setHealthVisibility] = useState<string>("ADMIN_ONLY");
  const [healthSaving, setHealthSaving] = useState(false);
  const [healthSaved, setHealthSaved] = useState(false);

  const { data, refetch } = useQuery<any>(GET_ORG_SEASONS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const { data: orgData } = useQuery<any>(GET_ORGANIZATION, {
    variables: { id: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  useEffect(() => {
    if (orgData?.organization?.medicalInfoVisibility) {
      setHealthVisibility(orgData.organization.medicalInfoVisibility);
    }
  }, [orgData]);

  const [createOrgSeason] = useMutation<any>(CREATE_ORG_SEASON);
  const [updateOrgSeason] = useMutation<any>(UPDATE_ORG_SEASON);
  const [deleteOrgSeason] = useMutation<any>(DELETE_ORG_SEASON);
  const [updateOrganizationSettings] = useMutation<any>(UPDATE_ORGANIZATION_SETTINGS);

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

  const handleSaveHealthVisibility = async () => {
    if (!selectedOrganizationId) return;
    setHealthSaving(true);
    try {
      await updateOrganizationSettings({
        variables: { id: selectedOrganizationId, medicalInfoVisibility: healthVisibility },
      });
      setHealthSaved(true);
      setTimeout(() => setHealthSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save health settings:", err);
    } finally {
      setHealthSaving(false);
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
    <div className="bg-white/5 rounded-lg p-4 space-y-3">
      <div>
        <label className="block text-sm font-medium text-white/55 mb-1">Season Name</label>
        <input
          type="text"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="e.g., Hockey Season, Summer Training"
          className="w-full px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-white/55 mb-1">Start Month</label>
          <select
            value={formStartMonth}
            onChange={(e) => setFormStartMonth(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-white/55 mb-1">End Month</label>
          <select
            value={formEndMonth}
            onChange={(e) => setFormEndMonth(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
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
          className="px-3 py-1.5 text-sm text-white/55 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={isEditing ? handleUpdate : handleCreate}
          disabled={!formName.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6c5ce7] text-white rounded-lg text-sm hover:bg-[#5a4dd4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              <Calendar className="w-5 h-5 text-[#a78bfa]" />
              <h2 className="text-lg font-semibold text-white">Seasons</h2>
            </div>
            {!showAddForm && !editingSeason && (
              <button
                onClick={() => { setShowAddForm(true); setEditingSeason(null); setError(""); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6c5ce7] text-white rounded-lg text-sm hover:bg-[#5a4dd4] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Season
              </button>
            )}
          </div>

          <div className="bg-white/8 rounded-lg border border-white/8 p-4">
            <p className="text-sm text-white/55 mb-4">
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
                      <div className="flex items-center justify-between px-3 py-2.5 bg-white/5 rounded-lg">
                        <div>
                          <span className="text-white font-medium">{season.name}</span>
                          <span className="text-white/55 text-sm ml-3">
                            {SHORT_MONTHS[season.startMonth - 1]} &rarr; {SHORT_MONTHS[season.endMonth - 1]}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(season)}
                            className="p-1.5 text-white/55 hover:text-white transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(season)}
                            className="p-1.5 text-white/55 hover:text-red-500 transition-colors"
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
              <p className="text-white/40 text-sm text-center py-4">
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
            <Shield className="w-5 h-5 text-[#a78bfa]" />
            <h2 className="text-lg font-semibold text-white">Roles</h2>
          </div>
          <div className="bg-white/8 rounded-lg border border-white/8 p-4">
            <p className="text-sm text-white/55 mb-4">
              Each organization role has different permissions. Here&apos;s what each role can do:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-600/20 text-yellow-400">OWNER</span>
                </div>
                <ul className="text-xs text-white/55 space-y-1">
                  <li>Full organization control</li>
                  <li>Manage settings &amp; seasons</li>
                  <li>Manage teams &amp; users</li>
                  <li>Transfer ownership</li>
                </ul>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-[#a855f7]/15 text-[#a78bfa]">ADMIN</span>
                </div>
                <ul className="text-xs text-white/55 space-y-1">
                  <li>Manage settings &amp; seasons</li>
                  <li>Manage teams &amp; users</li>
                  <li>Attendance operations</li>
                  <li>Cannot transfer ownership</li>
                </ul>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-600/20 text-blue-400">MANAGER</span>
                </div>
                <ul className="text-xs text-white/55 space-y-1">
                  <li>Manage teams &amp; users</li>
                  <li>Attendance operations</li>
                  <li>No access to org settings</li>
                </ul>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-600/20 text-green-400">COACH</span>
                </div>
                <ul className="text-xs text-white/55 space-y-1">
                  <li>Attendance operations (own teams)</li>
                  <li>View team members</li>
                  <li>No team/user management</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Health & Safety */}
      {canManageOrg && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-5 h-5 text-[#a78bfa]" />
            <h2 className="text-lg font-semibold text-white">Health &amp; Safety</h2>
          </div>
          <div className="bg-white/8 rounded-lg border border-white/8 p-4">
            <p className="text-sm text-white/55 mb-4">
              Control who on your staff can view athlete health information, emergency contacts, and medical details.
            </p>
            <div className="space-y-3 mb-4">
              {[
                { value: "ADMIN_ONLY", label: "Admins Only", description: "Only Owners and Admins can view health information" },
                { value: "COACHES_AND_ADMINS", label: "Coaches & Admins", description: "Owners, Admins, and Coaches can view health information" },
                { value: "ALL_STAFF", label: "All Staff", description: "All staff roles (Owners, Admins, Managers, Coaches) can view health information" },
              ].map((option) => (
                <label key={option.value} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="healthVisibility"
                    value={option.value}
                    checked={healthVisibility === option.value}
                    onChange={(e) => setHealthVisibility(e.target.value)}
                    className="mt-0.5 accent-[#6c5ce7]"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{option.label}</p>
                    <p className="text-xs text-white/40">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
            <button
              onClick={handleSaveHealthVisibility}
              disabled={healthSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6c5ce7] text-white rounded-lg text-sm hover:bg-[#5a4dd4] transition-colors disabled:opacity-50"
            >
              {healthSaved ? <><Check className="w-4 h-4" /> Saved</> : healthSaving ? "Saving..." : <><Check className="w-4 h-4" /> Save</>}
            </button>
          </div>
        </section>
      )}

      {/* Help & Support */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-[#a78bfa]" />
          <h2 className="text-lg font-semibold text-white">Help &amp; Support</h2>
        </div>
        <div className="bg-white/8 rounded-lg border border-white/8 p-4">
          <p className="text-sm text-white/75 mb-3">
            Need help or have feedback? Reach out to us.
          </p>
          <a
            href="mailto:admin@athletiq.fitness"
            className="inline-block text-sm text-[#a78bfa] hover:text-[#c4b5fd] transition-colors"
          >
            admin@athletiq.fitness
          </a>
        </div>
      </section>
    </div>
  );
}
