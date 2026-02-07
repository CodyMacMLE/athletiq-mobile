"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useLazyQuery } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import {
  UPDATE_USER,
  LEAVE_ORGANIZATION,
  TRANSFER_OWNERSHIP,
  CREATE_INVITE,
  CREATE_ORGANIZATION,
  GET_ORGANIZATION_USERS,
} from "@/lib/graphql";
import {
  User as UserIcon,
  Building2,
  Smartphone,
  LogOut,
  Loader2,
  X,
  Plus,
  AlertTriangle,
} from "lucide-react";

type Section = "profile" | "organizations" | "app-download";

type OrgMembership = {
  id: string;
  role: string;
  organization: {
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
  };
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, refetch, setSelectedOrganizationId } = useAuth();

  const [section, setSection] = useState<Section>("profile");
  const [initialSectionSet, setInitialSectionSet] = useState(false);

  // Profile form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Modals
  const [leaveModalOrg, setLeaveModalOrg] = useState<OrgMembership | null>(null);
  const [transferModalOrg, setTransferModalOrg] = useState<OrgMembership | null>(null);
  const [guardianModalOrg, setGuardianModalOrg] = useState<OrgMembership | null>(null);
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianSuccess, setGuardianSuccess] = useState("");
  const [guardianError, setGuardianError] = useState("");
  const [selectedNewOwner, setSelectedNewOwner] = useState<string | null>(null);
  const [transferError, setTransferError] = useState("");
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [createOrgError, setCreateOrgError] = useState("");

  // Mutations
  const [updateUser, { loading: saving }] = useMutation(UPDATE_USER);
  const [leaveOrganization, { loading: leaving }] = useMutation(LEAVE_ORGANIZATION);
  const [transferOwnership, { loading: transferring }] = useMutation(TRANSFER_OWNERSHIP);
  const [createInvite, { loading: inviting }] = useMutation(CREATE_INVITE);
  const [createOrganization, { loading: creatingOrg }] = useMutation(CREATE_ORGANIZATION);

  // Lazy query for transfer modal members
  const [fetchOrgUsers, { data: orgUsersData, loading: orgUsersLoading }] = useLazyQuery(GET_ORGANIZATION_USERS);

  // Populate form when user data loads
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setPhone(user.phone || "");
      setAddress(user.address || "");
      setCity(user.city || "");
      setCountry(user.country || "");
    }
  }, [user]);

  // Auth gate
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, router]);

  // Default to organizations section when user has no orgs (e.g. failed registration setup)
  useEffect(() => {
    if (user && !initialSectionSet) {
      setInitialSectionSet(true);
      if (user.organizationMemberships?.length === 0) {
        setSection("organizations");
      }
    }
  }, [user, initialSectionSet]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const orgMemberships: OrgMembership[] = user?.organizationMemberships || [];
  const hasAthleteOrGuardian = orgMemberships.some(
    (m) => m.role === "ATHLETE" || m.role === "GUARDIAN"
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess("");
    setProfileError("");

    try {
      await updateUser({
        variables: {
          id: user!.id,
          input: {
            firstName,
            lastName,
            phone: phone || undefined,
            address: address || undefined,
            city: city || undefined,
            country: country || undefined,
          },
        },
      });
      refetch();
      setProfileSuccess("Profile updated successfully!");
      setTimeout(() => setProfileSuccess(""), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      setProfileError(message);
    }
  };

  const handleLeave = async () => {
    if (!leaveModalOrg) return;
    try {
      await leaveOrganization({
        variables: { organizationId: leaveModalOrg.organization.id },
      });
      setLeaveModalOrg(null);
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to leave organization";
      setProfileError(message);
      setLeaveModalOrg(null);
    }
  };

  const openTransferModal = (org: OrgMembership) => {
    setTransferModalOrg(org);
    setSelectedNewOwner(null);
    setTransferError("");
    fetchOrgUsers({ variables: { id: org.organization.id } });
  };

  const handleTransfer = async () => {
    if (!transferModalOrg || !selectedNewOwner) return;
    setTransferError("");
    try {
      await transferOwnership({
        variables: {
          organizationId: transferModalOrg.organization.id,
          newOwnerId: selectedNewOwner,
        },
      });
      setTransferModalOrg(null);
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to transfer ownership";
      setTransferError(message);
    }
  };

  const handleInviteGuardian = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardianModalOrg) return;
    setGuardianSuccess("");
    setGuardianError("");

    try {
      await createInvite({
        variables: {
          input: {
            email: guardianEmail,
            organizationId: guardianModalOrg.organization.id,
            role: "GUARDIAN",
          },
        },
      });
      setGuardianSuccess("Guardian invite sent!");
      setGuardianEmail("");
      setTimeout(() => {
        setGuardianSuccess("");
        setGuardianModalOrg(null);
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send invite";
      setGuardianError(message);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateOrgError("");
    try {
      await createOrganization({
        variables: { input: { name: newOrgName } },
      });
      setShowCreateOrg(false);
      setNewOrgName("");
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create organization";
      setCreateOrgError(message);
    }
  };

  const handleGoToDashboard = (orgId: string) => {
    setSelectedOrganizationId(orgId);
    window.location.href = "/dashboard";
  };

  const orgMembers: OrgMember[] = orgUsersData?.organization?.members || [];
  const transferCandidates = orgMembers.filter((m) => m.user.id !== user?.id);

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case "OWNER": return "bg-yellow-600/20 text-yellow-400";
      case "MANAGER": return "bg-blue-600/20 text-blue-400";
      case "COACH": return "bg-green-600/20 text-green-400";
      case "ATHLETE": return "bg-purple-600/20 text-purple-400";
      case "GUARDIAN": return "bg-pink-600/20 text-pink-400";
      default: return "bg-gray-600/20 text-gray-400";
    }
  };

  const DASHBOARD_ROLES = ["OWNER", "MANAGER", "COACH"];

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* User info */}
        <div className="p-6 border-b border-gray-700">
          <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center text-white text-xl font-medium mb-3">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <h2 className="text-white font-semibold truncate">
            {user?.firstName} {user?.lastName}
          </h2>
          <p className="text-sm text-gray-400 truncate">{user?.email}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => setSection("profile")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              section === "profile"
                ? "bg-purple-600/20 text-purple-400"
                : "text-gray-400 hover:bg-gray-700 hover:text-white"
            }`}
          >
            <UserIcon className="w-5 h-5" />
            Profile
          </button>
          <button
            onClick={() => setSection("organizations")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              section === "organizations"
                ? "bg-purple-600/20 text-purple-400"
                : "text-gray-400 hover:bg-gray-700 hover:text-white"
            }`}
          >
            <Building2 className="w-5 h-5" />
            Organizations
          </button>
          {hasAthleteOrGuardian && (
            <button
              onClick={() => setSection("app-download")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                section === "app-download"
                  ? "bg-purple-600/20 text-purple-400"
                  : "text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
            >
              <Smartphone className="w-5 h-5" />
              App Download
            </button>
          )}
        </nav>

        {/* Sign out */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Profile Section */}
        {section === "profile" && (
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-white mb-6">Profile</h1>

            {/* Avatar */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-20 h-20 rounded-full bg-purple-600 flex items-center justify-center text-white text-2xl font-medium">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {user?.firstName} {user?.lastName}
                </h2>
                <p className="text-sm text-gray-400">{user?.email}</p>
              </div>
            </div>

            {profileSuccess && (
              <div className="mb-4 px-4 py-3 bg-green-500/10 border border-green-500 text-green-400 rounded-lg text-sm">
                {profileSuccess}
              </div>
            )}
            {profileError && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500 text-red-400 rounded-lg text-sm">
                {profileError}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="New York"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="United States"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="py-2.5 px-6 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </form>
          </div>
        )}

        {/* Organizations Section */}
        {section === "organizations" && (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-white">Organizations</h1>
              <button
                onClick={() => { setShowCreateOrg(true); setNewOrgName(""); setCreateOrgError(""); }}
                className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Organization
              </button>
            </div>

            {orgMemberships.length === 0 ? (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
                <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">You&apos;re not a member of any organizations yet.</p>
                <button
                  onClick={() => { setShowCreateOrg(true); setNewOrgName(""); setCreateOrgError(""); }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Your First Organization
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {orgMemberships.map((m) => (
                  <div
                    key={m.id}
                    className="bg-gray-800 rounded-xl border border-gray-700 p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-white">
                          {m.organization.name}
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadgeColor(m.role)}`}>
                          {m.role}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {DASHBOARD_ROLES.includes(m.role) && (
                        <button
                          onClick={() => handleGoToDashboard(m.organization.id)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          Go to Dashboard
                        </button>
                      )}

                      {m.role === "OWNER" && (
                        <button
                          onClick={() => openTransferModal(m)}
                          className="px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 text-sm font-medium rounded-lg transition-colors"
                        >
                          Transfer Ownership
                        </button>
                      )}

                      {m.role !== "OWNER" && (
                        <button
                          onClick={() => setLeaveModalOrg(m)}
                          className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium rounded-lg transition-colors"
                        >
                          Leave
                        </button>
                      )}

                      {m.role === "ATHLETE" && (
                        <button
                          onClick={() => {
                            setGuardianModalOrg(m);
                            setGuardianEmail("");
                            setGuardianSuccess("");
                            setGuardianError("");
                          }}
                          className="px-3 py-1.5 bg-pink-600/20 hover:bg-pink-600/30 text-pink-400 text-sm font-medium rounded-lg transition-colors"
                        >
                          Invite Guardian
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* App Download Section */}
        {section === "app-download" && (
          <div className="max-w-md">
            <h1 className="text-2xl font-bold text-white mb-6">App Download</h1>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
              <Smartphone className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">Get the Athletiq App</h2>
              <p className="text-gray-400 text-sm mb-6">
                Download Athletiq on your phone to check in to events, track hours, and stay connected with your team.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  disabled
                  className="w-full py-3 px-4 bg-gray-700 text-gray-400 font-medium rounded-lg cursor-not-allowed text-sm"
                >
                  App Store — Coming Soon
                </button>
                <button
                  disabled
                  className="w-full py-3 px-4 bg-gray-700 text-gray-400 font-medium rounded-lg cursor-not-allowed text-sm"
                >
                  Google Play — Coming Soon
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Leave Organization Modal */}
      {leaveModalOrg && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Leave Organization</h2>
              <button onClick={() => setLeaveModalOrg(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-start gap-3 mb-6">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
              <p className="text-gray-400 text-sm">
                Are you sure you want to leave{" "}
                <span className="text-white font-medium">{leaveModalOrg.organization.name}</span>?
                You will be removed from all teams in this organization. This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setLeaveModalOrg(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {leaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Leaving...
                  </>
                ) : (
                  "Leave Organization"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {transferModalOrg && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Transfer Ownership</h2>
              <button onClick={() => setTransferModalOrg(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-400 text-sm mb-2">
              Select a member to become the new owner of{" "}
              <span className="text-white font-medium">{transferModalOrg.organization.name}</span>.
            </p>
            <p className="text-yellow-400 text-xs mb-4">
              You will be demoted to Manager.
            </p>

            {orgUsersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                {transferCandidates.map((m) => (
                  <button
                    key={m.user.id}
                    onClick={() => setSelectedNewOwner(m.user.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      selectedNewOwner === m.user.id
                        ? "border-purple-500 bg-purple-600/10"
                        : "border-gray-700 bg-gray-700/50 hover:bg-gray-700"
                    }`}
                  >
                    <div>
                      <p className="text-sm text-white font-medium">
                        {m.user.firstName} {m.user.lastName}
                      </p>
                      <p className="text-xs text-gray-400">{m.user.email}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeColor(m.role)}`}>
                      {m.role}
                    </span>
                  </button>
                ))}
                {transferCandidates.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No other members in this organization.
                  </p>
                )}
              </div>
            )}

            {transferError && (
              <div className="mb-4 px-3 py-2 bg-red-600/20 border border-red-600/30 rounded-lg text-red-400 text-sm">
                {transferError}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setTransferModalOrg(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={!selectedNewOwner || transferring}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {transferring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Transferring...
                  </>
                ) : (
                  "Confirm Transfer"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateOrg && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Create Organization</h2>
              <button onClick={() => setShowCreateOrg(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-400 text-sm mb-4">
              Create a new organization. You will be the owner.
            </p>

            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    setCreateOrgError("");
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  placeholder="e.g. Westside Track Club"
                  autoFocus
                />
              </div>

              {createOrgError && (
                <div className="px-3 py-2 bg-red-600/20 border border-red-600/30 rounded-lg text-red-400 text-sm">
                  {createOrgError}
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateOrg(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingOrg}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {creatingOrg ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Guardian Modal */}
      {guardianModalOrg && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Invite Guardian</h2>
              <button onClick={() => setGuardianModalOrg(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-400 text-sm mb-4">
              Invite a parent or guardian to{" "}
              <span className="text-white font-medium">{guardianModalOrg.organization.name}</span>.
            </p>

            <form onSubmit={handleInviteGuardian} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Guardian&apos;s Email
                </label>
                <input
                  type="email"
                  required
                  value={guardianEmail}
                  onChange={(e) => {
                    setGuardianEmail(e.target.value);
                    setGuardianError("");
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  placeholder="parent@example.com"
                  autoFocus
                />
              </div>

              {guardianSuccess && (
                <div className="px-3 py-2 bg-green-500/10 border border-green-500 text-green-400 rounded-lg text-sm">
                  {guardianSuccess}
                </div>
              )}
              {guardianError && (
                <div className="px-3 py-2 bg-red-600/20 border border-red-600/30 rounded-lg text-red-400 text-sm">
                  {guardianError}
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setGuardianModalOrg(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {inviting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Invite"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
