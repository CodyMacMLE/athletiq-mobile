"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { GET_ORG_SEASONS, CREATE_ORG_SEASON, UPDATE_ORG_SEASON, DELETE_ORG_SEASON, GET_ORGANIZATION, UPDATE_ORGANIZATION_SETTINGS, GET_ORGANIZATION_VENUES, CREATE_VENUE, UPDATE_VENUE, DELETE_VENUE } from "@/lib/graphql";
import { HelpCircle, Calendar, Plus, Edit2, Trash2, X, Check, Shield, Heart, Building2 } from "lucide-react";

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

type Venue = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  notes?: string | null;
};

export default function SettingsPage() {
  const { selectedOrganizationId, canEdit, canManageOrg } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSeason, setEditingSeason] = useState<OrgSeason | null>(null);
  const [formName, setFormName] = useState("");
  const [formStartMonth, setFormStartMonth] = useState(1);
  const [formEndMonth, setFormEndMonth] = useState(12);
  const [error, setError] = useState("");
  const [adminHealthAccess, setAdminHealthAccess] = useState<string>("ADMINS_ONLY");
  const [coachHealthAccess, setCoachHealthAccess] = useState<string>("TEAM_ONLY");
  const [healthSaving, setHealthSaving] = useState(false);
  const [healthSaved, setHealthSaved] = useState(false);

  // Venues
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [venueForm, setVenueForm] = useState({ name: "", address: "", city: "", state: "", country: "", notes: "" });
  const [venueError, setVenueError] = useState("");

  const { data, refetch } = useQuery<any>(GET_ORG_SEASONS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const { data: orgData } = useQuery<any>(GET_ORGANIZATION, {
    variables: { id: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  useEffect(() => {
    if (orgData?.organization) {
      if (orgData.organization.adminHealthAccess) setAdminHealthAccess(orgData.organization.adminHealthAccess);
      if (orgData.organization.coachHealthAccess) setCoachHealthAccess(orgData.organization.coachHealthAccess);
    }
  }, [orgData]);

  const [createOrgSeason] = useMutation<any>(CREATE_ORG_SEASON);
  const [updateOrgSeason] = useMutation<any>(UPDATE_ORG_SEASON);
  const [deleteOrgSeason] = useMutation<any>(DELETE_ORG_SEASON);
  const [updateOrganizationSettings] = useMutation<any>(UPDATE_ORGANIZATION_SETTINGS);

  const { data: venuesData, refetch: refetchVenues } = useQuery<any>(GET_ORGANIZATION_VENUES, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });
  const [createVenue] = useMutation<any>(CREATE_VENUE);
  const [updateVenue] = useMutation<any>(UPDATE_VENUE);
  const [deleteVenue] = useMutation<any>(DELETE_VENUE);

  const venues: Venue[] = venuesData?.organizationVenues || [];

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
        variables: { id: selectedOrganizationId, adminHealthAccess, coachHealthAccess },
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

  const resetVenueForm = () => {
    setShowVenueForm(false);
    setEditingVenue(null);
    setVenueForm({ name: "", address: "", city: "", state: "", country: "", notes: "" });
    setVenueError("");
  };

  const handleStartEditVenue = (venue: Venue) => {
    setEditingVenue(venue);
    setVenueForm({
      name: venue.name,
      address: venue.address || "",
      city: venue.city || "",
      state: venue.state || "",
      country: venue.country || "",
      notes: venue.notes || "",
    });
    setShowVenueForm(false);
    setVenueError("");
  };

  const handleCreateVenue = async () => {
    if (!venueForm.name.trim()) return;
    setVenueError("");
    try {
      await createVenue({
        variables: {
          input: {
            name: venueForm.name.trim(),
            address: venueForm.address.trim() || undefined,
            city: venueForm.city.trim() || undefined,
            state: venueForm.state.trim() || undefined,
            country: venueForm.country.trim() || undefined,
            notes: venueForm.notes.trim() || undefined,
            organizationId: selectedOrganizationId,
          },
        },
      });
      resetVenueForm();
      refetchVenues();
    } catch (err: any) {
      setVenueError(err.message || "Failed to create venue");
    }
  };

  const handleUpdateVenue = async () => {
    if (!editingVenue || !venueForm.name.trim()) return;
    setVenueError("");
    try {
      await updateVenue({
        variables: {
          id: editingVenue.id,
          input: {
            name: venueForm.name.trim(),
            address: venueForm.address.trim() || undefined,
            city: venueForm.city.trim() || undefined,
            state: venueForm.state.trim() || undefined,
            country: venueForm.country.trim() || undefined,
            notes: venueForm.notes.trim() || undefined,
          },
        },
      });
      resetVenueForm();
      refetchVenues();
    } catch (err: any) {
      setVenueError(err.message || "Failed to update venue");
    }
  };

  const handleDeleteVenue = async (venue: Venue) => {
    if (!confirm(`Delete "${venue.name}"? This cannot be undone.`)) return;
    setVenueError("");
    try {
      await deleteVenue({ variables: { id: venue.id } });
      refetchVenues();
    } catch (err: any) {
      setVenueError(err.message || "Failed to delete venue");
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

  const VenueForm = ({ isEditing }: { isEditing: boolean }) => (
    <div className="bg-white/5 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-white/55 mb-1">Venue Name *</label>
          <input
            type="text"
            value={venueForm.name}
            onChange={(e) => setVenueForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Main Gym"
            className="w-full px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/55 mb-1">Address</label>
          <input
            type="text"
            value={venueForm.address}
            onChange={(e) => setVenueForm(f => ({ ...f, address: e.target.value }))}
            placeholder="123 Main St."
            className="w-full px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/55 mb-1">City</label>
          <input
            type="text"
            value={venueForm.city}
            onChange={(e) => setVenueForm(f => ({ ...f, city: e.target.value }))}
            placeholder="Toronto"
            className="w-full px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/55 mb-1">State / Province</label>
          <input
            type="text"
            value={venueForm.state}
            onChange={(e) => setVenueForm(f => ({ ...f, state: e.target.value }))}
            placeholder="ON"
            className="w-full px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/55 mb-1">Country</label>
          <input
            type="text"
            value={venueForm.country}
            onChange={(e) => setVenueForm(f => ({ ...f, country: e.target.value }))}
            placeholder="Canada"
            className="w-full px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-white/55 mb-1">Notes</label>
          <input
            type="text"
            value={venueForm.notes}
            onChange={(e) => setVenueForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Parking info, entrance details, etc."
            className="w-full px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={resetVenueForm}
          className="px-3 py-1.5 text-sm text-white/55 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={isEditing ? handleUpdateVenue : handleCreateVenue}
          disabled={!venueForm.name.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6c5ce7] text-white rounded-lg text-sm hover:bg-[#5a4dd4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
          {isEditing ? "Save" : "Add Venue"}
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
          <div className="bg-white/8 rounded-lg border border-white/8 p-4 space-y-6">
            <p className="text-sm text-white/55">
              Control who can view athlete health information, emergency contacts, and medical details.
            </p>

            {/* Admin access */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">Admins</p>
              <div className="space-y-3">
                {[
                  { value: "ADMINS_ONLY", label: "Admins Only", description: "Only Owners and Admins can view health information" },
                  { value: "MANAGERS_AND_ADMINS", label: "Managers & Admins", description: "Owners, Admins, and Managers can view health information" },
                ].map((option) => (
                  <label key={option.value} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="adminHealthAccess"
                      value={option.value}
                      checked={adminHealthAccess === option.value}
                      onChange={(e) => setAdminHealthAccess(e.target.value)}
                      className="mt-0.5 accent-[#6c5ce7]"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">{option.label}</p>
                      <p className="text-xs text-white/40">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-white/8" />

            {/* Coach access */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">Coaches</p>
              <div className="space-y-3">
                {[
                  { value: "ORG_WIDE", label: "Org Wide", description: "Coaches can view health information for any athlete in the organization" },
                  { value: "TEAM_ONLY", label: "Team Only", description: "Coaches can only view health information for athletes on their own teams" },
                ].map((option) => (
                  <label key={option.value} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="coachHealthAccess"
                      value={option.value}
                      checked={coachHealthAccess === option.value}
                      onChange={(e) => setCoachHealthAccess(e.target.value)}
                      className="mt-0.5 accent-[#6c5ce7]"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">{option.label}</p>
                      <p className="text-xs text-white/40">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
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

      {/* Venues */}
      {canManageOrg && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#a78bfa]" />
              <h2 className="text-lg font-semibold text-white">Venues</h2>
            </div>
            {!showVenueForm && !editingVenue && (
              <button
                onClick={() => { setShowVenueForm(true); setEditingVenue(null); setVenueError(""); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6c5ce7] text-white rounded-lg text-sm hover:bg-[#5a4dd4] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Venue
              </button>
            )}
          </div>

          <div className="bg-white/8 rounded-lg border border-white/8 p-4">
            <p className="text-sm text-white/55 mb-4">
              Manage your organization&apos;s venues and facilities. Venues can be selected when creating events.
            </p>

            {venueError && (
              <div className="mb-4 p-3 bg-red-600/10 border border-red-600/20 rounded-lg text-red-400 text-sm">
                {venueError}
              </div>
            )}

            {venues.length > 0 && (
              <div className="space-y-2 mb-4">
                {venues.map((venue) => (
                  <div key={venue.id}>
                    {editingVenue?.id === venue.id ? (
                      <VenueForm isEditing />
                    ) : (
                      <div className="flex items-center justify-between px-3 py-2.5 bg-white/5 rounded-lg">
                        <div>
                          <span className="text-white font-medium">{venue.name}</span>
                          {(venue.city || venue.state) && (
                            <span className="text-white/55 text-sm ml-3">
                              {[venue.city, venue.state].filter(Boolean).join(", ")}
                            </span>
                          )}
                          {venue.address && (
                            <span className="text-white/40 text-xs ml-3">{venue.address}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            onClick={() => handleStartEditVenue(venue)}
                            className="p-1.5 text-white/55 hover:text-white transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteVenue(venue)}
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

            {venues.length === 0 && !showVenueForm && (
              <p className="text-white/40 text-sm text-center py-4">
                No venues defined yet. Add one to get started.
              </p>
            )}

            {showVenueForm && <VenueForm isEditing={false} />}
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
