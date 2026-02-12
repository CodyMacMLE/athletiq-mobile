import { useAuth } from "@/contexts/AuthContext";
import {
  GET_ACTIVE_CHECKIN,
  GET_CHECKIN_HISTORY,
  GET_PENDING_AD_HOC_CHECK_INS,
  GET_RECENT_ACTIVITY,
  GET_USER_STATS,
} from "@/lib/graphql/queries";
import { CHECK_OUT } from "@/lib/graphql/mutations";
import { useQuery, useMutation } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const AVATAR_SIZE = 45;

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Index() {
  const router = useRouter();
  const { user, organizations, selectedOrganization, setSelectedOrganization, selectedTeamId, orgRole } = useAuth();
  const [orgPickerVisible, setOrgPickerVisible] = useState(false);

  const { data: statsData, loading: statsLoading } = useQuery(GET_USER_STATS, {
    variables: {
      userId: user?.id,
      organizationId: selectedOrganization?.id,
      teamId: selectedTeamId,
    },
    skip: !user?.id || !selectedOrganization?.id,
  });

  const { data: activityData, loading: activityLoading } = useQuery(GET_RECENT_ACTIVITY, {
    variables: {
      organizationId: selectedOrganization?.id,
      limit: 4,
    },
    skip: !selectedOrganization?.id,
  });

  const { data: activeCheckInData, refetch: refetchActiveCheckIn } = useQuery(GET_ACTIVE_CHECKIN);

  const activeCheckIn = activeCheckInData?.activeCheckIn;

  const [checkOut] = useMutation(CHECK_OUT, {
    refetchQueries: ["GetActiveCheckIn", "GetCheckInHistory", "GetRecentActivity"],
  });

  const handleCheckOut = () => {
    if (!activeCheckIn) return;
    Alert.alert(
      "Check Out",
      `Are you sure you want to check out of ${activeCheckIn.event.title}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Check Out",
          style: "destructive",
          onPress: async () => {
            try {
              await checkOut({ variables: { input: { checkInId: activeCheckIn.id } } });
            } catch (error) {
              console.error("Failed to check out:", error);
            }
          },
        },
      ]
    );
  };

  const { data: checkinData } = useQuery(GET_CHECKIN_HISTORY, {
    variables: {
      userId: user?.id,
      limit: 7,
    },
    skip: !user?.id,
  });

  const isCoachOrAdmin = orgRole === "OWNER" || orgRole === "MANAGER" || orgRole === "COACH";

  const { data: pendingAdHocData } = useQuery(GET_PENDING_AD_HOC_CHECK_INS, {
    variables: { organizationId: selectedOrganization?.id },
    skip: !selectedOrganization?.id || !isCoachOrAdmin,
  });

  const pendingAdHocCount = pendingAdHocData?.pendingAdHocCheckIns?.length || 0;

  const stats = statsData?.userStats;
  const recentActivity = activityData?.recentActivity || [];

  // Build weekly check-in dots from check-in history
  const weekDots = useMemo(() => {
    const checkIns = checkinData?.checkInHistory || [];
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
    // Convert to Mon=0 based
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);
    monday.setHours(0, 0, 0, 0);

    return WEEK_DAYS.map((_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const isFuture = date > today;
      const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isToday = !isFuture && !isPast;

      const hasCheckIn = checkIns.some((ci: any) => {
        const ciDate = new Date(ci.checkInTime);
        return (
          ciDate.getFullYear() === date.getFullYear() &&
          ciDate.getMonth() === date.getMonth() &&
          ciDate.getDate() === date.getDate()
        );
      });

      return {
        isTrainingDay: !isFuture, // past and today are "training days"
        isCheckedIn: hasCheckIn,
      };
    });
  }, [checkinData]);

  // Count today's activity
  const todayCount = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return recentActivity.filter((a: any) => a.date === today).length;
  }, [recentActivity]);

  if (!user || !selectedOrganization) return null;

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />

      {/* Organization Picker Modal */}
      <Modal
        visible={orgPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOrgPickerVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setOrgPickerVisible(false)}
        >
          <View style={styles.orgPickerContainer}>
            <Text style={styles.orgPickerTitle}>Select Organization</Text>
            {organizations.map((org) => (
              <Pressable
                key={org.id}
                style={({ pressed }) => [
                  styles.orgPickerItem,
                  pressed && styles.orgPickerItemPressed,
                  selectedOrganization.id === org.id && styles.orgPickerItemSelected,
                ]}
                onPress={() => {
                  setSelectedOrganization(org);
                  setOrgPickerVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.orgPickerItemText,
                    selectedOrganization.id === org.id && styles.orgPickerItemTextSelected,
                  ]}
                >
                  {org.name}
                </Text>
                {selectedOrganization.id === org.id && (
                  <Feather name="check" size={18} color="#a855f7" />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Dashboard</Text>
          <Pressable
            style={({ pressed }) => [
              styles.subtitleContainer,
              pressed && styles.subtitlePressed,
            ]}
            onPress={() => setOrgPickerVisible(true)}
          >
            <Text style={styles.subtitle}>{selectedOrganization.name}</Text>
            <Feather name="chevron-down" size={16} color="white" />
          </Pressable>
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
        {/* Check-In / Check-Out Button */}
        <Pressable
          onPress={activeCheckIn ? handleCheckOut : () => router.push("/checkin")}
          style={({ pressed }) => [
            styles.checkInButton,
            pressed && styles.checkInButtonPressed,
            activeCheckIn && styles.checkOutButtonShadow,
          ]}
        >
          <LinearGradient
            colors={activeCheckIn ? ["#dc2626", "#ef4444"] : ["#6c5ce7", "#a855f7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.checkInGradient}
          >
            <Feather name={activeCheckIn ? "log-out" : "check-circle"} size={28} color="white" />
            <Text style={styles.checkInText}>
              {activeCheckIn ? "Check Out" : "Check In"}
            </Text>
            <Text style={styles.checkInSubtext}>
              {activeCheckIn
                ? `${activeCheckIn.event.title} \u2022 Ends ${activeCheckIn.event.endTime}`
                : "Tap to record your attendance"}
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Pending Ad-Hoc Check-Ins (coaches/admins only) */}
        {isCoachOrAdmin && pendingAdHocCount > 0 && (
          <Pressable
            onPress={() => router.push("/pending-checkins")}
            style={({ pressed }) => [
              styles.pendingBanner,
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={styles.pendingBannerLeft}>
              <Feather name="clock" size={18} color="#f59e0b" />
              <Text style={styles.pendingBannerText}>
                {pendingAdHocCount} pending check-in{pendingAdHocCount !== 1 ? "s" : ""}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.5)" />
          </Pressable>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {statsLoading ? (
            <View style={[styles.statCard, { flex: 1 }]}>
              <ActivityIndicator color="#a855f7" />
            </View>
          ) : (
            <>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{todayCount}</Text>
                <Text style={styles.statLabel}>Today</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats?.currentStreak ?? 0}</Text>
                <Text style={styles.statLabel}>Day Streak</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats?.attendancePercent ?? 0}%</Text>
                <Text style={styles.statLabel}>Attendance</Text>
              </View>
            </>
          )}
        </View>

        {/* Weekly Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.weekRow}>
            {WEEK_DAYS.map((day, i) => {
              const { isTrainingDay, isCheckedIn } = weekDots[i];

              return (
                <View key={day} style={styles.dayColumn}>
                  <View
                    style={[
                      styles.dayDot,
                      !isTrainingDay
                        ? styles.dayDotOff
                        : isCheckedIn
                          ? styles.dayDotActive
                          : styles.dayDotInactive,
                    ]}
                  >
                    {!isTrainingDay && (
                      <Feather name="minus" size={14} color="rgba(255,255,255,0.3)" />
                    )}
                    {isTrainingDay && isCheckedIn && (
                      <Feather name="check" size={14} color="white" />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.dayLabel,
                      !isTrainingDay
                        ? styles.dayLabelOff
                        : isCheckedIn && styles.dayLabelActive,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <Pressable onPress={() => router.push("/activity")}>
              <Text style={styles.seeAll}>See All</Text>
            </Pressable>
          </View>
          {activityLoading ? (
            <View style={[styles.activityList, { paddingVertical: 24 }]}>
              <ActivityIndicator color="#a855f7" />
            </View>
          ) : recentActivity.length === 0 ? (
            <View style={[styles.activityList, { paddingVertical: 24, alignItems: "center" }]}>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
                No recent activity
              </Text>
            </View>
          ) : (
            <View style={styles.activityList}>
              {recentActivity.map((item: any, i: number) => (
                <View
                  key={item.id}
                  style={[
                    styles.activityItem,
                    i < recentActivity.length - 1 && styles.activityItemBorder,
                  ]}
                >
                  <View style={styles.activityIcon}>
                    <Feather
                      name={item.type === "check-out" ? "log-out" : "log-in"}
                      size={16}
                      color="#a855f7"
                    />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityName}>
                      {item.user.firstName} {item.user.lastName}
                    </Text>
                    <Text style={styles.activityTime}>{item.time}</Text>
                  </View>
                  <View style={styles.activityBadge}>
                    <Text style={styles.activityBadgeText}>
                      {item.type === "check-out" ? "Checked Out" : "Checked In"}
                    </Text>
                  </View>
                </View>
              ))}
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
    paddingBottom: 40,
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
  subtitleContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginLeft: -8,
    borderRadius: 8,
  },
  subtitlePressed: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  subtitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },

  // Organization Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  orgPickerContainer: {
    backgroundColor: "#2a2550",
    borderRadius: 16,
    width: "100%",
    maxWidth: 320,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  orgPickerTitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  orgPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  orgPickerItemPressed: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  orgPickerItemSelected: {
    backgroundColor: "rgba(168,85,247,0.15)",
  },
  orgPickerItemText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  orgPickerItemTextSelected: {
    color: "#a855f7",
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

  // Check-In CTA
  checkInButton: {
    marginTop: 28,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  checkInButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  checkOutButtonShadow: {
    shadowColor: "#ef4444",
  },
  checkInGradient: {
    paddingVertical: 28,
    alignItems: "center",
    gap: 8,
  },
  checkInText: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 4,
  },
  checkInSubtext: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },

  // Pending Ad-Hoc Banner
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    backgroundColor: "rgba(245,158,11,0.15)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.2)",
  },
  pendingBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pendingBannerText: {
    color: "#f59e0b",
    fontSize: 14,
    fontWeight: "600",
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  statValue: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  statLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    marginTop: 4,
  },

  // Sections
  section: {
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "600",
  },
  seeAll: {
    color: "#a855f7",
    fontSize: 14,
    fontWeight: "500",
  },

  // Weekly overview
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  dayColumn: {
    alignItems: "center",
    gap: 8,
  },
  dayDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  dayDotActive: {
    backgroundColor: "#6c5ce7",
  },
  dayDotInactive: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  dayDotOff: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  dayLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "500",
  },
  dayLabelActive: {
    color: "rgba(255,255,255,0.8)",
  },
  dayLabelOff: {
    color: "rgba(255,255,255,0.25)",
  },

  // Activity list
  activityList: {
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  activityItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(168,85,247,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    color: "white",
    fontSize: 15,
    fontWeight: "500",
  },
  activityTime: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    marginTop: 2,
  },
  activityBadge: {
    backgroundColor: "rgba(108,92,231,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activityBadgeText: {
    color: "#a855f7",
    fontSize: 12,
    fontWeight: "600",
  },
});
