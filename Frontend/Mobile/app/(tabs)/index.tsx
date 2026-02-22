import { useAuth } from "@/contexts/AuthContext";
import { OrgTeamPicker } from "@/components/OrgTeamPicker";
import { OrgTeamSubtitle } from "@/components/OrgTeamSubtitle";
import { AthletePicker } from "@/components/AthletePicker";
import { NoOrgScreen } from "@/components/NoOrgScreen";
import {
  GET_ACTIVE_CHECKIN,
  GET_CHECKIN_HISTORY,
  GET_EVENTS,
  GET_MY_EXCUSE_REQUESTS,
  GET_NOTIFICATION_HISTORY,
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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const AVATAR_SIZE = 45;

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Index() {
  const router = useRouter();
  const {
    user, selectedOrganization, selectedTeamId, orgRole,
    isViewingAsGuardian, hasGuardianLinks, selectedAthlete, targetUserId,
  } = useAuth();
  const [pickerVisible, setPickerVisible] = useState(false);

  const { data: statsData, loading: statsLoading } = useQuery(GET_USER_STATS, {
    variables: {
      userId: targetUserId,
      organizationId: selectedOrganization?.id,
      teamId: isViewingAsGuardian ? null : selectedTeamId,
    },
    skip: !targetUserId || !selectedOrganization?.id,
  });

  const { data: activityData, loading: activityLoading } = useQuery(GET_RECENT_ACTIVITY, {
    variables: {
      organizationId: selectedOrganization?.id,
      limit: 4,
    },
    skip: !selectedOrganization?.id,
  });

  const { data: activeCheckInData, refetch: refetchActiveCheckIn } = useQuery(GET_ACTIVE_CHECKIN, {
    variables: { userId: isViewingAsGuardian ? targetUserId : undefined },
  });

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
      userId: targetUserId,
      limit: 14,
    },
    skip: !targetUserId,
  });

  // Fetch scheduled events for this week (today + future) so we can show "scheduled" dots.
  // Use local date formatting to avoid UTC timezone shift from toISOString().
  const { weekStartStr, weekEndStr } = useMemo(() => {
    const now = new Date();
    const sun = new Date(now);
    sun.setDate(now.getDate() - now.getDay());
    sun.setHours(0, 0, 0, 0);
    const nextSun = new Date(sun);
    nextSun.setDate(sun.getDate() + 7); // exclusive upper bound
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    return { weekStartStr: fmt(sun), weekEndStr: fmt(nextSun) };
  }, []);

  const { data: weekEventsData } = useQuery(GET_EVENTS, {
    variables: {
      organizationId: selectedOrganization?.id,
      startDate: weekStartStr,
      endDate: weekEndStr,
    },
    skip: !selectedOrganization?.id,
    fetchPolicy: "cache-and-network",
  });

  const { data: weekExcuseData } = useQuery(GET_MY_EXCUSE_REQUESTS, {
    variables: { userId: targetUserId },
    skip: !targetUserId,
    fetchPolicy: "cache-and-network",
  });

  const { data: notifData } = useQuery(GET_NOTIFICATION_HISTORY, {
    variables: { limit: 100 },
    skip: !user,
    fetchPolicy: "cache-and-network",
    pollInterval: 60000,
  });

  const unreadCount = useMemo(() => {
    if (!notifData?.notificationHistory) return 0;
    return notifData.notificationHistory.filter((n: any) => !n.readAt).length;
  }, [notifData]);

  const isCoachOrAdmin = !isViewingAsGuardian && (orgRole === "OWNER" || orgRole === "MANAGER" || orgRole === "COACH");

  const { data: pendingAdHocData } = useQuery(GET_PENDING_AD_HOC_CHECK_INS, {
    variables: { organizationId: selectedOrganization?.id },
    skip: !selectedOrganization?.id || !isCoachOrAdmin,
  });

  const pendingAdHocCount = pendingAdHocData?.pendingAdHocCheckIns?.length || 0;

  const stats = statsData?.userStats;
  const recentActivity = activityData?.recentActivity || [];

  // Build weekly check-in dots: Sun–Sat with 6 states per day.
  //
  // Strategy:
  //   Past days  → derive state from check-in records ONLY.
  //                No check-in record = no tracked event for this athlete = "off".
  //                This prevents false "absent" from cross-team events in the events query.
  //                ABSENT records may have null checkInTime; use event.date as fallback.
  //   Today      → check-in record first, then fall back to events query for "scheduled".
  //   Future     → events query only → "scheduled" or "off".
  const weekDots = useMemo(() => {
    const checkIns = checkinData?.checkInHistory || [];
    const scheduledEvents = weekEventsData?.events || [];
    const excuses = weekExcuseData?.myExcuseRequests || [];
    const now = new Date();

    // Normalize a date value to a local "YYYY-M-D" key (month is 0-indexed intentionally)
    const toDateKey = (raw: string | number | null | undefined): string | null => {
      if (raw == null) return null;
      let d: Date;
      const num = Number(raw);
      if (!isNaN(num) && num > 0 && String(raw).length > 8) {
        d = new Date(num > 9999999999 ? num : num * 1000);
      } else {
        const s = String(raw);
        const datePart = s.includes("T") ? s.split("T")[0] : s;
        const parts = datePart.split("-").map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) return null;
        d = new Date(parts[0], parts[1] - 1, parts[2]);
      }
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    };

    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay());
    sunday.setHours(0, 0, 0, 0);

    type DotState = "off" | "scheduled" | "checkedIn" | "excuseApproved" | "excusePending" | "absent";

    const stateFromCheckIn = (ci: any): DotState => {
      const s = ci.status;
      if (s === "ON_TIME" || s === "LATE") return "checkedIn";
      if (s === "EXCUSED") return "excuseApproved";
      if (s === "ABSENT") {
        const excuse = excuses.find((ex: any) => ex.event?.id === ci.event?.id);
        if (excuse?.status === "PENDING") return "excusePending";
        if (excuse?.status === "APPROVED") return "excuseApproved";
        return "absent";
      }
      return "off";
    };

    return WEEK_DAYS.map((_, i): DotState => {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

      const isToday =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
      const isPast =
        !isToday &&
        (date.getFullYear() < now.getFullYear() ||
          (date.getFullYear() === now.getFullYear() && date.getMonth() < now.getMonth()) ||
          (date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() < now.getDate()));

      if (isPast || isToday) {
        // Match check-in to day via event.date (handles ABSENT with null checkInTime)
        // or via checkInTime as fallback.
        const checkIn = checkIns.find((ci: any) => {
          if (ci.isAdHoc) return false;
          const dateSource = ci.event?.date ?? ci.checkInTime;
          return toDateKey(dateSource) === dateKey;
        });

        if (checkIn) return stateFromCheckIn(checkIn);

        // Past day with no check-in record → no tracked event for this athlete
        if (isPast) return "off";
      }

      // Today (no check-in yet) or future: show "scheduled" if event exists in org this day
      const hasEvent = scheduledEvents.some((ev: any) => toDateKey(ev.date) === dateKey);
      return hasEvent ? "scheduled" : "off";
    });
  }, [checkinData, weekEventsData, weekExcuseData]);

  // Count today's activity
  const todayCount = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return recentActivity.filter((a: any) => a.date === today).length;
  }, [recentActivity]);

  if (!user) return null;
  if (!selectedOrganization) return <NoOrgScreen title="Dashboard" />;

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />

      <OrgTeamPicker visible={pickerVisible} onClose={() => setPickerVisible(false)} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>
            {isViewingAsGuardian ? `${selectedAthlete?.firstName}'s Dashboard` : "Dashboard"}
          </Text>
          <OrgTeamSubtitle onPress={() => setPickerVisible(true)} />
        </View>

        <View style={styles.headerRight}>
          {/* Bell icon with unread badge */}
          <Pressable
            style={({ pressed }) => [styles.bellBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push("/notifications")}
          >
            <Feather name="bell" size={22} color={unreadCount > 0 ? "#a855f7" : "rgba(255,255,255,0.55)"} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>

          {user.image ? (
            <Image source={user.image} style={[styles.avatar, styles.avatarImage]} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
              </Text>
            </View>
          )}
        </View>
      </View>

      <AthletePicker />

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
              const state = weekDots[i];

              let dotStyle = styles.dayDotOff;
              let icon: string | null = "minus";
              let iconColor = "rgba(255,255,255,0.3)";
              let labelStyle = styles.dayLabelOff;

              switch (state) {
                case "scheduled":
                  dotStyle = styles.dayDotScheduled;
                  icon = null;
                  labelStyle = styles.dayLabel;
                  break;
                case "checkedIn":
                  dotStyle = styles.dayDotCheckedIn;
                  icon = "check";
                  iconColor = "white";
                  labelStyle = styles.dayLabelActive;
                  break;
                case "excuseApproved":
                  dotStyle = styles.dayDotExcuseApproved;
                  icon = "check";
                  iconColor = "white";
                  labelStyle = styles.dayLabelExcuseApproved;
                  break;
                case "excusePending":
                  dotStyle = styles.dayDotExcusePending;
                  icon = "clock";
                  iconColor = "white";
                  labelStyle = styles.dayLabelExcusePending;
                  break;
                case "absent":
                  dotStyle = styles.dayDotAbsent;
                  icon = "x";
                  iconColor = "white";
                  labelStyle = styles.dayLabelAbsent;
                  break;
                default: // "off"
                  break;
              }

              return (
                <View key={day} style={styles.dayColumn}>
                  <View style={[styles.dayDot, dotStyle]}>
                    {icon && (
                      <Feather name={icon as any} size={14} color={iconColor} />
                    )}
                  </View>
                  <Text style={[styles.dayLabel, labelStyle]}>{day}</Text>
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
    flex: 1,
    minHeight: 58,
  },
  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bellBtn: {
    position: "relative",
    padding: 4,
  },
  bellBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#e74c3c",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
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
  // 6-state dots for weekly overview
  dayDotOff: {
    backgroundColor: "rgba(255,255,255,0.05)", // no event — minus icon
  },
  dayDotScheduled: {
    backgroundColor: "rgba(108,92,231,0.35)", // event exists, future or today pending
    borderWidth: 1.5,
    borderColor: "rgba(108,92,231,0.7)",
  },
  dayDotCheckedIn: {
    backgroundColor: "#16a34a", // green — checked in
  },
  dayDotExcuseApproved: {
    backgroundColor: "#ea580c", // orange — absence approved
  },
  dayDotExcusePending: {
    backgroundColor: "#ca8a04", // yellow — absence request pending
  },
  dayDotAbsent: {
    backgroundColor: "#dc2626", // red — absent / no valid excuse
  },
  dayLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "500",
  },
  dayLabelActive: {
    color: "rgba(255,255,255,0.9)",
  },
  dayLabelOff: {
    color: "rgba(255,255,255,0.2)",
  },
  dayLabelExcuseApproved: {
    color: "#fb923c",
  },
  dayLabelExcusePending: {
    color: "#fbbf24",
  },
  dayLabelAbsent: {
    color: "#f87171",
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
