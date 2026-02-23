"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import {
  UPDATE_USER,
  GENERATE_UPLOAD_URL,
  LEAVE_ORGANIZATION,
  GET_GUARDIAN_ATHLETES,
  GET_USER_STATS,
} from "@/lib/graphql";
import { gql } from "@apollo/client";
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
  TrendingUp,
  Clock,
  Flame,
  Users,
  Send,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatPhone, sanitizePhone } from "@/lib/utils";

// ─── GraphQL ─────────────────────────────────────────────────────────────────

const GET_EMAIL_REPORT_CONFIGS = gql`
  query GetEmailReportConfigsAccount {
    myEmailReportConfigs {
      id
      frequency
      enabled
      lastSentAt
      organization { id name }
    }
  }
`;

const CREATE_EMAIL_REPORT_CONFIG = gql`
  mutation CreateEmailReportConfigAccount($input: CreateEmailReportConfigInput!) {
    createEmailReportConfig(input: $input) {
      id frequency enabled organization { id name }
    }
  }
`;

const UPDATE_EMAIL_REPORT_CONFIG = gql`
  mutation UpdateEmailReportConfigAccount($id: ID!, $enabled: Boolean) {
    updateEmailReportConfig(id: $id, enabled: $enabled) {
      id frequency enabled
    }
  }
`;

const DELETE_EMAIL_REPORT_CONFIG = gql`
  mutation DeleteEmailReportConfigAccount($id: ID!) {
    deleteEmailReportConfig(id: $id)
  }
`;

const SEND_TEST_REPORT = gql`
  mutation SendTestReportAccount($configId: ID!) {
    sendTestReport(configId: $configId)
  }
`;

// ─── Constants ────────────────────────────────────────────────────────────────

type Section = "profile" | "organizations" | "guardian";
type ReportFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "BIANNUALLY" | "ANNUALLY";

const FREQUENCY_OPTIONS: { value: ReportFrequency; label: string; description: string }[] = [
  { value: "WEEKLY",     label: "Weekly",      description: "Every week" },
  { value: "MONTHLY",    label: "Monthly",     description: "Once a month" },
  { value: "QUARTERLY",  label: "Quarterly",   description: "Every 3 months" },
  { value: "BIANNUALLY", label: "Bi-annually", description: "Twice a year" },
  { value: "ANNUALLY",   label: "Annually",    description: "Once a year" },
];

const ROLE_COLORS: Record<string, string> = {
  OWNER:    "bg-yellow-600/20 text-yellow-400",
  ADMIN:    "bg-[#a855f7]/15 text-[#a78bfa]",
  MANAGER:  "bg-blue-600/20 text-blue-400",
  COACH:    "bg-green-600/20 text-green-400",
  ATHLETE:  "bg-white/10 text-white/70",
  GUARDIAN: "bg-pink-600/20 text-pink-400",
};

const inputClass =
  "w-full px-3 py-2.5 bg-white/8 border border-white/10 rounded-lg text-white text-sm placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]";
const labelClass = "block text-xs font-medium text-white/55 mb-1";

// ─── Athlete Stats Card ───────────────────────────────────────────────────────

function AthleteStatsCard({
  athlete,
  organizationId,
}: {
  athlete: any;
  organizationId: string;
}) {
  const { data, loading } = useQuery<any>(GET_USER_STATS, {
    variables: { userId: athlete.id, organizationId, timeRange: "MONTH" },
  });
  const stats = data?.userStats;
  const teams = athlete.memberships
    ?.filter((m: any) => m.role !== "COACH" && m.role !== "ADMIN")
    .map((m: any) => m.team.name)
    .join(", ");

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden bg-white/5">
      <div className="p-4 border-b border-white/8 flex items-center gap-3">
        {athlete.image ? (
          <img src={athlete.image} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-white/15" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white font-semibold ring-2 ring-white/15">
            {athlete.firstName[0]}{athlete.lastName[0]}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-white font-semibold">{athlete.firstName} {athlete.lastName}</p>
          {teams && <p className="text-white/40 text-xs truncate mt-0.5">{teams}</p>}
        </div>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: TrendingUp, label: "Attendance", value: stats.attendancePercent != null ? `${Math.round(stats.attendancePercent)}%` : "—" },
              { icon: Clock,      label: "Hours (mo.)", value: stats.hoursLogged != null ? stats.hoursLogged.toFixed(1) : "—" },
              { icon: Flame,      label: "Streak",      value: stats.currentStreak != null ? stats.currentStreak : "—" },
              { icon: Users,      label: "Team rank",   value: stats.teamRank != null ? `${stats.teamRank}/${stats.teamSize}` : "—" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white/5 rounded-lg p-2.5">
                <div className="flex items-center gap-1 mb-1">
                  <Icon className="w-3 h-3 text-[#a78bfa]" />
                  <span className="text-white/40 text-xs">{label}</span>
                </div>
                <p className="text-white font-bold text-lg">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/30 text-sm text-center py-3">No stats available</p>
        )}
      </div>
    </div>
  );
}

// ─── Email Report Toggles (per org) ──────────────────────────────────────────

function OrgReportToggles({
  organizationId,
  configs,
  refetchConfigs,
}: {
  organizationId: string;
  configs: any[];
  refetchConfigs: () => void;
}) {
  const [togglingFreq, setTogglingFreq] = useState<string | null>(null);
  const [testSentFreq, setTestSentFreq] = useState<string | null>(null);

  const [createConfig] = useMutation(CREATE_EMAIL_REPORT_CONFIG);
  const [updateConfig] = useMutation(UPDATE_EMAIL_REPORT_CONFIG);
  const [deleteConfig] = useMutation(DELETE_EMAIL_REPORT_CONFIG);
  const [sendTestReport] = useMutation(SEND_TEST_REPORT);

  const configsByFreq = new Map<string, any>(configs.map((c) => [c.frequency, c]));

  const handleToggle = async (frequency: ReportFrequency) => {
    if (togglingFreq) return;
    setTogglingFreq(frequency);
    try {
      const existing = configsByFreq.get(frequency);
      if (existing) {
        existing.enabled
          ? await deleteConfig({ variables: { id: existing.id } })
          : await updateConfig({ variables: { id: existing.id, enabled: true } });
      } else {
        await createConfig({ variables: { input: { organizationId, frequency } } });
      }
      refetchConfigs();
    } catch (err) {
      console.error("Failed to toggle report frequency:", err);
    } finally {
      setTogglingFreq(null);
    }
  };

  const handleSendTest = async (frequency: ReportFrequency) => {
    const config = configsByFreq.get(frequency);
    if (!config) return;
    try {
      await sendTestReport({ variables: { configId: config.id } });
      setTestSentFreq(frequency);
      setTimeout(() => setTestSentFreq(null), 3000);
    } catch (err) {
      console.error("Failed to send test report:", err);
    }
  };

  return (
    <div className="space-y-2">
      {FREQUENCY_OPTIONS.map((option) => {
        const config = configsByFreq.get(option.value);
        const active = config?.enabled === true;
        const isToggling = togglingFreq === option.value;
        const testSent = testSentFreq === option.value;

        return (
          <div key={option.value} className="flex items-center justify-between px-3 py-2.5 bg-white/5 rounded-lg">
            <div
              className="flex items-center gap-3 flex-1 cursor-pointer"
              onClick={() => !isToggling && handleToggle(option.value)}
            >
              <div className={`relative w-9 h-[18px] rounded-full transition-colors shrink-0 ${isToggling ? "opacity-50" : ""} ${active ? "bg-[#6c5ce7]" : "bg-white/15"}`}>
                <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${active ? "translate-x-[18px]" : "translate-x-0.5"}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{option.label}</p>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-white/40">{option.description}</p>
                  {config?.lastSentAt && (
                    <p className="text-xs text-white/25 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last sent {new Date(config.lastSentAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {active && (
              <button
                onClick={() => handleSendTest(option.value)}
                className={`ml-3 p-1.5 rounded-lg transition-colors shrink-0 ${testSent ? "text-green-400 bg-green-600/15" : "text-white/30 hover:text-[#a78bfa] hover:bg-[#a855f7]/10"}`}
                title="Send test report now"
              >
                {testSent ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const { user, refetch, logout, selectedOrganizationId, setSelectedOrganizationId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeSection, setActiveSection] = useState<Section>("profile");

  // Profile form
  const [firstName, setFirstName]   = useState("");
  const [lastName, setLastName]     = useState("");
  const [phone, setPhone]           = useState("");
  const [address, setAddress]       = useState("");
  const [city, setCity]             = useState("");
  const [country, setCountry]       = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading]   = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError]     = useState("");

  const [updateUser, { loading: saving }] = useMutation(UPDATE_USER);
  const [generateUploadUrl] = useMutation<{
    generateUploadUrl: { uploadUrl: string; publicUrl: string };
  }>(GENERATE_UPLOAD_URL);
  const [leaveOrg, { loading: leaving }] = useMutation(LEAVE_ORGANIZATION);

  // Guardian data
  const orgMemberships  = user?.organizationMemberships || [];
  const guardianOrgs    = orgMemberships.filter((m: any) => m.role === "GUARDIAN");
  const isGuardian      = guardianOrgs.length > 0;

  const { data: configsData, refetch: refetchConfigs } = useQuery(GET_EMAIL_REPORT_CONFIGS, {
    skip: !isGuardian,
  });
  const allConfigs: any[] = (configsData as any)?.myEmailReportConfigs || [];

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

  const navItems: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: "profile",       label: "Profile",       icon: User },
    { id: "organizations", label: "Organizations", icon: Building2 },
    ...(isGuardian ? [{ id: "guardian" as Section, label: "Family", icon: Heart }] : []),
  ];

  // ── Image upload ──────────────────────────────────────────────────────────
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

  // ── Save profile ──────────────────────────────────────────────────────────
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

  // ── Leave org ─────────────────────────────────────────────────────────────
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

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #302b6f 10%, #4d2a69 60%, #302b6f 100%)" }}
    >
      {/* ── Top Navbar ─────────────────────────────────────────────────────── */}
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
            <img src={imagePreview} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-[#6c5ce7]/50" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-sm font-medium">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
          )}
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Left sub-nav */}
        <aside className="w-52 shrink-0 border-r border-white/8 bg-[rgba(20,15,50,0.2)] flex flex-col">
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

            {/* ── Profile ──────────────────────────────────────────────────── */}
            {activeSection === "profile" && (
              <div>
                <h1 className="text-xl font-bold text-white mb-6">Profile</h1>

                {/* Avatar card */}
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
                      {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
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

            {/* ── Organizations ────────────────────────────────────────────── */}
            {activeSection === "organizations" && (
              <div>
                <h1 className="text-xl font-bold text-white mb-6">Organizations</h1>
                {orgMemberships.length === 0 ? (
                  <div className="text-center py-12 text-white/40 text-sm">You are not a member of any organization.</div>
                ) : (
                  <div className="space-y-3">
                    {orgMemberships.map((m: any) => {
                      const isActive = m.organization.id === selectedOrganizationId;
                      const isOwner  = m.role === "OWNER";
                      return (
                        <div
                          key={m.id}
                          className={`p-4 rounded-xl border transition-colors ${isActive ? "bg-[#6c5ce7]/10 border-[#6c5ce7]/40" : "bg-white/5 border-white/8"}`}
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
                                    <span className="px-1.5 py-0.5 text-xs bg-[#6c5ce7]/30 text-[#c4b5fd] rounded font-medium">Active</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <Shield className="w-3 h-3 text-white/25" />
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

            {/* ── Family / Guardian ─────────────────────────────────────────── */}
            {activeSection === "guardian" && isGuardian && (
              <div className="space-y-8">
                <h1 className="text-xl font-bold text-white">Family</h1>

                {guardianOrgs.map((m: any) => {
                  const orgConfigs = allConfigs.filter((c: any) => c.organization.id === m.organization.id);
                  return (
                    <OrgGuardianSection
                      key={m.id}
                      orgId={m.organization.id}
                      orgName={m.organization.name}
                      orgConfigs={orgConfigs}
                      refetchConfigs={refetchConfigs}
                    />
                  );
                })}
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Per-org guardian section ─────────────────────────────────────────────────

function OrgGuardianSection({
  orgId,
  orgName,
  orgConfigs,
  refetchConfigs,
}: {
  orgId: string;
  orgName: string;
  orgConfigs: any[];
  refetchConfigs: () => void;
}) {
  const { data, loading } = useQuery<any>(GET_GUARDIAN_ATHLETES, {
    variables: { organizationId: orgId },
  });
  const links: any[] = data?.myLinkedAthletes || [];

  return (
    <div>
      {/* Org header */}
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-4 h-4 text-[#a78bfa]" />
        <h2 className="text-base font-semibold text-white">{orgName}</h2>
      </div>

      {/* Athletes */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Athletes</p>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : links.length === 0 ? (
          <div className="p-4 bg-white/5 rounded-xl border border-white/8 text-center">
            <p className="text-white/40 text-sm">No linked athletes.</p>
            <p className="text-white/25 text-xs mt-1">Ask your organization admin to send a guardian invite.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {links.map((link: any) => (
              <AthleteStatsCard key={link.id} athlete={link.athlete} organizationId={orgId} />
            ))}
          </div>
        )}
      </div>

      {/* Email reports */}
      <div>
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Email Reports</p>
        <div className="bg-white/5 rounded-xl border border-white/8 p-4">
          <p className="text-xs text-white/40 mb-4">
            Choose how often you receive attendance reports for your athletes in {orgName}.
          </p>
          <OrgReportToggles
            organizationId={orgId}
            configs={orgConfigs}
            refetchConfigs={refetchConfigs}
          />
        </div>
      </div>

      <div className="border-t border-white/8 mt-8" />
    </div>
  );
}
