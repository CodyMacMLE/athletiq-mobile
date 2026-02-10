import { useAuth } from "@/contexts/AuthContext";
import {
  GET_ORGANIZATION_LEADERBOARD,
  GET_TEAM_LEADERBOARD,
  GET_TEAM_RANKINGS,
  GET_USER_STATS,
} from "@/lib/graphql/queries";
import { useQuery } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const AVATAR_SIZE = 45;

type TimeRange = "week" | "month" | "all";

const TIME_RANGE_MAP: Record<TimeRange, string> = {
  week: "WEEK",
  month: "MONTH",
  all: "ALL",
};

export default function Analytics() {
  const router = useRouter();
  const { user, selectedOrganization, selectedTeamId } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>("week");

  const apiTimeRange = TIME_RANGE_MAP[timeRange];

  const { data: statsData, loading: statsLoading } = useQuery(GET_USER_STATS, {
    variables: {
      userId: user?.id,
      organizationId: selectedOrganization?.id,
      timeRange: apiTimeRange,
    },
    skip: !user?.id || !selectedOrganization?.id,
  });

  const { data: teamLbData, loading: teamLbLoading } = useQuery(GET_TEAM_LEADERBOARD, {
    variables: {
      teamId: selectedTeamId,
      timeRange: apiTimeRange,
      limit: 5,
    },
    skip: !selectedTeamId,
  });

  const { data: orgLbData, loading: orgLbLoading } = useQuery(GET_ORGANIZATION_LEADERBOARD, {
    variables: {
      organizationId: selectedOrganization?.id,
      timeRange: apiTimeRange,
      limit: 5,
    },
    skip: !selectedOrganization?.id,
  });

  const { data: teamRankData, loading: teamRankLoading } = useQuery(GET_TEAM_RANKINGS, {
    variables: {
      organizationId: selectedOrganization?.id,
      timeRange: apiTimeRange,
    },
    skip: !selectedOrganization?.id,
  });

  const stats = statsData?.userStats;
  const teamLeaderboard = teamLbData?.teamLeaderboard || [];
  const orgLeaderboard = orgLbData?.organizationLeaderboard || [];
  const teamRankings = teamRankData?.teamRankings || [];

  // Find current user's team ranking
  const currentTeamRanking = teamRankings.find((t: any) => t.team.id === selectedTeamId);

  const getPercentColor = (percent: number) => {
    if (percent >= 90) return "#27ae60";
    if (percent >= 75) return "#f39c12";
    return "#e74c3c";
  };

  if (!user || !selectedOrganization) return null;

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Analytics</Text>
        </View>

        {user.image ? (
          <Image
            source={user.image}
            style={[styles.avatar, styles.avatarImage]}
          />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.firstName.charAt(0)}
              {user.lastName.charAt(0)}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Time Range Selector */}
        <View style={styles.timeRangeTabs}>
          {(["week", "month", "all"] as TimeRange[]).map((range) => (
            <Pressable
              key={range}
              style={[
                styles.timeRangeTab,
                timeRange === range && styles.timeRangeTabActive,
              ]}
              onPress={() => setTimeRange(range)}
            >
              <Text
                style={[
                  styles.timeRangeText,
                  timeRange === range && styles.timeRangeTextActive,
                ]}
              >
                {range === "all" ? "All Time" : range.charAt(0).toUpperCase() + range.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Attendance Overview Card */}
        {statsLoading ? (
          <View style={[styles.overviewCard, { alignItems: "center", paddingVertical: 40 }]}>
            <ActivityIndicator color="#a855f7" />
          </View>
        ) : (
          <View style={styles.overviewCard}>
            <View style={styles.overviewMain}>
              <View style={styles.percentCircle}>
                <Text style={styles.percentValue}>{stats?.attendancePercent ?? 0}%</Text>
                <Text style={styles.percentLabel}>Attendance</Text>
              </View>
              <View style={styles.overviewDetails}>
                <View style={styles.overviewRow}>
                  <Text style={styles.overviewLabel}>Hours Logged</Text>
                  <Text style={styles.overviewValue}>{stats?.hoursLogged ?? 0}h</Text>
                </View>
                <View style={styles.overviewRow}>
                  <Text style={styles.overviewLabel}>Hours Required</Text>
                  <Text style={styles.overviewValue}>{stats?.hoursRequired ?? 0}h</Text>
                </View>
                <View style={styles.overviewRow}>
                  <Text style={styles.overviewLabel}>Current Streak</Text>
                  <View style={styles.streakValue}>
                    <Feather name="zap" size={14} color="#f39c12" />
                    <Text style={styles.overviewValue}>{stats?.currentStreak ?? 0} days</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Rankings Summary */}
        <View style={styles.rankingsRow}>
          <View style={styles.rankCard}>
            <Text style={styles.rankCardLabel}>Team Rank</Text>
            <Text style={styles.rankCardValue}>#{stats?.teamRank ?? "-"}</Text>
            <Text style={styles.rankCardSub}>of {stats?.teamSize ?? "-"}</Text>
          </View>
          <View style={styles.rankCard}>
            <Text style={styles.rankCardLabel}>Org Rank</Text>
            <Text style={styles.rankCardValue}>#{stats?.orgRank ?? "-"}</Text>
            <Text style={styles.rankCardSub}>of {stats?.orgSize ?? "-"}</Text>
          </View>
          <View style={[styles.rankCard, styles.rankCardHighlight]}>
            <Text style={styles.rankCardLabel}>Team Standing</Text>
            <Text style={styles.rankCardValue}>
              #{currentTeamRanking?.rank ?? "-"}
            </Text>
            <Text style={styles.rankCardSub}>of {teamRankings.length || "-"} teams</Text>
          </View>
        </View>

        {/* Team Leaderboard */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Team Leaderboard</Text>
            </View>
            <Pressable onPress={() => router.push("/leaderboard")}>
              <Text style={styles.seeAll}>See All</Text>
            </Pressable>
          </View>

          {teamLbLoading ? (
            <View style={[styles.leaderboardContainer, { paddingVertical: 24, alignItems: "center" }]}>
              <ActivityIndicator color="#a855f7" />
            </View>
          ) : teamLeaderboard.length === 0 ? (
            <View style={[styles.leaderboardContainer, { paddingVertical: 24, alignItems: "center" }]}>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>No data yet</Text>
            </View>
          ) : (
            <View style={styles.leaderboardContainer}>
              {teamLeaderboard.map((entry: any, index: number) => {
                const isCurrentUser = entry.user.id === user.id;
                return (
                  <View
                    key={entry.user.id}
                    style={[
                      styles.leaderboardItem,
                      isCurrentUser && styles.leaderboardItemHighlight,
                      index < teamLeaderboard.length - 1 &&
                        styles.leaderboardItemBorder,
                    ]}
                  >
                    <View style={styles.leaderboardRank}>
                      {index < 3 ? (
                        <View
                          style={[
                            styles.medalBadge,
                            index === 0 && styles.medalGold,
                            index === 1 && styles.medalSilver,
                            index === 2 && styles.medalBronze,
                          ]}
                        >
                          <Text style={styles.medalText}>{entry.rank}</Text>
                        </View>
                      ) : (
                        <Text style={styles.rankText}>{entry.rank}</Text>
                      )}
                    </View>

                    <View style={styles.leaderboardAvatar}>
                      <Text style={styles.leaderboardAvatarText}>
                        {entry.user.firstName?.[0]}{entry.user.lastName?.[0]}
                      </Text>
                    </View>

                    <View style={styles.leaderboardInfo}>
                      <Text
                        style={[
                          styles.leaderboardName,
                          isCurrentUser && styles.leaderboardNameHighlight,
                        ]}
                      >
                        {entry.user.firstName} {entry.user.lastName}
                        {isCurrentUser && " (You)"}
                      </Text>
                      <Text style={styles.leaderboardHours}>
                        {entry.hoursLogged}h / {entry.hoursRequired}h
                      </Text>
                    </View>

                    <View style={styles.leaderboardRate}>
                      <Text
                        style={[
                          styles.leaderboardRateValue,
                          { color: getPercentColor(entry.attendancePercent) },
                        ]}
                      >
                        {entry.attendancePercent}%
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Organization Leaderboard */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Organization Leaders</Text>
              <Text style={styles.sectionSubtitle}>Top performers across all teams</Text>
            </View>
          </View>

          {orgLbLoading ? (
            <View style={[styles.leaderboardContainer, { paddingVertical: 24, alignItems: "center" }]}>
              <ActivityIndicator color="#a855f7" />
            </View>
          ) : orgLeaderboard.length === 0 ? (
            <View style={[styles.leaderboardContainer, { paddingVertical: 24, alignItems: "center" }]}>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>No data yet</Text>
            </View>
          ) : (
            <View style={styles.leaderboardContainer}>
              {orgLeaderboard.map((entry: any, index: number) => (
                <View
                  key={entry.user.id}
                  style={[
                    styles.leaderboardItem,
                    index < orgLeaderboard.length - 1 && styles.leaderboardItemBorder,
                  ]}
                >
                  <View style={styles.leaderboardRank}>
                    {index < 3 ? (
                      <View
                        style={[
                          styles.medalBadge,
                          index === 0 && styles.medalGold,
                          index === 1 && styles.medalSilver,
                          index === 2 && styles.medalBronze,
                        ]}
                      >
                        <Text style={styles.medalText}>{entry.rank}</Text>
                      </View>
                    ) : (
                      <Text style={styles.rankText}>{entry.rank}</Text>
                    )}
                  </View>

                  <View style={styles.leaderboardAvatar}>
                    <Text style={styles.leaderboardAvatarText}>
                      {entry.user.firstName?.[0]}{entry.user.lastName?.[0]}
                    </Text>
                  </View>

                  <View style={styles.leaderboardInfo}>
                    <Text style={styles.leaderboardName}>
                      {entry.user.firstName} {entry.user.lastName}
                    </Text>
                    <Text style={styles.leaderboardHours}>
                      {entry.hoursLogged}h / {entry.hoursRequired}h
                    </Text>
                  </View>

                  <View style={styles.leaderboardRate}>
                    <Text
                      style={[
                        styles.leaderboardRateValue,
                        { color: getPercentColor(entry.attendancePercent) },
                      ]}
                    >
                      {entry.attendancePercent}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Team Rankings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Team Rankings</Text>
              <Text style={styles.sectionSubtitle}>How teams compare</Text>
            </View>
          </View>

          {teamRankLoading ? (
            <View style={[styles.leaderboardContainer, { paddingVertical: 24, alignItems: "center" }]}>
              <ActivityIndicator color="#a855f7" />
            </View>
          ) : teamRankings.length === 0 ? (
            <View style={[styles.leaderboardContainer, { paddingVertical: 24, alignItems: "center" }]}>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>No data yet</Text>
            </View>
          ) : (
            <View style={styles.leaderboardContainer}>
              {teamRankings.map((team: any, index: number) => {
                const isCurrentTeam = team.team.id === selectedTeamId;
                return (
                  <View
                    key={team.team.id}
                    style={[
                      styles.leaderboardItem,
                      isCurrentTeam && styles.leaderboardItemHighlight,
                      index < teamRankings.length - 1 && styles.leaderboardItemBorder,
                    ]}
                  >
                    <View style={styles.leaderboardRank}>
                      {index < 3 ? (
                        <View
                          style={[
                            styles.medalBadge,
                            index === 0 && styles.medalGold,
                            index === 1 && styles.medalSilver,
                            index === 2 && styles.medalBronze,
                          ]}
                        >
                          <Text style={styles.medalText}>{team.rank}</Text>
                        </View>
                      ) : (
                        <Text style={styles.rankText}>{team.rank}</Text>
                      )}
                    </View>

                    <View style={[styles.teamIcon, team.team.color ? { backgroundColor: team.team.color + "33" } : undefined]}>
                      {team.team.color ? (
                        <View style={[styles.teamColorDot, { backgroundColor: team.team.color }]} />
                      ) : (
                        <Feather name="users" size={16} color="rgba(255,255,255,0.6)" />
                      )}
                    </View>

                    <View style={styles.leaderboardInfo}>
                      <Text
                        style={[
                          styles.leaderboardName,
                          isCurrentTeam && styles.leaderboardNameHighlight,
                        ]}
                      >
                        {team.team.name}
                        {isCurrentTeam && " (Your Team)"}
                      </Text>
                      <Text style={styles.leaderboardHours}>
                        {[team.team.sport, team.team.season, `${team.team.memberCount} members`].filter(Boolean).join(" · ")}
                      </Text>
                    </View>

                    <View style={styles.leaderboardRate}>
                      <Text
                        style={[
                          styles.leaderboardRateValue,
                          { color: getPercentColor(team.attendancePercent) },
                        ]}
                      >
                        {team.attendancePercent}%
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingTop: 80,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    gap: 4,
  },
  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "#241e4a",
    borderWidth: 0.5,
    borderColor: "#463e70",
  },
  avatarImage: {
    backgroundColor: "transparent",
  },
  avatarText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },

  // Time Range Tabs
  timeRangeTabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 3,
    marginTop: 16,
  },
  timeRangeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  timeRangeTabActive: {
    backgroundColor: "#6c5ce7",
  },
  timeRangeText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "500",
  },
  timeRangeTextActive: {
    color: "white",
  },

  // Overview Card
  overviewCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  overviewMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  percentCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(108,92,231,0.2)",
    borderWidth: 3,
    borderColor: "#6c5ce7",
    justifyContent: "center",
    alignItems: "center",
  },
  percentValue: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  percentLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    marginTop: 2,
  },
  overviewDetails: {
    flex: 1,
    gap: 10,
  },
  overviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  overviewLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },
  overviewValue: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  streakValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  // Rankings Row
  rankingsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  rankCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  rankCardHighlight: {
    backgroundColor: "rgba(168,85,247,0.15)",
    borderColor: "rgba(168,85,247,0.3)",
  },
  rankCardLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "500",
  },
  rankCardValue: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 4,
  },
  rankCardSub: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    marginTop: 2,
  },

  // Sections
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "600",
  },
  sectionSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 2,
  },
  seeAll: {
    color: "#a855f7",
    fontSize: 14,
    fontWeight: "500",
  },

  // Leaderboard
  leaderboardContainer: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  leaderboardItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  leaderboardItemHighlight: {
    backgroundColor: "rgba(108,92,231,0.15)",
  },
  leaderboardItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  leaderboardRank: {
    width: 28,
    alignItems: "center",
  },
  medalBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  medalGold: {
    backgroundColor: "#f39c12",
  },
  medalSilver: {
    backgroundColor: "#95a5a6",
  },
  medalBronze: {
    backgroundColor: "#cd6133",
  },
  medalText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  rankText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "600",
  },
  leaderboardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#241e4a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#463e70",
  },
  leaderboardAvatarText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  teamIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  teamColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  leaderboardNameHighlight: {
    color: "#a855f7",
  },
  leaderboardHours: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 2,
  },
  leaderboardRate: {
    alignItems: "flex-end",
  },
  leaderboardRateValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
