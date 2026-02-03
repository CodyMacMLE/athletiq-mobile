import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type User = {
  image?: string;
  firstName: string;
  lastName: string;
};

type TeamMember = {
  id: string;
  name: string;
  image?: string;
  attendancePercent: number; // % of required hours attended
  hoursLogged: number;
  hoursRequired: number;
  isCurrentUser?: boolean;
};

type Team = {
  id: string;
  name: string;
  attendancePercent: number;
  memberCount: number;
  isCurrentTeam?: boolean;
};

type TimeRange = "week" | "month" | "all";

const user: User = {
  image: undefined,
  firstName: "Cody",
  lastName: "MacDonald",
};

const AVATAR_SIZE = 45;

// Mock user stats
const userStats = {
  // Hours this period
  hoursLogged: 14.5,
  hoursRequired: 16,
  attendancePercent: 91,

  // Rankings
  teamRank: 3,
  teamSize: 18,
  orgRank: 12,
  orgSize: 156,

  // Streaks
  currentStreak: 5,
  bestStreak: 12,

  // Team info
  teamName: "Varsity",
  teamAttendancePercent: 87,
  teamOrgRank: 2,
  totalTeams: 8,
};

// Mock team leaderboard (your teammates)
const teamLeaderboard: TeamMember[] = [
  { id: "1", name: "Sarah Chen", attendancePercent: 98, hoursLogged: 15.7, hoursRequired: 16 },
  { id: "2", name: "Marcus Lee", attendancePercent: 94, hoursLogged: 15.0, hoursRequired: 16 },
  { id: "3", name: "Cody MacDonald", attendancePercent: 91, hoursLogged: 14.5, hoursRequired: 16, isCurrentUser: true },
  { id: "4", name: "Ava Torres", attendancePercent: 88, hoursLogged: 14.1, hoursRequired: 16 },
  { id: "5", name: "Jake Wilson", attendancePercent: 85, hoursLogged: 13.6, hoursRequired: 16 },
  { id: "6", name: "Emma Davis", attendancePercent: 82, hoursLogged: 13.1, hoursRequired: 16 },
];

// Mock organization leaderboard (top performers across all teams)
const orgLeaderboard: TeamMember[] = [
  { id: "1", name: "Alex Rivera", attendancePercent: 100, hoursLogged: 12, hoursRequired: 12 },
  { id: "2", name: "Jordan Kim", attendancePercent: 99, hoursLogged: 19.8, hoursRequired: 20 },
  { id: "3", name: "Sarah Chen", attendancePercent: 98, hoursLogged: 15.7, hoursRequired: 16 },
  { id: "4", name: "Taylor Smith", attendancePercent: 97, hoursLogged: 9.7, hoursRequired: 10 },
  { id: "5", name: "Casey Morgan", attendancePercent: 96, hoursLogged: 14.4, hoursRequired: 15 },
];

// Mock team rankings in organization
const teamRankings: Team[] = [
  { id: "1", name: "Junior Elite", attendancePercent: 94, memberCount: 12 },
  { id: "2", name: "Varsity", attendancePercent: 87, memberCount: 18, isCurrentTeam: true },
  { id: "3", name: "Development", attendancePercent: 85, memberCount: 24 },
  { id: "4", name: "Masters", attendancePercent: 83, memberCount: 15 },
  { id: "5", name: "Recreational", attendancePercent: 79, memberCount: 32 },
];

export default function Analytics() {
  const [timeRange, setTimeRange] = useState<TimeRange>("week");

  const getPercentColor = (percent: number) => {
    if (percent >= 90) return "#27ae60";
    if (percent >= 75) return "#f39c12";
    return "#e74c3c";
  };

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
        <View style={styles.overviewCard}>
          <View style={styles.overviewMain}>
            <View style={styles.percentCircle}>
              <Text style={styles.percentValue}>{userStats.attendancePercent}%</Text>
              <Text style={styles.percentLabel}>Attendance</Text>
            </View>
            <View style={styles.overviewDetails}>
              <View style={styles.overviewRow}>
                <Text style={styles.overviewLabel}>Hours Logged</Text>
                <Text style={styles.overviewValue}>{userStats.hoursLogged}h</Text>
              </View>
              <View style={styles.overviewRow}>
                <Text style={styles.overviewLabel}>Hours Required</Text>
                <Text style={styles.overviewValue}>{userStats.hoursRequired}h</Text>
              </View>
              <View style={styles.overviewRow}>
                <Text style={styles.overviewLabel}>Current Streak</Text>
                <View style={styles.streakValue}>
                  <Feather name="zap" size={14} color="#f39c12" />
                  <Text style={styles.overviewValue}>{userStats.currentStreak} days</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Rankings Summary */}
        <View style={styles.rankingsRow}>
          <View style={styles.rankCard}>
            <Text style={styles.rankCardLabel}>Team Rank</Text>
            <Text style={styles.rankCardValue}>#{userStats.teamRank}</Text>
            <Text style={styles.rankCardSub}>of {userStats.teamSize}</Text>
          </View>
          <View style={styles.rankCard}>
            <Text style={styles.rankCardLabel}>Org Rank</Text>
            <Text style={styles.rankCardValue}>#{userStats.orgRank}</Text>
            <Text style={styles.rankCardSub}>of {userStats.orgSize}</Text>
          </View>
          <View style={[styles.rankCard, styles.rankCardHighlight]}>
            <Text style={styles.rankCardLabel}>Team Standing</Text>
            <Text style={styles.rankCardValue}>#{userStats.teamOrgRank}</Text>
            <Text style={styles.rankCardSub}>of {userStats.totalTeams} teams</Text>
          </View>
        </View>

        {/* Team Leaderboard */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Team Leaderboard</Text>
              <Text style={styles.sectionSubtitle}>{userStats.teamName}</Text>
            </View>
            <Text style={styles.seeAll}>See All</Text>
          </View>

          <View style={styles.leaderboardContainer}>
            {teamLeaderboard.slice(0, 5).map((entry, index) => (
              <View
                key={entry.id}
                style={[
                  styles.leaderboardItem,
                  entry.isCurrentUser && styles.leaderboardItemHighlight,
                  index < teamLeaderboard.slice(0, 5).length - 1 &&
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
                      <Text style={styles.medalText}>{index + 1}</Text>
                    </View>
                  ) : (
                    <Text style={styles.rankText}>{index + 1}</Text>
                  )}
                </View>

                <View style={styles.leaderboardAvatar}>
                  <Text style={styles.leaderboardAvatarText}>
                    {entry.name.split(" ").map((n) => n[0]).join("")}
                  </Text>
                </View>

                <View style={styles.leaderboardInfo}>
                  <Text
                    style={[
                      styles.leaderboardName,
                      entry.isCurrentUser && styles.leaderboardNameHighlight,
                    ]}
                  >
                    {entry.name}
                    {entry.isCurrentUser && " (You)"}
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
        </View>

        {/* Organization Leaderboard */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Organization Leaders</Text>
              <Text style={styles.sectionSubtitle}>Top performers across all teams</Text>
            </View>
          </View>

          <View style={styles.leaderboardContainer}>
            {orgLeaderboard.map((entry, index) => (
              <View
                key={entry.id}
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
                      <Text style={styles.medalText}>{index + 1}</Text>
                    </View>
                  ) : (
                    <Text style={styles.rankText}>{index + 1}</Text>
                  )}
                </View>

                <View style={styles.leaderboardAvatar}>
                  <Text style={styles.leaderboardAvatarText}>
                    {entry.name.split(" ").map((n) => n[0]).join("")}
                  </Text>
                </View>

                <View style={styles.leaderboardInfo}>
                  <Text style={styles.leaderboardName}>{entry.name}</Text>
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
        </View>

        {/* Team Rankings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Team Rankings</Text>
              <Text style={styles.sectionSubtitle}>How teams compare</Text>
            </View>
          </View>

          <View style={styles.leaderboardContainer}>
            {teamRankings.map((team, index) => (
              <View
                key={team.id}
                style={[
                  styles.leaderboardItem,
                  team.isCurrentTeam && styles.leaderboardItemHighlight,
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
                      <Text style={styles.medalText}>{index + 1}</Text>
                    </View>
                  ) : (
                    <Text style={styles.rankText}>{index + 1}</Text>
                  )}
                </View>

                <View style={styles.teamIcon}>
                  <Feather name="users" size={16} color="rgba(255,255,255,0.6)" />
                </View>

                <View style={styles.leaderboardInfo}>
                  <Text
                    style={[
                      styles.leaderboardName,
                      team.isCurrentTeam && styles.leaderboardNameHighlight,
                    ]}
                  >
                    {team.name}
                    {team.isCurrentTeam && " (Your Team)"}
                  </Text>
                  <Text style={styles.leaderboardHours}>
                    {team.memberCount} members
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
            ))}
          </View>
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
