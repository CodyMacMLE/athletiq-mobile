"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import {
  UPDATE_USER,
  GENERATE_UPLOAD_URL,
  LEAVE_ORGANIZATION,
  GET_GUARDIAN_ATHLETES,
} from "@/lib/graphql";
import {
  User,
  Building2,
  Heart,
  LogOut,
  Camera,
  Loader2,
  Check,
  ChevronRight,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Shield,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPhone, sanitizePhone } from "@/lib/utils";

type Section = "profile" | "organizations" | "guardian";

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-yellow-600/20 text-yellow-400",
  ADMIN: "bg-[#a855f7]/15 text-[#a78bfa]",
  MANAGER: "bg-blue-600/20 text-blue-400",
  COACH: "bg-green-600/20 text-green-400",
  ATHLETE: "bg-white/10 text-white/70",
  GUARDIAN: "bg-pink-600/20 text-pink-400",
};

// ─── Guardian Athletes Sub-section ──────────────────────────────────────────
function GuardianOrgAthletes({ organizationId }: { organizationId: string }) {
  const { data, loading } = useQuery(GET_GUARDIAN_ATHLETES, {
    variables: { organizationId },
  });
  const athletes: any[] = (data as any)?.myLinkedAthletes || [];

  if (loading) return <p className="text-xs text-white/30 mt-2">Loading athletes…</p>;
  if (!athletes.length) return <p className="text-xs text-white/30 mt-2">No linked athletes.</p>;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {athletes.map((link: any) => (
        <span key={link.id} className="px-2.5 py-1 bg-[#a855f7]/12 text-[#c4b5fd] rounded-full text-xs">
          {link.athlete.firstName} {link.athlete.lastName}
        </span>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AccountPage() {
  const router = useRouter();
  const { user, refetch, logout, selectedOrganizationId, setSelectedOrganizationId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeSection, setActiveSection] = useState<Section>("profile");

  // Profile form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  const [updateUser, { loading: saving }] = useMutation(UPDATE_USER);
  const [generateUploadUrl] = useMutation<{
    generateUploadUrl: { uploadUrl: string; publicUrl: string };
  }>(GENERATE_UPLOAD_URL);
  const [leaveOrg, { loading: leaving }] = useMutation(LEAVE_ORGANIZATION);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setPhone(formatPhone(user.phone));
      setAddress(user.address || "");
      setCity(user.city || "");
      setCountry(user.country || "");
      if (user.image) setImagePreview(user.image);
    }
  }, [user]);

  const orgMemberships = user?.organizationMemberships || [];
  const guardianOrgs = orgMemberships.filter((m: any) => m.role === "GUARDIAN");
  const isGuardian = guardianOrgs.length > 0;

  const navItems: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "organizations", label: "Organizations", icon: Building2 },
    ...(isGuardian ? [{ id: "guardian" as Section, label: "Guardian", icon: Heart }] : []),
  ];

  // ── Profile picture upload ──────────────────────────────────────────────────
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setProfileError("Please select a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileError("Image must be under 5MB.");
      return;
    }
    setUploading(true);
    setProfileError("");
    try {
      const { data } = await generateUploadUrl({ variables: { fileType: file.type } });
      const { uploadUrl, publicUrl } = data!.generateUploadUrl;
      const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!res.ok) throw new Error("Upload failed");
      const imageUrl = `${publicUrl}?t=${Date.now()}`;
      await updateUser({ variables: { id: user!.id, input: { image: imageUrl } } });
      setImagePreview(imageUrl);
      await refetch();
      setProfileSuccess("Profile picture updated!");
      setTimeout(() => setProfileSuccess(""), 3000);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Save profile ────────────────────────────────────────────────────────────
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
            phone: sanitizePhone(phone) || undefined,
            address: address || undefined,
            city: city || undefined,
            country: country || undefined,
          },
        },
      });
      await refetch();
      setProfileSuccess("Profile updated successfully!");
      setTimeout(() => setProfileSuccess(""), 3000);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile");
    }
  };

  // ── Leave org ───────────────────────────────────────────────────────────────
  const handleLeaveOrg = async (orgId: string, orgName: string) => {
    if (!confirm(`Leave "${orgName}"? You will lose access to all data in this organization.`)) return;
    try {
      await leaveOrg({ variables: { organizationId: orgId } });
      if (selectedOrganizationId === orgId) {
        const remaining = orgMemberships.filter((m: any) => m.organization.id !== orgId);
        setSelectedOrganizationId(remaining[0]?.organization.id ?? null);
      }
      await refetch();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to leave organization");
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 bg-white/8 border border-white/10 rounded-lg text-white text-sm placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]";
  const labelClass = "block text-xs font-medium text-white/55 mb-1";

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #302b6f 10%, #4d2a69 60%, #302b6f 100%)" }}
    >
      {/* ── Top Navbar ───────────────────────────────────────────────────────── */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/8 bg-[rgba(20,15,50,0.35)]">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-white/55 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="w-px h-4 bg-white/15" />
          <Image
            src="/logo/white_icon_transparent_background.png"
            alt="Athletiq"
            width={90}
            height={24}
            className="object-contain max-h-8"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white leading-tight">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-white/40">{user?.email}</p>
          </div>
          {imagePreview ? (
            <img
              src={imagePreview}
              alt=""
              className="w-9 h-9 rounded-full object-cover ring-2 ring-[#6c5ce7]/50"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-sm font-medium">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
          )}
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Left sub-nav */}
        <aside className="w-56 shrink-0 border-r border-white/8 bg-[rgba(20,15,50,0.2)] flex flex-col">
          <nav className="flex-1 px-3 py-6 space-y-1">
            {navItems.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                    active ? "bg-[#6c5ce7] text-white" : "text-white/65 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="px-3 py-4 border-t border-white/8">
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/55 hover:bg-red-600/10 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-8">

            {/* ── Profile ────────────────────────────────────────────────────── */}
            {activeSection === "profile" && (
              <div>
                <h1 className="text-xl font-bold text-white mb-6">Profile</h1>

                {/* Avatar */}
                <div className="flex items-center gap-5 mb-8 p-5 bg-white/5 rounded-xl border border-white/8">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="relative w-20 h-20 rounded-full overflow-hidden group shrink-0"
                  >
                    {imagePreview ? (
                      <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#6c5ce7] flex items-center justify-center text-white text-2xl font-semibold">
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {uploading ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5 text-white" />
                      )}
                    </div>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageSelect} className="hidden" />
                  <div>
                    <p className="text-base font-semibold text-white">{user?.firstName} {user?.lastName}</p>
                    <p className="text-sm text-white/40 mt-0.5">{user?.email}</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="mt-2 text-xs text-[#a78bfa] hover:text-[#c4b5fd] transition-colors disabled:opacity-50"
                    >
                      {uploading ? "Uploading…" : "Change photo"}
                    </button>
                  </div>
                </div>

                {profileSuccess && (
                  <div className="mb-4 px-4 py-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg text-sm flex items-center gap-2">
                    <Check className="w-4 h-4" /> {profileSuccess}
                  </div>
                )}
                {profileError && (
                  <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">
                    {profileError}
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-5">
                  {/* Name */}
                  <div>
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Personal Info</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>First Name</label>
                        <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} required />
                      </div>
                      <div>
                        <label className={labelClass}>Last Name</label>
                        <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} required />
                      </div>
                    </div>
                  </div>

                  {/* Contact */}
                  <div>
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Contact</p>
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>
                          <span className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3" /> Email
                            <span className="ml-1 text-white/25 normal-case font-normal">(managed by your account provider)</span>
                          </span>
                        </label>
                        <input type="email" value={user?.email || ""} disabled className={`${inputClass} opacity-40 cursor-not-allowed`} />
                      </div>
                      <div>
                        <label className={labelClass}>
                          <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> Phone</span>
                        </label>
                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" className={inputClass} />
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Location</p>
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>
                          <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Address</span>
                        </label>
                        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" className={inputClass} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>City</label>
                          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Country</label>
                          <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="United States" className={inputClass} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#6c5ce7] hover:bg-[#5a4dd4] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Save Changes</>}
                  </button>
                </form>
              </div>
            )}

            {/* ── Organizations ──────────────────────────────────────────────── */}
            {activeSection === "organizations" && (
              <div>
                <h1 className="text-xl font-bold text-white mb-6">Organizations</h1>

                {orgMemberships.length === 0 ? (
                  <div className="text-center py-12 text-white/40 text-sm">
                    You are not a member of any organization.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orgMemberships.map((m: any) => {
                      const isActive = m.organization.id === selectedOrganizationId;
                      const isOwner = m.role === "OWNER";
                      return (
                        <div
                          key={m.id}
                          className={`p-4 rounded-xl border transition-colors ${
                            isActive
                              ? "bg-[#6c5ce7]/10 border-[#6c5ce7]/40"
                              : "bg-white/5 border-white/8"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-[#6c5ce7]/20 flex items-center justify-center shrink-0">
                                <Building2 className="w-5 h-5 text-[#a78bfa]" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-semibold text-white truncate">{m.organization.name}</p>
                                  {isActive && (
                                    <span className="px-1.5 py-0.5 text-xs bg-[#6c5ce7]/30 text-[#c4b5fd] rounded font-medium">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Shield className="w-3 h-3 text-white/30" />
                                  <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${ROLE_COLORS[m.role] || "bg-white/10 text-white/55"}`}>
                                    {m.role}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              {!isActive && (
                                <button
                                  onClick={() => setSelectedOrganizationId(m.organization.id)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#6c5ce7] hover:bg-[#5a4dd4] text-white rounded-lg transition-colors"
                                >
                                  Switch <ChevronRight className="w-3 h-3" />
                                </button>
                              )}
                              {!isOwner && (
                                <button
                                  onClick={() => handleLeaveOrg(m.organization.id, m.organization.name)}
                                  disabled={leaving}
                                  className="px-3 py-1.5 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-colors"
                                >
                                  Leave
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Guardian ───────────────────────────────────────────────────── */}
            {activeSection === "guardian" && isGuardian && (
              <div>
                <h1 className="text-xl font-bold text-white mb-2">Guardian</h1>
                <p className="text-sm text-white/40 mb-6">
                  You are a guardian in the following organizations. Attendance reports are sent to your email based on each organization's settings.
                </p>

                <div className="space-y-4 mb-8">
                  {guardianOrgs.map((m: any) => (
                    <div key={m.id} className="p-4 bg-white/5 rounded-xl border border-white/8">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Heart className="w-4 h-4 text-pink-400" />
                          <p className="text-sm font-semibold text-white">{m.organization.name}</p>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${ROLE_COLORS["GUARDIAN"]}`}>
                          Guardian
                        </span>
                      </div>
                      <p className="text-xs text-white/40 mb-1">Linked athletes</p>
                      <GuardianOrgAthletes organizationId={m.organization.id} />
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-white/5 rounded-xl border border-white/8">
                  <p className="text-sm font-medium text-white mb-1">Email Reports</p>
                  <p className="text-xs text-white/40 mb-3">
                    Configure how often you receive attendance reports for your athletes.
                  </p>
                  <Link
                    href="/guardian/email-reports"
                    className="inline-flex items-center gap-1.5 text-sm text-[#a78bfa] hover:text-[#c4b5fd] transition-colors"
                  >
                    Manage email reports <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
