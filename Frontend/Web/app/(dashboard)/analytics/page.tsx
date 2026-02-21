"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { GET_ORGANIZATION_STATS, GET_TEAMS, GET_TEAM_LEADERBOARD } from "@/lib/graphql";
import { TrendingUp, Users, Award } from "lucide-react";

type TimeRange = "WEEK" | "MONTH" | "ALL";

export default function Analytics() {
  const { selectedOrganizationId } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>("MONTH");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const { data: teamsData, loading: teamsLoading } = useQuery<any>(GET_TEAMS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const { data: statsData, loading: statsLoading } = useQuery<any>(GET_ORGANIZATION_STATS, {
    variables: { organizationId: selectedOrganizationId, timeRange },
    skip: !selectedOrganizationId,
  });

  const { data: leaderboardData, loading: leaderboardLoading } = useQuery<any>(GET_TEAM_LEADERBOARD, {
    variables: { teamId: selectedTeamId, timeRange, limit: 20 },
    skip: !selectedTeamId,
  });

  const teams = teamsData?.teams || [];
  const teamRankings = statsData?.teamRankings || [];
  const leaderboard = leaderboardData?.teamLeaderboard || [];

  // Use current season teams from teamRankings
  const currentSeasonTeams = teamRankings.map((ranking: any) => ranking.team);

  // Auto-select first current season team
  if (currentSeasonTeams.length > 0 && !selectedTeamId) {
    setSelectedTeamId(currentSeasonTeams[0].id);
  }

  const isLoading = teamsLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6c5ce7]"></div>
      </div>
    );
  }

  // Calculate org-wide stats
  const totalMembers = teamRankings.reduce((sum: number, t: any) => sum + t.team.memberCount, 0);
  const avgAttendance =
    teamRankings.length > 0
      ? teamRankings.reduce((sum: number, t: any) => sum + t.attendancePercent, 0) / teamRankings.length
      : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-white/55 mt-1">Organization performance and insights</p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center space-x-2">
          {(["WEEK", "MONTH", "ALL"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? "bg-[#6c5ce7] text-white"
                  : "bg-white/8 text-white/55 hover:text-white"
              }`}
            >
              {range === "ALL" ? "All Time" : range.charAt(0) + range.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/8 rounded-xl p-6 border border-white/8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/55 text-sm">Total Athletes</p>
              <p className="text-3xl font-bold text-white mt-1">{totalMembers}</p>
            </div>
            <div className="w-12 h-12 bg-[#6c5ce7]/40 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white/8 rounded-xl p-6 border border-white/8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/55 text-sm">Avg Attendance</p>
              <p className="text-3xl font-bold text-white mt-1">{Math.round(avgAttendance)}%</p>
            </div>
            <div className="w-12 h-12 bg-[#6c5ce7]/40 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white/8 rounded-xl p-6 border border-white/8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/55 text-sm">Teams</p>
              <p className="text-3xl font-bold text-white mt-1">{teamRankings.length}</p>
            </div>
            <div className="w-12 h-12 bg-[#6c5ce7]/40 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Team Rankings */}
        <div className="bg-white/8 rounded-xl border border-white/8">
          <div className="px-6 py-4 border-b border-white/8">
            <h2 className="text-lg font-semibold text-white">Team Rankings</h2>
            <p className="text-white/55 text-sm">Current season by attendance rate</p>
          </div>
          <div className="p-6">
            {teamRankings.length === 0 ? (
              <p className="text-white/55 text-center py-4">No data available</p>
            ) : (
              <div className="space-y-4">
                {teamRankings.map((ranking: any) => (
                  <div key={ranking.team.id} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        ranking.rank === 1
                          ? "bg-yellow-500"
                          : ranking.rank === 2
                          ? "bg-white/20"
                          : ranking.rank === 3
                          ? "bg-amber-700"
                          : "bg-white/8"
                      }`}
                    >
                      {ranking.rank}
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-white font-medium">{ranking.team.name}</p>
                      <p className="text-white/55 text-sm">{ranking.team.memberCount} members</p>
                    </div>
                    <div className="w-32">
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-sm font-bold ${
                            ranking.attendancePercent >= 90
                              ? "text-green-500"
                              : ranking.attendancePercent >= 75
                              ? "text-yellow-500"
                              : "text-red-500"
                          }`}
                        >
                          {Math.round(ranking.attendancePercent)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-white/8 rounded-full">
                        <div
                          className={`h-2 rounded-full ${
                            ranking.attendancePercent >= 90
                              ? "bg-green-500"
                              : ranking.attendancePercent >= 75
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(100, ranking.attendancePercent)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Individual Leaderboard */}
        <div className="bg-white/8 rounded-xl border border-white/8">
          <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Top Athletes</h2>
              <p className="text-white/55 text-sm">Individual rankings</p>
            </div>
            <select
              value={selectedTeamId || ""}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="px-3 py-1.5 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
            >
              {currentSeasonTeams.map((team: any) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <div className="p-6">
            {leaderboardLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6c5ce7]"></div>
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-white/55 text-center py-4">No data available</p>
            ) : (
              <div className="space-y-3">
                {leaderboard.slice(0, 10).map((entry: any) => (
                  <div key={entry.user.id} className="flex items-center">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        entry.rank === 1
                          ? "bg-yellow-500 text-black"
                          : entry.rank === 2
                          ? "bg-white/20 text-white"
                          : entry.rank === 3
                          ? "bg-amber-700 text-white"
                          : "bg-white/8 text-white"
                      }`}
                    >
                      {entry.rank}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-xs font-medium ml-3">
                      {entry.user.firstName[0]}
                      {entry.user.lastName[0]}
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-white text-sm font-medium">
                        {entry.user.firstName} {entry.user.lastName}
                      </p>
                      <p className="text-white/55 text-xs">
                        {entry.hoursLogged.toFixed(1)} / {entry.hoursRequired}h
                      </p>
                    </div>
                    <span
                      className={`font-bold text-sm ${
                        entry.attendancePercent >= 90
                          ? "text-green-500"
                          : entry.attendancePercent >= 75
                          ? "text-yellow-500"
                          : "text-red-500"
                      }`}
                    >
                      {Math.round(entry.attendancePercent)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
