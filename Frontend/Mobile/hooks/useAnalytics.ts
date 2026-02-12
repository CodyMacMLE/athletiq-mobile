import { useQuery } from "@apollo/client";
import {
  GET_USER_STATS,
  GET_TEAM_LEADERBOARD,
  GET_ORGANIZATION_LEADERBOARD,
  GET_TEAM_RANKINGS,
  GET_RECENT_ACTIVITY,
} from "@/lib/graphql";
import { useAuth } from "@/contexts/AuthContext";

type TimeRange = "WEEK" | "MONTH" | "ALL";

export function useUserStats(timeRange: TimeRange = "WEEK") {
  const { user, selectedOrganization, selectedTeamId } = useAuth();

  const { data, loading, error, refetch } = useQuery(GET_USER_STATS, {
    variables: {
      userId: user?.id,
      organizationId: selectedOrganization?.id,
      teamId: selectedTeamId,
      timeRange,
    },
    skip: !user?.id || !selectedOrganization?.id,
  });

  return {
    stats: data?.userStats || null,
    isLoading: loading,
    error,
    refetch,
  };
}

export function useTeamLeaderboard(timeRange: TimeRange = "WEEK", limit = 10) {
  const { selectedTeamId } = useAuth();

  const { data, loading, error, refetch } = useQuery(GET_TEAM_LEADERBOARD, {
    variables: {
      teamId: selectedTeamId,
      timeRange,
      limit,
    },
    skip: !selectedTeamId,
  });

  return {
    leaderboard: data?.teamLeaderboard || [],
    isLoading: loading,
    error,
    refetch,
  };
}

export function useOrganizationLeaderboard(timeRange: TimeRange = "WEEK", limit = 10) {
  const { selectedOrganization } = useAuth();

  const { data, loading, error, refetch } = useQuery(GET_ORGANIZATION_LEADERBOARD, {
    variables: {
      organizationId: selectedOrganization?.id,
      timeRange,
      limit,
    },
    skip: !selectedOrganization?.id,
  });

  return {
    leaderboard: data?.organizationLeaderboard || [],
    isLoading: loading,
    error,
    refetch,
  };
}

export function useTeamRankings(timeRange: TimeRange = "WEEK") {
  const { selectedOrganization } = useAuth();

  const { data, loading, error, refetch } = useQuery(GET_TEAM_RANKINGS, {
    variables: {
      organizationId: selectedOrganization?.id,
      timeRange,
    },
    skip: !selectedOrganization?.id,
  });

  return {
    rankings: data?.teamRankings || [],
    isLoading: loading,
    error,
    refetch,
  };
}

export function useRecentActivity(limit = 20) {
  const { selectedOrganization } = useAuth();

  const { data, loading, error, refetch } = useQuery(GET_RECENT_ACTIVITY, {
    variables: {
      organizationId: selectedOrganization?.id,
      limit,
    },
    skip: !selectedOrganization?.id,
    pollInterval: 30000, // Refresh every 30 seconds
  });

  return {
    activity: data?.recentActivity || [],
    isLoading: loading,
    error,
    refetch,
  };
}
