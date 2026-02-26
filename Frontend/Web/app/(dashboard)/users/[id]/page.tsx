"use client";

import { formatPhone, maskPhone, sanitizePhone } from "@/lib/utils";
import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import {
  GET_ORGANIZATION_USERS,
  GET_TEAMS,
  GET_USER_STATS,
  GET_CHECK_IN_HISTORY,
  GET_USER_HEALTH,
  GET_ATHLETE_GUARDIANS,
  GET_ATHLETE_STATUS_HISTORY,
  GET_GYMNASTICS_PROFILE,
  UPDATE_ORG_MEMBER_ROLE,
  UPDATE_TEAM_MEMBER_ROLE,
  ADD_TEAM_MEMBER,
  REMOVE_TEAM_MEMBER,
  REMOVE_ORG_MEMBER,
  CREATE_EMERGENCY_CONTACT,
  UPDATE_EMERGENCY_CONTACT,
  DELETE_EMERGENCY_CONTACT,
  UPSERT_MEDICAL_INFO,
  INVITE_GUARDIAN,
  REMOVE_GUARDIAN,
  UPDATE_ATHLETE_STATUS,
  UPSERT_GYMNASTICS_PROFILE,
} from "@/lib/graphql";
import {
  ArrowLeft,
  Plus,
  Trash2,
  X,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  TrendingUp,
  Trophy,
  Flame,
  BarChart3,
  Edit2,
  Lock,
  Phone,
  Heart,
  Mail,
  MapPin,
  Users,
  Send,
  Activity,
  Calendar,
  History,
} from "lucide-react";

type TeamAssignment = {
  id: string;
  role: string;
  team: {
    id: string;
    name: string;
  };
};

type OrgMember = {
  id: string;
  role: string;
  athleteStatus: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string | null;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    image?: string;
    createdAt: string;
    memberships: TeamAssignment[];
  };
};

type AthleteStatusRecord = {
  id: string;
  status: string;
  note?: string | null;
  createdAt: string;
  changedByUser: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

type GymnasticsProfile = {
  id: string;
  level?: string | null;
  discipline?: string | null;
  apparatus: string[];
  notes?: string | null;
  updatedAt: string;
};

const GYMNASTICS_LEVELS = [
  "JO Level 1", "JO Level 2", "JO Level 3", "JO Level 4", "JO Level 5",
  "JO Level 6", "JO Level 7", "JO Level 8", "JO Level 9", "JO Level 10",
  "Xcel Bronze", "Xcel Silver", "Xcel Gold", "Xcel Platinum", "Xcel Diamond",
  "Elite",
];

const GYMNASTICS_DISCIPLINES = ["WAG", "MAG", "Rhythmic", "T&T"];

const APPARATUS_BY_DISCIPLINE: Record<string, string[]> = {
  WAG: ["Vault", "Uneven Bars", "Balance Beam", "Floor Exercise"],
  MAG: ["Floor Exercise", "Pommel Horse", "Rings", "Vault", "Parallel Bars", "Horizontal Bar"],
  Rhythmic: ["Ball", "Clubs", "Hoop", "Ribbon", "Rope"],
  "T&T": ["Trampoline", "Double Mini Trampoline", "Tumbling"],
};

const ATHLETE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  ACTIVE: { label: "Active", color: "text-green-400", bg: "bg-green-500/15", dot: "bg-green-400" },
  SUSPENDED: { label: "Suspended", color: "text-yellow-400", bg: "bg-yellow-500/15", dot: "bg-yellow-400" },
  QUIT: { label: "Quit", color: "text-red-400", bg: "bg-red-500/15", dot: "bg-red-400" },
  RETIRED: { label: "Retired", color: "text-white/40", bg: "bg-white/8", dot: "bg-white/40" },
};

type GuardianLink = {
  id: string;
  createdAt: string;
  guardian: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    image?: string;
  };
};

type CheckInRecord = {
  id: string;
  status: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  hoursLogged: number | null;
  note: string | null;
  createdAt: string;
  event: {
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
  };
};

type EmergencyContact = {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  isPrimary: boolean;
};

type MedicalInfo = {
  id: string;
  conditions?: string;
  allergies?: string;
  medications?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceGroupNumber?: string;
  notes?: string;
  updatedAt: string;
};

const ORG_ROLES = ["ATHLETE", "COACH", "MANAGER", "ADMIN", "GUARDIAN"] as const;
const TEAM_ROLES = ["MEMBER", "CAPTAIN", "COACH"] as const;

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  ON_TIME: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/20", label: "On Time" },
  LATE: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/20", label: "Late" },
  ABSENT: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/20", label: "Absent" },
  EXCUSED: { icon: AlertCircle, color: "text-[#6c5ce7]", bg: "bg-[#a855f7]/15", label: "Excused" },
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { selectedOrganizationId, canEdit, isOwner, isAdmin, user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<"attendance" | "user-info" | "guardians" | "health" | "roles">("attendance");
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [showMedicalModal, setShowMedicalModal] = useState(false);
  const [showInviteGuardianModal, setShowInviteGuardianModal] = useState(false);
  const [showStatusChangeForm, setShowStatusChangeForm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [showGymnasticsForm, setShowGymnasticsForm] = useState(false);
  const [gymLevel, setGymLevel] = useState("");
  const [gymDiscipline, setGymDiscipline] = useState("");
  const [gymApparatus, setGymApparatus] = useState<string[]>([]);
  const [gymNotes, setGymNotes] = useState("");

  const { data, loading, refetch } = useQuery<any>(GET_ORGANIZATION_USERS, {
    variables: { id: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const { data: statsData, loading: statsLoading } = useQuery<any>(GET_USER_STATS, {
    variables: { userId, organizationId: selectedOrganizationId, timeRange: "MONTH" },
    skip: !selectedOrganizationId || activeTab !== "attendance",
  });

  const { data: checkInData, loading: checkInLoading } = useQuery<any>(GET_CHECK_IN_HISTORY, {
    variables: { userId, limit: 20 },
    skip: activeTab !== "attendance",
  });

  const { data: healthData, loading: healthLoading, refetch: refetchHealth } = useQuery<any>(GET_USER_HEALTH, {
    variables: { userId, organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId || activeTab !== "health",
  });

  const { data: guardiansData, loading: guardiansLoading, refetch: refetchGuardians } = useQuery<any>(GET_ATHLETE_GUARDIANS, {
    variables: { userId, organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId || (activeTab !== "guardians" && activeTab !== "user-info"),
  });

  const { data: statusHistoryData, loading: statusHistoryLoading, refetch: refetchStatusHistory } = useQuery<any>(GET_ATHLETE_STATUS_HISTORY, {
    variables: { userId, organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId || activeTab !== "user-info",
  });

  const { data: gymnProfileData, loading: gymnProfileLoading, refetch: refetchGymnProfile } = useQuery<any>(GET_GYMNASTICS_PROFILE, {
    variables: { userId, organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId || activeTab !== "user-info",
  });

  const [updateAthleteStatus] = useMutation<any>(UPDATE_ATHLETE_STATUS);
  const [upsertGymnasticsProfile] = useMutation<any>(UPSERT_GYMNASTICS_PROFILE);

  const [updateOrgMemberRole] = useMutation<any>(UPDATE_ORG_MEMBER_ROLE);
  const [updateTeamMemberRole] = useMutation<any>(UPDATE_TEAM_MEMBER_ROLE);
  const [addTeamMember] = useMutation<any>(ADD_TEAM_MEMBER);
  const [removeTeamMember] = useMutation<any>(REMOVE_TEAM_MEMBER);
  const [removeOrgMember] = useMutation<any>(REMOVE_ORG_MEMBER);
  const [createEmergencyContact] = useMutation<any>(CREATE_EMERGENCY_CONTACT);
  const [updateEmergencyContact] = useMutation<any>(UPDATE_EMERGENCY_CONTACT);
  const [deleteEmergencyContact] = useMutation<any>(DELETE_EMERGENCY_CONTACT);
  const [upsertMedicalInfo] = useMutation<any>(UPSERT_MEDICAL_INFO);
  const [inviteGuardian] = useMutation<any>(INVITE_GUARDIAN);
  const [removeGuardian] = useMutation<any>(REMOVE_GUARDIAN);

  const orgMembers: OrgMember[] = data?.organization?.members || [];
  const member = orgMembers.find((m) => m.user.id === userId);

  const emergencyContacts: EmergencyContact[] = healthData?.user?.emergencyContacts || [];
  const medicalInfo: MedicalInfo | null = healthData?.user?.medicalInfo || null;
  const adminHealthAccess: string = healthData?.organization?.adminHealthAccess || "ADMINS_ONLY";
  const coachHealthAccess: string = healthData?.organization?.coachHealthAccess || "TEAM_ONLY";
  const guardianLinks: GuardianLink[] = guardiansData?.athleteGuardians || [];

  // Derive current viewer's org role from loaded members list
  const viewerOrgRole = orgMembers.find((m) => m.user.id === currentUser?.id)?.role || "";

  const canChangeAthleteStatus = isOwner || isAdmin || viewerOrgRole === "MANAGER";
  const canEditGymnasticsProfile = isOwner || isAdmin || viewerOrgRole === "MANAGER" || viewerOrgRole === "COACH";

  const statusHistory: AthleteStatusRecord[] = statusHistoryData?.athleteStatusHistory || [];
  const gymnProfile: GymnasticsProfile | null = gymnProfileData?.gymnasticsProfile || null;

  const canViewHealth = (() => {
    if (isOwner || isAdmin) return true;
    if (viewerOrgRole === "MANAGER") return adminHealthAccess === "MANAGERS_AND_ADMINS";
    if (viewerOrgRole === "COACH") {
      // Both ORG_WIDE and TEAM_ONLY allow coaches to see health data;
      // TEAM_ONLY scope is enforced conceptually (coach sees only their teams' athletes).
      return coachHealthAccess === "ORG_WIDE" || coachHealthAccess === "TEAM_ONLY";
    }
    return false;
  })();

  const canRemoveMember = (member: OrgMember) => {
    if (member.role === "OWNER") return false;
    if (member.role === "ADMIN" && !isOwner) return false;
    if (member.role === "MANAGER" && !isOwner && !isAdmin) return false;
    if (member.user.id === currentUser?.id && !isOwner) return false;
    return true;
  };

  const canChangeOrgRole = (member: OrgMember) => {
    if (!canEdit) return false;
    if (member.role === "OWNER") return false;
    return true;
  };

  const getAvailableOrgRoles = () => {
    if (isOwner) return ORG_ROLES;
    if (isAdmin) return ORG_ROLES.filter((r) => r !== "ADMIN");
    return ORG_ROLES.filter((r) => r !== "ADMIN" && r !== "MANAGER");
  };

  const handleOrgRoleChange = async (newRole: string) => {
    if (!selectedOrganizationId || !member) return;
    try {
      await updateOrgMemberRole({
        variables: { userId, organizationId: selectedOrganizationId, role: newRole },
      });
      refetch();
    } catch (error) {
      console.error("Failed to update role:", error);
    }
  };

  const handleTeamRoleChange = async (teamId: string, newRole: string) => {
    try {
      await updateTeamMemberRole({
        variables: { userId, teamId, role: newRole },
      });
      refetch();
    } catch (error) {
      console.error("Failed to update team role:", error);
    }
  };

  const handleRemoveFromTeam = async (teamId: string) => {
    if (!confirm("Remove this user from the team?")) return;
    try {
      await removeTeamMember({ variables: { userId, teamId } });
      refetch();
    } catch (error) {
      console.error("Failed to remove from team:", error);
    }
  };

  const handleRemoveFromOrg = async () => {
    if (!selectedOrganizationId) return;
    if (!confirm("Are you sure you want to remove this user from the organization? This cannot be undone.")) return;
    try {
      await removeOrgMember({ variables: { userId, organizationId: selectedOrganizationId } });
      router.push("/users");
    } catch (error) {
      console.error("Failed to remove from organization:", error);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedOrganizationId || !pendingStatus) return;
    try {
      await updateAthleteStatus({
        variables: { userId, organizationId: selectedOrganizationId, status: pendingStatus, note: statusNote || null },
      });
      refetch();
      refetchStatusHistory();
      setShowStatusChangeForm(false);
      setPendingStatus("");
      setStatusNote("");
    } catch (error) {
      console.error("Failed to update athlete status:", error);
    }
  };

  const openGymnasticsForm = () => {
    setGymLevel(gymnProfile?.level || "");
    setGymDiscipline(gymnProfile?.discipline || "");
    setGymApparatus(gymnProfile?.apparatus || []);
    setGymNotes(gymnProfile?.notes || "");
    setShowGymnasticsForm(true);
  };

  const handleSaveGymnasticsProfile = async () => {
    if (!selectedOrganizationId) return;
    try {
      await upsertGymnasticsProfile({
        variables: {
          userId,
          organizationId: selectedOrganizationId,
          level: gymLevel || null,
          discipline: gymDiscipline || null,
          apparatus: gymApparatus,
          notes: gymNotes || null,
        },
      });
      refetchGymnProfile();
      setShowGymnasticsForm(false);
    } catch (error) {
      console.error("Failed to save gymnastics profile:", error);
    }
  };

  const roleBadge = (role: string) => {
    const styles: Record<string, string> = {
      OWNER: "bg-yellow-600/20 text-yellow-400",
      ADMIN: "bg-[#a855f7]/15 text-[#a78bfa]",
      MANAGER: "bg-blue-600/20 text-blue-400",
      COACH: "bg-green-600/20 text-green-400",
      ATHLETE: "bg-green-600/20 text-green-400",
      GUARDIAN: "bg-white/10 text-white/55",
      MEMBER: "bg-green-600/20 text-green-400",
      CAPTAIN: "bg-blue-600/20 text-blue-400",
    };
    return styles[role] || "bg-white/10 text-white/55";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6c5ce7]"></div>
      </div>
    );
  }

  if (!member) {
    return (
      <div>
        <Link href="/users" className="inline-flex items-center text-white/55 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Users
        </Link>
        <div className="text-center py-12">
          <p className="text-white/55">User not found</p>
        </div>
      </div>
    );
  }

  const memberSince = member.user.createdAt
    ? new Date(isNaN(Number(member.user.createdAt)) ? member.user.createdAt : Number(member.user.createdAt)).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const userStats = statsData?.userStats;
  const checkIns: CheckInRecord[] = checkInData?.checkInHistory || [];

  return (
    <div className="max-w-3xl">
      {/* Back Link */}
      <Link href="/users" className="inline-flex items-center text-white/55 hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Users
      </Link>

      {/* Summary Card */}
      <div className="bg-white/8 rounded-xl border border-white/8 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center">
            {member.user.image ? (
              <img
                src={member.user.image}
                alt={`${member.user.firstName} ${member.user.lastName}`}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-xl font-medium">
                {member.user.firstName[0]}
                {member.user.lastName[0]}
              </div>
            )}
            <div className="ml-5">
              <h1 className="text-2xl font-bold text-white">
                {member.user.firstName} {member.user.lastName}
              </h1>
              <p className="text-white/55">{member.user.email}</p>
              {memberSince && (
                <p className="text-white/40 text-sm mt-1">Member since {memberSince}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 ml-4">
            <span className={`px-3 py-1.5 text-sm font-medium rounded ${roleBadge(member.role)}`}>
              {member.role}
            </span>
            {member.role === "ATHLETE" && (() => {
              const sc = ATHLETE_STATUS_CONFIG[member.athleteStatus || "ACTIVE"] || ATHLETE_STATUS_CONFIG.ACTIVE;
              return (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${sc.bg} ${sc.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                  {sc.label}
                </span>
              );
            })()}
            <span className="text-white/55 text-sm">
              {member.user.memberships.length} {member.user.memberships.length === 1 ? "Team" : "Teams"}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-white/8 mb-6 overflow-x-auto">
        {([
          { key: "attendance", label: "Attendance" },
          { key: "user-info", label: "User Info" },
          { key: "guardians", label: "Guardians" },
          { key: "health", label: "Health & Safety" },
          { key: "roles", label: "Roles & Settings" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
              activeTab === key ? "text-[#a78bfa]" : "text-white/55 hover:text-white"
            }`}
          >
            {label}
            {activeTab === key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6c5ce7]" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "user-info" ? (
        <div className="space-y-6">
          {/* Contact Info */}
          <div className="bg-white/8 rounded-xl border border-white/8 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Contact Info</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-white/40 shrink-0" />
                <span className="text-white/80 text-sm">{member.user.email}</span>
              </div>
              {member.user.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-white/40 shrink-0" />
                  <span className="text-white/80 text-sm">{formatPhone(member.user.phone)}</span>
                </div>
              )}
              {(member.user.address || member.user.city || member.user.country) && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
                  <span className="text-white/80 text-sm">
                    {[member.user.address, member.user.city, member.user.country].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
              {/* Date of Birth */}
              {(() => {
                if (!member.user.dateOfBirth) return null;
                const dob = new Date(isNaN(Number(member.user.dateOfBirth)) ? member.user.dateOfBirth : Number(member.user.dateOfBirth));
                const today = new Date();
                const age = today.getFullYear() - dob.getFullYear() - (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
                return (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-white/40 shrink-0" />
                    <span className="text-white/80 text-sm">
                      {dob.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      <span className="text-white/40 ml-2">{age} yrs</span>
                    </span>
                  </div>
                );
              })()}

              {!member.user.phone && !member.user.address && !member.user.city && !member.user.country && (
                <p className="text-white/40 text-sm">No additional contact info on file</p>
              )}
            </div>
          </div>

          {/* Athlete Status (only for athletes) */}
          {member.role === "ATHLETE" && (
            <div className="bg-white/8 rounded-xl border border-white/8 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#a78bfa]" />
                  <h2 className="text-lg font-semibold text-white">Athlete Status</h2>
                </div>
                {canChangeAthleteStatus && !showStatusChangeForm && (
                  <button
                    onClick={() => { setPendingStatus(member.athleteStatus || "ACTIVE"); setShowStatusChangeForm(true); }}
                    className="flex items-center text-sm text-[#a78bfa] hover:text-[#c4b5fd] transition-colors"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Change
                  </button>
                )}
              </div>

              {/* Current Status */}
              {(() => {
                const sc = ATHLETE_STATUS_CONFIG[member.athleteStatus || "ACTIVE"] || ATHLETE_STATUS_CONFIG.ACTIVE;
                return (
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${sc.bg} mb-4`}>
                    <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                    <span className={`text-sm font-medium ${sc.color}`}>{sc.label}</span>
                  </div>
                );
              })()}

              {/* Change Form */}
              {showStatusChangeForm && (
                <div className="bg-white/5 rounded-lg p-4 mb-4 space-y-3">
                  <div>
                    <label className="text-xs text-white/55 mb-1 block">New Status</label>
                    <select
                      value={pendingStatus}
                      onChange={(e) => setPendingStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/15 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
                    >
                      {Object.entries(ATHLETE_STATUS_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/55 mb-1 block">Note (optional)</label>
                    <input
                      type="text"
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Reason for status change..."
                      className="w-full px-3 py-2 bg-white/10 border border-white/15 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleStatusChange}
                      disabled={!pendingStatus}
                      className="px-4 py-2 bg-[#6c5ce7] text-white text-sm rounded-lg hover:bg-[#5b4dd0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setShowStatusChangeForm(false); setPendingStatus(""); setStatusNote(""); }}
                      className="px-4 py-2 text-white/55 text-sm hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Status History */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40 uppercase tracking-wider">Status History</span>
                </div>
                {statusHistoryLoading ? (
                  <div className="flex items-center justify-center h-12">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#6c5ce7]" />
                  </div>
                ) : statusHistory.length > 0 ? (
                  <div className="space-y-2">
                    {statusHistory.map((record) => {
                      const sc = ATHLETE_STATUS_CONFIG[record.status] || ATHLETE_STATUS_CONFIG.ACTIVE;
                      const date = new Date(isNaN(Number(record.createdAt)) ? record.createdAt : Number(record.createdAt));
                      return (
                        <div key={record.id} className="flex items-start gap-3 text-sm">
                          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${sc.dot}`} />
                          <div className="flex-1 min-w-0">
                            <span className={`font-medium ${sc.color}`}>{sc.label}</span>
                            {record.note && <span className="text-white/55 ml-2">— {record.note}</span>}
                            <p className="text-white/35 text-xs mt-0.5">
                              {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              {" · "}by {record.changedByUser.firstName} {record.changedByUser.lastName}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-white/35 text-xs">No status changes recorded</p>
                )}
              </div>
            </div>
          )}

          {/* Gymnastics Profile (only for athletes) */}
          {member.role === "ATHLETE" && (
            <div className="bg-white/8 rounded-xl border border-white/8 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Gymnastics Profile</h2>
                {canEditGymnasticsProfile && !showGymnasticsForm && (
                  <button
                    onClick={openGymnasticsForm}
                    className="flex items-center text-sm text-[#a78bfa] hover:text-[#c4b5fd] transition-colors"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    {gymnProfile ? "Edit" : "Set Up"}
                  </button>
                )}
              </div>

              {gymnProfileLoading ? (
                <div className="flex items-center justify-center h-12">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#6c5ce7]" />
                </div>
              ) : showGymnasticsForm ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-white/55 mb-1 block">Level</label>
                      <select
                        value={gymLevel}
                        onChange={(e) => setGymLevel(e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/15 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
                      >
                        <option value="">Select level</option>
                        {GYMNASTICS_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/55 mb-1 block">Discipline</label>
                      <select
                        value={gymDiscipline}
                        onChange={(e) => { setGymDiscipline(e.target.value); setGymApparatus([]); }}
                        className="w-full px-3 py-2 bg-white/10 border border-white/15 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
                      >
                        <option value="">Select discipline</option>
                        {GYMNASTICS_DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  {gymDiscipline && (
                    <div>
                      <label className="text-xs text-white/55 mb-2 block">Apparatus</label>
                      <div className="flex flex-wrap gap-2">
                        {(APPARATUS_BY_DISCIPLINE[gymDiscipline] || []).map((ap) => {
                          const selected = gymApparatus.includes(ap);
                          return (
                            <button
                              key={ap}
                              type="button"
                              onClick={() => setGymApparatus((prev) =>
                                selected ? prev.filter((a) => a !== ap) : [...prev, ap]
                              )}
                              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                selected
                                  ? "bg-[#6c5ce7]/30 border-[#6c5ce7] text-[#a78bfa]"
                                  : "bg-white/5 border-white/15 text-white/55 hover:border-white/30"
                              }`}
                            >
                              {ap}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-white/55 mb-1 block">Notes</label>
                    <textarea
                      value={gymNotes}
                      onChange={(e) => setGymNotes(e.target.value)}
                      rows={2}
                      placeholder="Any additional notes..."
                      className="w-full px-3 py-2 bg-white/10 border border-white/15 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] resize-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveGymnasticsProfile}
                      className="px-4 py-2 bg-[#6c5ce7] text-white text-sm rounded-lg hover:bg-[#5b4dd0] transition-colors"
                    >
                      Save Profile
                    </button>
                    <button
                      onClick={() => setShowGymnasticsForm(false)}
                      className="px-4 py-2 text-white/55 text-sm hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : gymnProfile ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-white/40 mb-0.5">Level</p>
                      <p className="text-sm text-white">{gymnProfile.level || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/40 mb-0.5">Discipline</p>
                      <p className="text-sm text-white">{gymnProfile.discipline || "—"}</p>
                    </div>
                  </div>
                  {gymnProfile.apparatus.length > 0 && (
                    <div>
                      <p className="text-xs text-white/40 mb-1.5">Apparatus</p>
                      <div className="flex flex-wrap gap-1.5">
                        {gymnProfile.apparatus.map((ap) => (
                          <span key={ap} className="px-2.5 py-1 text-xs rounded-full bg-[#6c5ce7]/20 text-[#a78bfa] border border-[#6c5ce7]/30">
                            {ap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {gymnProfile.notes && (
                    <div>
                      <p className="text-xs text-white/40 mb-0.5">Notes</p>
                      <p className="text-sm text-white/80">{gymnProfile.notes}</p>
                    </div>
                  )}
                  <p className="text-xs text-white/30 pt-1">
                    Updated {new Date(isNaN(Number(gymnProfile.updatedAt)) ? gymnProfile.updatedAt : Number(gymnProfile.updatedAt)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              ) : (
                <p className="text-white/40 text-sm">No gymnastics profile set up yet</p>
              )}
            </div>
          )}

          {/* Guardian Contact Info (if athlete has guardians) */}
          {(guardiansLoading || guardianLinks.length > 0) && (
            <div className="bg-white/8 rounded-xl border border-white/8 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-[#a78bfa]" />
                <h2 className="text-lg font-semibold text-white">Guardian Contacts</h2>
              </div>
              {guardiansLoading ? (
                <div className="flex items-center justify-center h-16">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#6c5ce7]" />
                </div>
              ) : (
                <div className="space-y-4">
                  {guardianLinks.map((link) => (
                    <div key={link.id} className="bg-white/5 rounded-lg px-4 py-3 space-y-2">
                      <p className="text-white font-medium">
                        {link.guardian.firstName} {link.guardian.lastName}
                      </p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-white/70 text-sm">{link.guardian.email}</span>
                        </div>
                        {link.guardian.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-white/40" />
                            <span className="text-white/70 text-sm">{formatPhone(link.guardian.phone)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : activeTab === "guardians" ? (
        <div className="bg-white/8 rounded-xl border border-white/8 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#a78bfa]" />
              <h2 className="text-lg font-semibold text-white">Guardians</h2>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowInviteGuardianModal(true)}
                className="flex items-center text-sm text-[#a78bfa] hover:text-[#c4b5fd] transition-colors"
              >
                <Send className="w-4 h-4 mr-1" />
                Invite Guardian
              </button>
            )}
          </div>
          {guardiansLoading ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6c5ce7]" />
            </div>
          ) : guardianLinks.length > 0 ? (
            <div className="space-y-3">
              {guardianLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    {link.guardian.image ? (
                      <img src={link.guardian.image} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#6c5ce7]/30 flex items-center justify-center text-white text-sm font-medium">
                        {link.guardian.firstName[0]}{link.guardian.lastName[0]}
                      </div>
                    )}
                    <div>
                      <p className="text-white font-medium text-sm">
                        {link.guardian.firstName} {link.guardian.lastName}
                      </p>
                      <p className="text-white/55 text-xs">{link.guardian.email}</p>
                      {link.guardian.phone && (
                        <p className="text-white/40 text-xs">{formatPhone(link.guardian.phone)}</p>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Remove ${link.guardian.firstName} ${link.guardian.lastName} as guardian?`)) return;
                        await removeGuardian({ variables: { guardianLinkId: link.id } });
                        refetchGuardians();
                      }}
                      className="p-1.5 text-white/40 hover:text-red-400 transition-colors"
                      title="Remove guardian"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/55 text-sm">No guardians linked to this athlete</p>
              {canEdit && (
                <p className="text-white/35 text-xs mt-1">Use "Invite Guardian" to send an invitation</p>
              )}
            </div>
          )}
        </div>
      ) : activeTab === "health" ? (
        <>
          {healthLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6c5ce7]"></div>
            </div>
          ) : !canViewHealth ? (
            <div className="bg-white/8 rounded-xl border border-white/8 p-8 text-center">
              <Lock className="w-10 h-10 text-white/30 mx-auto mb-3" />
              <p className="text-white font-medium mb-1">Access Restricted</p>
              <p className="text-white/55 text-sm">Your role doesn&apos;t have access to health information. An admin can update this in Settings.</p>
            </div>
          ) : (
            <>
              {/* Emergency Contacts */}
              <div className="bg-white/8 rounded-xl border border-white/8 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-[#a78bfa]" />
                    <h2 className="text-lg font-semibold text-white">Emergency Contacts</h2>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => { setEditingContact(null); setShowAddContactModal(true); }}
                      className="flex items-center text-sm text-[#a78bfa] hover:text-[#c4b5fd] transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Contact
                    </button>
                  )}
                </div>
                {emergencyContacts.length > 0 ? (
                  <div className="space-y-3">
                    {emergencyContacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-white font-medium">{contact.name}</span>
                            {contact.isPrimary && (
                              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-[#6c5ce7]/30 text-[#a78bfa]">PRIMARY</span>
                            )}
                          </div>
                          <p className="text-white/55 text-sm">{contact.relationship} · {formatPhone(contact.phone)}</p>
                          {contact.email && <p className="text-white/40 text-sm">{contact.email}</p>}
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-1 ml-4">
                            <button
                              onClick={() => { setEditingContact(contact); setShowAddContactModal(true); }}
                              className="p-1.5 text-white/55 hover:text-white transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm("Delete this emergency contact?")) return;
                                await deleteEmergencyContact({ variables: { id: contact.id } });
                                refetchHealth();
                              }}
                              className="p-1.5 text-white/55 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/40 text-sm text-center py-4">No emergency contacts added yet</p>
                )}
              </div>

              {/* Medical Information */}
              <div className="bg-white/8 rounded-xl border border-white/8 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-[#a78bfa]" />
                    <h2 className="text-lg font-semibold text-white">Medical Information</h2>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => setShowMedicalModal(true)}
                      className="flex items-center text-sm text-[#a78bfa] hover:text-[#c4b5fd] transition-colors"
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Edit
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Allergies", value: medicalInfo?.allergies },
                    { label: "Conditions", value: medicalInfo?.conditions },
                    { label: "Medications", value: medicalInfo?.medications },
                    { label: "Insurance Provider", value: medicalInfo?.insuranceProvider },
                    { label: "Policy Number", value: medicalInfo?.insurancePolicyNumber },
                    { label: "Group Number", value: medicalInfo?.insuranceGroupNumber },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-white/40 mb-0.5">{label}</p>
                      <p className="text-sm text-white">{value || "—"}</p>
                    </div>
                  ))}
                  {(medicalInfo?.notes) && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-white/40 mb-0.5">Notes</p>
                      <p className="text-sm text-white">{medicalInfo.notes}</p>
                    </div>
                  )}
                </div>
                {medicalInfo?.updatedAt && (
                  <p className="text-xs text-white/30 mt-4">
                    Last updated {new Date(isNaN(Number(medicalInfo.updatedAt)) ? medicalInfo.updatedAt : Number(medicalInfo.updatedAt)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}
              </div>
            </>
          )}
        </>
      ) : activeTab === "roles" ? (
        // Roles & Settings tab
        <>
          {/* Organization Role */}
          <div className="bg-white/8 rounded-xl border border-white/8 p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Organization Role</h2>
            {canChangeOrgRole(member) ? (
              <select
                value={member.role}
                onChange={(e) => handleOrgRoleChange(e.target.value)}
                className="px-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
              >
                {getAvailableOrgRoles().map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            ) : (
              <span className={`px-3 py-1.5 text-sm font-medium rounded ${roleBadge(member.role)}`}>
                {member.role}
              </span>
            )}
          </div>

          {/* Teams */}
          <div className="bg-white/8 rounded-xl border border-white/8 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Teams</h2>
              {canEdit && (
                <button
                  onClick={() => setShowAddTeamModal(true)}
                  className="flex items-center text-sm text-[#a78bfa] hover:text-[#c4b5fd] transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add to Team
                </button>
              )}
            </div>

            {member.user.memberships.length > 0 ? (
              <div className="space-y-3">
                {member.user.memberships.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-4">
                      <Link
                        href={`/teams/${membership.team.id}`}
                        className="text-white font-medium hover:text-[#a78bfa] transition-colors"
                      >
                        {membership.team.name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-3">
                      {canEdit ? (
                        <select
                          value={membership.role}
                          onChange={(e) => handleTeamRoleChange(membership.team.id, e.target.value)}
                          className="px-3 py-1.5 text-sm bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
                        >
                          {TEAM_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-2 py-1 text-xs font-medium rounded ${roleBadge(membership.role)}`}>
                          {membership.role}
                        </span>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => handleRemoveFromTeam(membership.team.id)}
                          className="p-1.5 text-white/55 hover:text-red-500 transition-colors"
                          title="Remove from team"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/40 text-sm">Not assigned to any teams</p>
            )}
          </div>

          {/* Remove from Organization */}
          {canEdit && canRemoveMember(member) && (
            <div className="bg-white/8 rounded-xl border border-red-900/50 p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Danger Zone</h2>
              <p className="text-white/55 text-sm mb-4">
                Removing this user from the organization will revoke their access to all teams and data.
              </p>
              <button
                onClick={handleRemoveFromOrg}
                className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30 transition-colors"
              >
                Remove from Organization
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Attendance Tab (activeTab === "attendance") */}
          {statsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6c5ce7]"></div>
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/8 rounded-xl border border-white/8 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-white/55">Attendance Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {userStats ? `${Math.round(userStats.attendancePercent)}%` : "--"}
                  </p>
                </div>

                <div className="bg-white/8 rounded-xl border border-white/8 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-white/55">Hours Logged</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {userStats ? userStats.hoursLogged.toFixed(1) : "--"}
                  </p>
                  {userStats && userStats.hoursRequired > 0 && (
                    <p className="text-xs text-white/40 mt-1">of {userStats.hoursRequired} required</p>
                  )}
                </div>

                <div className="bg-white/8 rounded-xl border border-white/8 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span className="text-xs text-white/55">Current Streak</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {userStats ? userStats.currentStreak : "--"}
                  </p>
                  <p className="text-xs text-white/40 mt-1">events</p>
                </div>

                <div className="bg-white/8 rounded-xl border border-white/8 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-white/55">Org Rank</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {userStats && userStats.orgRank > 0 ? `#${userStats.orgRank}` : "--"}
                  </p>
                  {userStats && userStats.orgSize > 0 && (
                    <p className="text-xs text-white/40 mt-1">of {userStats.orgSize}</p>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white/8 rounded-xl border border-white/8 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
                {checkInLoading ? (
                  <div className="flex items-center justify-center h-20">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#6c5ce7]"></div>
                  </div>
                ) : checkIns.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-white/55 border-b border-white/8">
                          <th className="pb-3 font-medium">Event</th>
                          <th className="pb-3 font-medium">Date</th>
                          <th className="pb-3 font-medium">Status</th>
                          <th className="pb-3 font-medium">Check In</th>
                          <th className="pb-3 font-medium">Check Out</th>
                          <th className="pb-3 font-medium">Hours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {checkIns.map((checkIn) => {
                          const config = STATUS_CONFIG[checkIn.status];
                          const StatusIcon = config?.icon || CheckCircle;
                          return (
                            <tr key={checkIn.id} className="text-sm">
                              <td className="py-3 pr-4">
                                <Link
                                  href={`/events/${checkIn.event.id}`}
                                  className="text-white hover:text-[#a78bfa] transition-colors"
                                >
                                  {checkIn.event.title}
                                </Link>
                              </td>
                              <td className="py-3 pr-4 text-white/55">
                                {new Date(isNaN(Number(checkIn.event.date)) ? checkIn.event.date : Number(checkIn.event.date)).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </td>
                              <td className="py-3 pr-4">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${config?.bg || "bg-gray-500/20"} ${config?.color || "text-white/55"}`}>
                                  <StatusIcon className="w-3 h-3" />
                                  {config?.label || checkIn.status}
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-white/55">
                                {checkIn.checkInTime
                                  ? new Date(isNaN(Number(checkIn.checkInTime)) ? checkIn.checkInTime : Number(checkIn.checkInTime)).toLocaleTimeString("en-US", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })
                                  : "--"}
                              </td>
                              <td className="py-3 pr-4 text-white/55">
                                {checkIn.checkOutTime
                                  ? new Date(isNaN(Number(checkIn.checkOutTime)) ? checkIn.checkOutTime : Number(checkIn.checkOutTime)).toLocaleTimeString("en-US", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })
                                  : "--"}
                              </td>
                              <td className="py-3 text-white/55">
                                {checkIn.hoursLogged != null ? checkIn.hoursLogged.toFixed(1) : "--"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-white/40 text-sm text-center py-8">No attendance records yet</p>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Invite Guardian Modal */}
      {showInviteGuardianModal && selectedOrganizationId && (
        <InviteGuardianModal
          athleteName={`${member.user.firstName} ${member.user.lastName}`}
          onClose={() => setShowInviteGuardianModal(false)}
          onInvite={async (email) => {
            await inviteGuardian({
              variables: { email, organizationId: selectedOrganizationId, athleteId: userId },
            });
            setShowInviteGuardianModal(false);
            refetchGuardians();
          }}
        />
      )}

      {/* Add to Team Modal */}
      {showAddTeamModal && selectedOrganizationId && (
        <AddToTeamModal
          userId={userId}
          organizationId={selectedOrganizationId}
          currentTeamIds={member.user.memberships.map((m) => m.team.id)}
          onClose={() => setShowAddTeamModal(false)}
          onSuccess={() => {
            refetch();
            setShowAddTeamModal(false);
          }}
        />
      )}

      {/* Emergency Contact Modal */}
      {showAddContactModal && selectedOrganizationId && (
        <EmergencyContactModal
          contact={editingContact}
          userId={userId}
          organizationId={selectedOrganizationId}
          onClose={() => { setShowAddContactModal(false); setEditingContact(null); }}
          onSave={async (data) => {
            if (editingContact) {
              await updateEmergencyContact({ variables: { id: editingContact.id, input: data } });
            } else {
              await createEmergencyContact({ variables: { input: { userId, organizationId: selectedOrganizationId, ...data } } });
            }
            refetchHealth();
            setShowAddContactModal(false);
            setEditingContact(null);
          }}
        />
      )}

      {/* Medical Info Modal */}
      {showMedicalModal && selectedOrganizationId && (
        <MedicalInfoModal
          medicalInfo={medicalInfo}
          userId={userId}
          organizationId={selectedOrganizationId}
          onClose={() => setShowMedicalModal(false)}
          onSave={async (data) => {
            await upsertMedicalInfo({ variables: { input: { userId, organizationId: selectedOrganizationId, ...data } } });
            refetchHealth();
            setShowMedicalModal(false);
          }}
        />
      )}
    </div>
  );
}

function AddToTeamModal({
  userId,
  organizationId,
  currentTeamIds,
  onClose,
  onSuccess,
}: {
  userId: string;
  organizationId: string;
  currentTeamIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: teamsData } = useQuery<any>(GET_TEAMS, {
    variables: { organizationId },
  });

  const [addTeamMember] = useMutation<any>(ADD_TEAM_MEMBER);

  const allTeams: { id: string; name: string }[] = teamsData?.teams || [];
  const availableTeams = allTeams.filter(
    (team) =>
      !currentTeamIds.includes(team.id) &&
      team.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (teamId: string) => {
    setSubmitting(true);
    try {
      await addTeamMember({
        variables: {
          input: { userId, teamId, role: "MEMBER" },
        },
      });
      onSuccess();
    } catch (error) {
      console.error("Failed to add to team:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/8 backdrop-blur-xl rounded-xl w-full max-w-md p-6 border border-white/15 shadow-2xl" ref={dropdownRef}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Add to Team</h2>
          <button onClick={onClose} className="text-white/55 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/15 border border-white/25 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] text-sm"
            placeholder="Search teams..."
            autoFocus
          />
        </div>

        <div className="max-h-64 overflow-y-auto">
          {availableTeams.length > 0 ? (
            availableTeams.map((team) => (
              <button
                key={team.id}
                onClick={() => handleAdd(team.id)}
                disabled={submitting}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
              >
                <span>{team.name}</span>
                <Plus className="w-4 h-4 text-white/55" />
              </button>
            ))
          ) : (
            <p className="text-center text-white/40 py-4 text-sm">
              {search ? "No matching teams" : "Already on all teams"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EmergencyContactModal({
  contact,
  onClose,
  onSave,
}: {
  contact: EmergencyContact | null;
  userId: string;
  organizationId: string;
  onClose: () => void;
  onSave: (data: { name: string; relationship: string; phone: string; email?: string; isPrimary: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState(contact?.name || "");
  const [relationship, setRelationship] = useState(contact?.relationship || "");
  const [phone, setPhone] = useState(formatPhone(contact?.phone || ""));
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [email, setEmail] = useState(contact?.email || "");
  const [isPrimary, setIsPrimary] = useState(contact?.isPrimary || false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !relationship.trim() || !phone.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), relationship: relationship.trim(), phone: sanitizePhone(phone.trim()), email: email.trim() || undefined, isPrimary });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/8 backdrop-blur-xl rounded-xl w-full max-w-md p-6 border border-white/15 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{contact ? "Edit Contact" : "Add Emergency Contact"}</h2>
          <button onClick={onClose} className="text-white/55 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-white/55 mb-1">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]" placeholder="Full name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/55 mb-1">Relationship *</label>
            <input value={relationship} onChange={(e) => setRelationship(e.target.value)} className="w-full px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]" placeholder="e.g. Mother, Father, Coach" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/55 mb-1">Phone *</label>
            <input
              type="tel"
              value={phoneFocused && !sanitizePhone(phone) ? "(" : phone}
              onFocus={() => setPhoneFocused(true)}
              onBlur={() => { setPhoneFocused(false); if (!sanitizePhone(phone)) setPhone(""); }}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(555) 123-4567"
              className="w-full px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/55 mb-1">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]" placeholder="Optional" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="w-4 h-4 rounded accent-[#6c5ce7]" />
            <span className="text-sm text-white/70">Primary contact</span>
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/55 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !relationship.trim() || !phone.trim()} className="px-4 py-2 bg-[#6c5ce7] text-white rounded-lg text-sm hover:bg-[#5a4dd4] transition-colors disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MedicalInfoModal({
  medicalInfo,
  onClose,
  onSave,
}: {
  medicalInfo: MedicalInfo | null;
  userId: string;
  organizationId: string;
  onClose: () => void;
  onSave: (data: Partial<MedicalInfo>) => Promise<void>;
}) {
  const [conditions, setConditions] = useState(medicalInfo?.conditions || "");
  const [allergies, setAllergies] = useState(medicalInfo?.allergies || "");
  const [medications, setMedications] = useState(medicalInfo?.medications || "");
  const [insuranceProvider, setInsuranceProvider] = useState(medicalInfo?.insuranceProvider || "");
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState(medicalInfo?.insurancePolicyNumber || "");
  const [insuranceGroupNumber, setInsuranceGroupNumber] = useState(medicalInfo?.insuranceGroupNumber || "");
  const [notes, setNotes] = useState(medicalInfo?.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ conditions: conditions || undefined, allergies: allergies || undefined, medications: medications || undefined, insuranceProvider: insuranceProvider || undefined, insurancePolicyNumber: insurancePolicyNumber || undefined, insuranceGroupNumber: insuranceGroupNumber || undefined, notes: notes || undefined });
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value: string, setter: (v: string) => void, multiline?: boolean) => (
    <div key={label}>
      <label className="block text-sm font-medium text-white/55 mb-1">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => setter(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] resize-none" />
      ) : (
        <input value={value} onChange={(e) => setter(e.target.value)} className="w-full px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]" />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/8 backdrop-blur-xl rounded-xl w-full max-w-lg p-6 border border-white/15 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Medical Information</h2>
          <button onClick={onClose} className="text-white/55 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          {field("Allergies", allergies, setAllergies, true)}
          {field("Conditions", conditions, setConditions, true)}
          {field("Medications", medications, setMedications, true)}
          {field("Insurance Provider", insuranceProvider, setInsuranceProvider)}
          <div className="grid grid-cols-2 gap-3">
            {field("Policy Number", insurancePolicyNumber, setInsurancePolicyNumber)}
            {field("Group Number", insuranceGroupNumber, setInsuranceGroupNumber)}
          </div>
          {field("Notes", notes, setNotes, true)}
        </div>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/55 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-[#6c5ce7] text-white rounded-lg text-sm hover:bg-[#5a4dd4] transition-colors disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteGuardianModal({
  athleteName,
  onClose,
  onInvite,
}: {
  athleteName: string;
  onClose: () => void;
  onInvite: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onInvite(email.trim());
    } catch (err: any) {
      setError(err.message || "Failed to send invite");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/8 backdrop-blur-xl rounded-xl w-full max-w-md p-6 border border-white/15 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Invite Guardian</h2>
          <button onClick={onClose} className="text-white/55 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-white/55 text-sm mb-4">
          Send a guardian invite on behalf of <span className="text-white font-medium">{athleteName}</span>. The invited person will receive an email to accept.
        </p>
        {error && (
          <div className="mb-4 p-3 bg-red-600/10 border border-red-600/20 rounded-lg text-red-400 text-sm">{error}</div>
        )}
        <div>
          <label className="block text-sm font-medium text-white/55 mb-1">Guardian&apos;s Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
            placeholder="parent@example.com"
            className="w-full px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
          />
        </div>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/55 hover:text-white transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !email.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#6c5ce7] text-white rounded-lg text-sm hover:bg-[#5a4dd4] transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {saving ? "Sending..." : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
