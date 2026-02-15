import { useAuth } from "@/contexts/AuthContext";
import { GET_TEAM_ROSTER } from "@/lib/graphql/queries";
import { useQuery } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type RoleFilter = "all" | "athletes" | "coaches";

const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "athletes", label: "Athletes" },
  { key: "coaches", label: "Coaches" },
];

const ATHLETE_ROLES = ["MEMBER", "CAPTAIN"];
const COACH_ROLES = ["COACH", "ADMIN"];

export function RosterSubTab() {
  const { selectedTeamId } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const { data, loading } = useQuery(GET_TEAM_ROSTER, {
    variables: { teamId: selectedTeamId, timeRange: "ALL" },
    skip: !selectedTeamId,
  });

  const members = data?.team?.members || [];

  const filteredMembers = members.filter((m: any) => {
    const name = `${m.user.firstName} ${m.user.lastName}`.toLowerCase();
    const matchesSearch = !search || name.includes(search.toLowerCase());
    const matchesFilter =
      roleFilter === "all" ||
      (roleFilter === "athletes" && ATHLETE_ROLES.includes(m.role)) ||
      (roleFilter === "coaches" && COACH_ROLES.includes(m.role));
    return matchesSearch && matchesFilter;
  });

  const getPercentColor = (percent: number) => {
    if (percent >= 90) return "#27ae60";
    if (percent >= 75) return "#f39c12";
    return "#e74c3c";
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "COACH":
        return { label: "Coach", bg: "rgba(168,85,247,0.15)", color: "#a855f7" };
      case "ADMIN":
        return { label: "Admin", bg: "rgba(108,92,231,0.2)", color: "#6c5ce7" };
      case "CAPTAIN":
        return { label: "Captain", bg: "rgba(243,156,18,0.15)", color: "#f39c12" };
      default:
        return null;
    }
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Search */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={16} color="rgba(255,255,255,0.4)" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search members..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x" size={16} color="rgba(255,255,255,0.4)" />
          </Pressable>
        )}
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {ROLE_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, roleFilter === f.key && styles.filterChipActive]}
            onPress={() => setRoleFilter(f.key)}
          >
            <Text style={[styles.filterChipText, roleFilter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
        <View style={styles.memberCount}>
          <Text style={styles.memberCountText}>{filteredMembers.length} members</Text>
        </View>
      </View>

      {/* Member List */}
      {loading ? (
        <View style={[styles.listContainer, { paddingVertical: 40, alignItems: "center" }]}>
          <ActivityIndicator color="#a855f7" />
        </View>
      ) : filteredMembers.length === 0 ? (
        <View style={[styles.listContainer, { paddingVertical: 40, alignItems: "center" }]}>
          <Text style={styles.emptyText}>No members found</Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {filteredMembers.map((member: any, index: number) => {
            const badge = getRoleBadge(member.role);
            return (
              <View
                key={member.id}
                style={[
                  styles.memberItem,
                  index < filteredMembers.length - 1 && styles.memberItemBorder,
                ]}
              >
                {member.user.image ? (
                  <Image source={member.user.image} style={styles.memberAvatar} />
                ) : (
                  <View style={styles.memberAvatarFallback}>
                    <Text style={styles.memberAvatarText}>
                      {member.user.firstName?.[0]}{member.user.lastName?.[0]}
                    </Text>
                  </View>
                )}

                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>
                      {member.user.firstName} {member.user.lastName}
                    </Text>
                    {badge && (
                      <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.roleBadgeText, { color: badge.color }]}>
                          {badge.label}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.memberSub}>
                    {member.hoursLogged}h / {member.hoursRequired}h
                  </Text>
                </View>

                <View style={styles.memberStats}>
                  <Text
                    style={[
                      styles.memberPercent,
                      { color: getPercentColor(member.attendancePercent) },
                    ]}
                  >
                    {member.attendancePercent}%
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  searchInput: {
    flex: 1,
    color: "white",
    fontSize: 15,
    padding: 0,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  filterChipActive: {
    backgroundColor: "#6c5ce7",
  },
  filterChipText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: "white",
  },
  memberCount: {
    flex: 1,
    alignItems: "flex-end",
  },
  memberCountText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
  },
  listContainer: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginTop: 16,
    overflow: "hidden",
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  memberItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#241e4a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#463e70",
  },
  memberAvatarText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  memberName: {
    color: "white",
    fontSize: 15,
    fontWeight: "500",
  },
  memberSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  memberStats: {
    alignItems: "flex-end",
  },
  memberPercent: {
    fontSize: 16,
    fontWeight: "bold",
  },
  emptyText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
});
