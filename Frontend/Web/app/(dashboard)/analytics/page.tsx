"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { GET_ORGANIZATION_STATS, GET_TEAMS, GET_TEAM_LEADERBOARD, GET_ATTENDANCE_TRENDS } from "@/lib/graphql";
import { TrendingUp, Users, Award, Download } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

type TimeRange = "WEEK" | "MONTH" | "ALL";

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function exportLeaderboardCsv(leaderboard: any[], teamName?: string) {
  const header = "Rank,Name,Team,Hours Logged,Hours Required,Attendance %";
  const rows = leaderboard.map((entry: any) =>
    [
      entry.rank,
      `"${entry.user.firstName} ${entry.user.lastName}"`,
      `"${teamName ?? ""}"`,
      entry.hoursLogged.toFixed(1),
      entry.hoursRequired,
      Math.round(entry.attendancePercent),
    ].join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leaderboard-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

function TrendTooltip({ active, payload, label }: TrendTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-[#1a1a2e] border border-white/15 rounded-lg p-3 text-sm">
      <p className="text-white font-semibold mb-1">{label}</p>
      <p className="text-[#6c5ce7]">Attendance: {d.attendancePercent.toFixed(1)}%</p>
      <p className="text-white/70">Hours logged: {d.hoursLogged.toFixed(1)}h</p>
      <p className="text-white/55">Hours required: {d.hoursRequired.toFixed(1)}h</p>
      <p className="text-white/55">Events: {d.eventsCount}</p>
    </div>
  );
}

export default function Analytics() {
  const { selectedOrganizationId } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>("MONTH");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [trendTeamId, setTrendTeamId] = useState<string | null>(null);

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

  const { data: trendsData, loading: trendsLoading } = useQuery<any>(GET_ATTENDANCE_TRENDS, {
    variables: {
      organizationId: selectedOrganizationId,
      ...(trendTeamId ? { teamId: trendTeamId } : {}),
    },
    skip: !selectedOrganizationId,
  });

  const teams = teamsData?.teams || [];
  const teamRankings = statsData?.teamRankings || [];
  const leaderboard = leaderboardData?.teamLeaderboard || [];
  const trendPoints = trendsData?.attendanceTrends || [];

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

  const selectedTeamName = currentSeasonTeams.find((t: any) => t.id === selectedTeamId)?.name;

  const chartData = trendPoints.map((p: any) => ({
    ...p,
    weekLabel: formatWeekLabel(p.weekStart),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-white/55 mt-1">Organization performance and insights</p>
        </div>

        <div className="flex items-center space-x-3">
          {/* CSV Export */}
          <button
            onClick={() => exportLeaderboardCsv(leaderboard, selectedTeamName)}
            disabled={leaderboard.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/8 text-white/70 hover:text-white hover:bg-white/12 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

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
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/8 rounded-xl p-6 border border-white/8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/55 text-sm">Total Athletes</p>
              <p className="text-3xl font-bold text-white mt-1">{totalMembers}</p>
            </div>
            <div className="w-12 h-12 bg-[#a855f7]/50 rounded-lg flex items-center justify-center">
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
            <div className="w-12 h-12 bg-green-600/50 rounded-lg flex items-center justify-center">
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
            <div className="w-12 h-12 bg-blue-600/50 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
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

      {/* Attendance Trend Chart */}
      <div className="bg-white/8 rounded-xl border border-white/8">
        <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Attendance Trend</h2>
            <p className="text-white/55 text-sm">Weekly attendance percentage across the season</p>
          </div>
          <select
            value={trendTeamId || ""}
            onChange={(e) => setTrendTeamId(e.target.value || null)}
            className="px-3 py-1.5 bg-white/8 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
          >
            <option value="">Org-wide</option>
            {currentSeasonTeams.map((team: any) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
        <div className="p-6">
          {trendsLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6c5ce7]"></div>
            </div>
          ) : chartData.length === 0 ? (
            <p className="text-white/55 text-center py-12">No weekly data available yet</p>
          ) : (
            <>
              <div className="flex items-center gap-6 mb-4 text-xs text-white/55">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-0.5 bg-green-500"></span>
                  90% target
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-0.5 bg-yellow-500"></span>
                  75% threshold
                </span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6c5ce7" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6c5ce7" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="weekLabel"
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip content={<TrendTooltip />} />
                  <ReferenceLine y={90} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.6} />
                  <ReferenceLine y={75} stroke="#eab308" strokeDasharray="4 4" strokeOpacity={0.6} />
                  <Area
                    type="monotone"
                    dataKey="attendancePercent"
                    stroke="#6c5ce7"
                    strokeWidth={2}
                    fill="url(#trendGradient)"
                    dot={{ r: 3, fill: "#6c5ce7", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#6c5ce7" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
