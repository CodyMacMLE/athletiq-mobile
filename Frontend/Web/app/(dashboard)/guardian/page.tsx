"use client";

import { useQuery } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { GET_GUARDIAN_ATHLETES, GET_USER_STATS } from "@/lib/graphql";
import { Users, TrendingUp, Clock, Flame, ChevronRight, Mail } from "lucide-react";
import Link from "next/link";

type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
  image?: string;
  memberships: {
    id: string;
    role: string;
    team: { id: string; name: string };
  }[];
};

type GuardianLink = {
  id: string;
  athlete: Athlete;
};

function AthleteStatsCard({
  athlete,
  organizationId,
}: {
  athlete: Athlete;
  organizationId: string;
}) {
  const { data: statsData, loading: statsLoading } = useQuery<any>(GET_USER_STATS, {
    variables: { userId: athlete.id, organizationId, timeRange: "MONTH" },
    skip: !organizationId,
  });

  const stats = statsData?.userStats;
  const teams = athlete.memberships
    .filter((m) => m.role !== "COACH" && m.role !== "ADMIN")
    .map((m) => m.team.name)
    .join(", ");

  return (
    <div
      className="rounded-2xl border border-white/10 overflow-hidden"
      style={{ background: "rgba(255,255,255,0.05)" }}
    >
      {/* Header */}
      <div className="p-5 border-b border-white/8 flex items-center gap-4">
        {athlete.image ? (
          <img
            src={athlete.image}
            alt=""
            className="w-14 h-14 rounded-full object-cover ring-2 ring-white/20"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-lg font-semibold ring-2 ring-white/20">
            {athlete.firstName[0]}
            {athlete.lastName[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-lg leading-tight">
            {athlete.firstName} {athlete.lastName}
          </h3>
          {teams && (
            <p className="text-white/50 text-sm mt-0.5 truncate">{teams}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="p-5">
        {statsLoading ? (
          <div className="flex items-center justify-center h-16">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-[#a78bfa]" />
                <span className="text-white/50 text-xs">Attendance</span>
              </div>
              <p className="text-white font-bold text-xl">
                {stats.attendancePercent != null
                  ? `${Math.round(stats.attendancePercent)}%`
                  : "—"}
              </p>
            </div>

            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-[#a78bfa]" />
                <span className="text-white/50 text-xs">Hours (month)</span>
              </div>
              <p className="text-white font-bold text-xl">
                {stats.hoursLogged != null ? stats.hoursLogged.toFixed(1) : "—"}
              </p>
            </div>

            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Flame className="w-3.5 h-3.5 text-[#a78bfa]" />
                <span className="text-white/50 text-xs">Current streak</span>
              </div>
              <p className="text-white font-bold text-xl">
                {stats.currentStreak != null ? stats.currentStreak : "—"}
              </p>
            </div>

            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-[#a78bfa]" />
                <span className="text-white/50 text-xs">Team rank</span>
              </div>
              <p className="text-white font-bold text-xl">
                {stats.teamRank != null && stats.teamSize != null
                  ? `${stats.teamRank} / ${stats.teamSize}`
                  : "—"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-white/40 text-sm text-center py-4">No stats available</p>
        )}
      </div>
    </div>
  );
}

export default function GuardianPage() {
  const { selectedOrganizationId, currentOrgRole } = useAuth();

  const { data, loading } = useQuery<any>(GET_GUARDIAN_ATHLETES, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId || currentOrgRole !== "GUARDIAN",
  });

  const links: GuardianLink[] = data?.myLinkedAthletes || [];

  if (currentOrgRole && currentOrgRole !== "GUARDIAN") {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <p className="text-white/50">This page is for guardians only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">My Athletes</h1>
          <p className="text-white/50 mt-1 text-sm">
            Monthly stats for your linked athletes
          </p>
        </div>
        <Link
          href="/guardian/email-reports"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/80 border border-white/15 rounded-xl hover:bg-white/10 transition-colors"
        >
          <Mail className="w-4 h-4" />
          Email Reports
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Athletes */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      ) : links.length === 0 ? (
        <div
          className="rounded-2xl border border-white/10 p-10 text-center"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/60 font-medium">No linked athletes</p>
          <p className="text-white/35 text-sm mt-1">
            Ask your organization admin to send you a guardian invite.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {links.map((link) => (
            <AthleteStatsCard
              key={link.id}
              athlete={link.athlete}
              organizationId={selectedOrganizationId!}
            />
          ))}
        </div>
      )}
    </div>
  );
}
