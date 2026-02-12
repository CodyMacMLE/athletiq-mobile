"use client";

import { useQuery } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { GET_ORGANIZATION, GET_ORGANIZATION_STATS, GET_PENDING_EXCUSE_REQUESTS, GET_PENDING_AD_HOC_CHECK_INS } from "@/lib/graphql";
import { Users, Calendar, TrendingUp, AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const { selectedOrganizationId, canEdit } = useAuth();

  const { data: orgData, loading: orgLoading } = useQuery(GET_ORGANIZATION, {
    variables: { id: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const { data: statsData, loading: statsLoading } = useQuery(GET_ORGANIZATION_STATS, {
    variables: { organizationId: selectedOrganizationId, timeRange: "MONTH" },
    skip: !selectedOrganizationId,
  });

  const { data: excusesData } = useQuery(GET_PENDING_EXCUSE_REQUESTS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const { data: adHocData } = useQuery(GET_PENDING_AD_HOC_CHECK_INS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const org = orgData?.organization;
  const teamRankings = statsData?.teamRankings || [];
  const pendingExcuses = excusesData?.pendingExcuseRequests || [];
  const pendingAdHocCheckIns = adHocData?.pendingAdHocCheckIns || [];

  if (orgLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{org?.name || "Dashboard"}</h1>
        <p className="text-gray-400 mt-1">Organization overview and quick stats</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Athletes</p>
              <p className="text-3xl font-bold text-white mt-1">{org?.memberCount || 0}</p>
            </div>
            <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-500" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Teams</p>
              <p className="text-3xl font-bold text-white mt-1">{org?.teams?.length || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Avg Attendance</p>
              <p className="text-3xl font-bold text-white mt-1">
                {teamRankings.length > 0
                  ? Math.round(
                      teamRankings.reduce((sum: number, t: any) => sum + t.attendancePercent, 0) /
                        teamRankings.length
                    )
                  : 0}
                %
              </p>
            </div>
            <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Pending Excuses</p>
              <p className="text-3xl font-bold text-white mt-1">{pendingExcuses.length}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-600/20 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Pending Ad-Hoc Check-Ins Banner */}
      {pendingAdHocCheckIns.length > 0 && (
        <Link
          href="/attendance"
          className="block mb-8 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 hover:bg-yellow-500/15 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-white font-medium">
                  {pendingAdHocCheckIns.length} Pending Ad-Hoc Check-In{pendingAdHocCheckIns.length !== 1 ? "s" : ""}
                </p>
                <p className="text-gray-400 text-sm">Review and approve athlete ad-hoc check-ins</p>
              </div>
            </div>
            <span className="text-gray-400 text-sm">View &rarr;</span>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Team Rankings */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">Team Rankings</h2>
            <p className="text-gray-400 text-sm">This month's attendance</p>
          </div>
          <div className="p-6">
            {teamRankings.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No data available</p>
            ) : (
              <div className="space-y-4">
                {teamRankings.map((ranking: any) => (
                  <div key={ranking.team.id} className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold text-sm">
                      {ranking.rank}
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-white font-medium">{ranking.team.name}</p>
                      <p className="text-gray-400 text-sm">{ranking.team.memberCount} members</p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          ranking.attendancePercent >= 90
                            ? "text-green-500"
                            : ranking.attendancePercent >= 75
                            ? "text-yellow-500"
                            : "text-red-500"
                        }`}
                      >
                        {Math.round(ranking.attendancePercent)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending Excuse Requests */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">Pending Excuse Requests</h2>
            <p className="text-gray-400 text-sm">Requires approval</p>
          </div>
          <div className="p-6">
            {pendingExcuses.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No pending requests</p>
            ) : (
              <div className="space-y-4">
                {pendingExcuses.slice(0, 5).map((excuse: any) => (
                  <div key={excuse.id} className="flex items-start justify-between">
                    <div className="flex items-start">
                      <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium text-sm">
                        {excuse.user.firstName[0]}
                        {excuse.user.lastName[0]}
                      </div>
                      <div className="ml-3">
                        <p className="text-white font-medium">
                          {excuse.user.firstName} {excuse.user.lastName}
                        </p>
                        <p className="text-gray-400 text-sm">{excuse.event.title}</p>
                        <p className="text-gray-500 text-xs mt-1 truncate max-w-xs">{excuse.reason}</p>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex space-x-2">
                        <button className="p-1.5 bg-green-600/20 text-green-500 rounded hover:bg-green-600/30 transition-colors">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 bg-red-600/20 text-red-500 rounded hover:bg-red-600/30 transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
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
