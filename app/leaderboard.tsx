import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type LeaderboardTab = "team" | "organization";

type TeamMember = {
  id: string;
  name: string;
  image?: string;
  attendancePercent: number;
  hoursLogged: number;
  hoursRequired: number;
  isCurrentUser?: boolean;
  team?: string;
};

// Mock team leaderboard (your teammates)
const teamLeaderboard: TeamMember[] = [
  { id: "1", name: "Sarah Chen", attendancePercent: 98, hoursLogged: 15.7, hoursRequired: 16 },
  { id: "2", name: "Marcus Lee", attendancePercent: 94, hoursLogged: 15.0, hoursRequired: 16 },
  { id: "3", name: "Cody MacDonald", attendancePercent: 91, hoursLogged: 14.5, hoursRequired: 16, isCurrentUser: true },
  { id: "4", name: "Ava Torres", attendancePercent: 88, hoursLogged: 14.1, hoursRequired: 16 },
  { id: "5", name: "Jake Wilson", attendancePercent: 85, hoursLogged: 13.6, hoursRequired: 16 },
  { id: "6", name: "Emma Davis", attendancePercent: 82, hoursLogged: 13.1, hoursRequired: 16 },
  { id: "7", name: "Liam Brown", attendancePercent: 80, hoursLogged: 12.8, hoursRequired: 16 },
  { id: "8", name: "Olivia Martinez", attendancePercent: 78, hoursLogged: 12.5, hoursRequired: 16 },
  { id: "9", name: "Noah Garcia", attendancePercent: 75, hoursLogged: 12.0, hoursRequired: 16 },
  { id: "10", name: "Sophia Kim", attendancePercent: 72, hoursLogged: 11.5, hoursRequired: 16 },
];

// Mock organization leaderboard (top performers across all teams)
const orgLeaderboard: TeamMember[] = [
  { id: "1", name: "Alex Rivera", attendancePercent: 100, hoursLogged: 12, hoursRequired: 12, team: "Junior Elite" },
  { id: "2", name: "Jordan Kim", attendancePercent: 99, hoursLogged: 19.8, hoursRequired: 20, team: "Masters" },
  { id: "3", name: "Sarah Chen", attendancePercent: 98, hoursLogged: 15.7, hoursRequired: 16, team: "Varsity" },
  { id: "4", name: "Taylor Smith", attendancePercent: 97, hoursLogged: 9.7, hoursRequired: 10, team: "Development" },
  { id: "5", name: "Casey Morgan", attendancePercent: 96, hoursLogged: 14.4, hoursRequired: 15, team: "Junior Elite" },
  { id: "6", name: "Riley Johnson", attendancePercent: 95, hoursLogged: 19.0, hoursRequired: 20, team: "Masters" },
  { id: "7", name: "Quinn Williams", attendancePercent: 94, hoursLogged: 15.0, hoursRequired: 16, team: "Varsity" },
  { id: "8", name: "Marcus Lee", attendancePercent: 94, hoursLogged: 15.0, hoursRequired: 16, team: "Varsity" },
  { id: "9", name: "Avery Brown", attendancePercent: 93, hoursLogged: 9.3, hoursRequired: 10, team: "Development" },
  { id: "10", name: "Morgan Davis", attendancePercent: 92, hoursLogged: 18.4, hoursRequired: 20, team: "Masters" },
  { id: "11", name: "Cameron White", attendancePercent: 91, hoursLogged: 14.6, hoursRequired: 16, team: "Varsity" },
  { id: "12", name: "Cody MacDonald", attendancePercent: 91, hoursLogged: 14.5, hoursRequired: 16, team: "Varsity", isCurrentUser: true },
];

export default function Leaderboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("team");

  const leaderboardData = activeTab === "team" ? teamLeaderboard : orgLeaderboard;

  const getPercentColor = (percent: number) => {
    if (percent >= 90) return "#27ae60";
    if (percent >= 75) return "#f39c12";
    return "#e74c3c";
  };

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.container}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="white" />
        </Pressable>
        <Text style={styles.title}>Leaderboard</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === "team" && styles.tabActive]}
          onPress={() => setActiveTab("team")}
        >
          <Text style={[styles.tabText, activeTab === "team" && styles.tabTextActive]}>
            My Team
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "organization" && styles.tabActive]}
          onPress={() => setActiveTab("organization")}
        >
          <Text style={[styles.tabText, activeTab === "organization" && styles.tabTextActive]}>
            Organization
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top 3 Podium */}
        <View style={styles.podiumContainer}>
          {/* Second Place */}
          <View style={styles.podiumItem}>
            <View style={[styles.podiumAvatar, styles.podiumAvatarSecond]}>
              <Text style={styles.podiumAvatarText}>
                {leaderboardData[1]?.name.split(" ").map((n) => n[0]).join("")}
              </Text>
            </View>
            <View style={[styles.podiumMedal, styles.medalSilver]}>
              <Text style={styles.medalText}>2</Text>
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>
              {leaderboardData[1]?.name.split(" ")[0]}
            </Text>
            <Text style={styles.podiumPercent}>{leaderboardData[1]?.attendancePercent}%</Text>
            <View style={[styles.podiumBar, styles.podiumBarSecond]} />
          </View>

          {/* First Place */}
          <View style={styles.podiumItem}>
            <View style={[styles.podiumAvatar, styles.podiumAvatarFirst]}>
              <Text style={styles.podiumAvatarText}>
                {leaderboardData[0]?.name.split(" ").map((n) => n[0]).join("")}
              </Text>
            </View>
            <View style={[styles.podiumMedal, styles.medalGold]}>
              <Text style={styles.medalText}>1</Text>
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>
              {leaderboardData[0]?.name.split(" ")[0]}
            </Text>
            <Text style={styles.podiumPercent}>{leaderboardData[0]?.attendancePercent}%</Text>
            <View style={[styles.podiumBar, styles.podiumBarFirst]} />
          </View>

          {/* Third Place */}
          <View style={styles.podiumItem}>
            <View style={[styles.podiumAvatar, styles.podiumAvatarThird]}>
              <Text style={styles.podiumAvatarText}>
                {leaderboardData[2]?.name.split(" ").map((n) => n[0]).join("")}
              </Text>
            </View>
            <View style={[styles.podiumMedal, styles.medalBronze]}>
              <Text style={styles.medalText}>3</Text>
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>
              {leaderboardData[2]?.name.split(" ")[0]}
            </Text>
            <Text style={styles.podiumPercent}>{leaderboardData[2]?.attendancePercent}%</Text>
            <View style={[styles.podiumBar, styles.podiumBarThird]} />
          </View>
        </View>

        {/* Full List */}
        <View style={styles.listContainer}>
          {leaderboardData.map((entry, index) => (
            <View
              key={entry.id}
              style={[
                styles.listItem,
                entry.isCurrentUser && styles.listItemHighlight,
                index < leaderboardData.length - 1 && styles.listItemBorder,
              ]}
            >
              <View style={styles.listRank}>
                {index < 3 ? (
                  <View
                    style={[
                      styles.rankMedal,
                      index === 0 && styles.medalGold,
                      index === 1 && styles.medalSilver,
                      index === 2 && styles.medalBronze,
                    ]}
                  >
                    <Text style={styles.rankMedalText}>{index + 1}</Text>
                  </View>
                ) : (
                  <Text style={styles.rankText}>{index + 1}</Text>
                )}
              </View>

              <View style={styles.listAvatar}>
                <Text style={styles.listAvatarText}>
                  {entry.name.split(" ").map((n) => n[0]).join("")}
                </Text>
              </View>

              <View style={styles.listInfo}>
                <Text style={[styles.listName, entry.isCurrentUser && styles.listNameHighlight]}>
                  {entry.name}
                  {entry.isCurrentUser && " (You)"}
                </Text>
                {entry.team && <Text style={styles.listTeam}>{entry.team}</Text>}
              </View>

              <View style={styles.listStats}>
                <Text style={[styles.listPercent, { color: getPercentColor(entry.attendancePercent) }]}>
                  {entry.attendancePercent}%
                </Text>
                <Text style={styles.listHours}>
                  {entry.hoursLogged}/{entry.hoursRequired}h
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  placeholder: {
    width: 40,
  },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#6c5ce7",
  },
  tabText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "white",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  podiumContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    marginBottom: 24,
    paddingTop: 20,
  },
  podiumItem: {
    alignItems: "center",
    width: 100,
  },
  podiumAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#241e4a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  podiumAvatarFirst: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderColor: "#f39c12",
  },
  podiumAvatarSecond: {
    borderColor: "#bdc3c7",
  },
  podiumAvatarThird: {
    borderColor: "#cd7f32",
  },
  podiumAvatarText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  podiumMedal: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -10,
  },
  podiumName: {
    color: "white",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 6,
  },
  podiumPercent: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 2,
  },
  podiumBar: {
    width: 70,
    borderRadius: 4,
    marginTop: 8,
  },
  podiumBarFirst: {
    height: 80,
    backgroundColor: "rgba(243,156,18,0.3)",
  },
  podiumBarSecond: {
    height: 60,
    backgroundColor: "rgba(189,195,199,0.3)",
  },
  podiumBarThird: {
    height: 45,
    backgroundColor: "rgba(205,127,50,0.3)",
  },
  medalGold: {
    backgroundColor: "#f39c12",
  },
  medalSilver: {
    backgroundColor: "#bdc3c7",
  },
  medalBronze: {
    backgroundColor: "#cd7f32",
  },
  medalText: {
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
  },
  listContainer: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  listItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  listItemHighlight: {
    backgroundColor: "rgba(108,92,231,0.15)",
  },
  listRank: {
    width: 32,
    alignItems: "center",
  },
  rankMedal: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  rankMedalText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  rankText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "600",
  },
  listAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#241e4a",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 10,
  },
  listAvatarText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  listNameHighlight: {
    color: "#a855f7",
  },
  listTeam: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    marginTop: 1,
  },
  listStats: {
    alignItems: "flex-end",
  },
  listPercent: {
    fontSize: 15,
    fontWeight: "bold",
  },
  listHours: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    marginTop: 2,
  },
});
