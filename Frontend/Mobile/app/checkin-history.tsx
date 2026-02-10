import { useAuth } from "@/contexts/AuthContext";
import { GET_CHECKIN_HISTORY } from "@/lib/graphql/queries";
import { useQuery } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type CheckInRecord = {
  id: string;
  status: string;
  checkInTime: string;
  checkOutTime?: string;
  hoursLogged?: number;
  event: {
    id: string;
    title: string;
    type: string;
    date: string;
    startTime: string;
    endTime: string;
    location?: string;
  };
};

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  "CHECKED_IN": { color: "#27ae60", icon: "check-circle", label: "On Time" },
  "CHECKED_OUT": { color: "#3498db", icon: "log-out", label: "Completed" },
  "LATE": { color: "#f39c12", icon: "clock", label: "Late" },
  "ABSENT": { color: "#e74c3c", icon: "x-circle", label: "Absent" },
  "EXCUSED": { color: "#9b59b6", icon: "info", label: "Excused" },
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  PRACTICE: "#6c5ce7",
  practice: "#6c5ce7",
  EVENT: "#e74c3c",
  event: "#e74c3c",
  GAME: "#e74c3c",
  MEETING: "#f39c12",
  meeting: "#f39c12",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  if (dateOnly.getTime() === today.getTime()) return "Today";
  if (dateOnly.getTime() === yesterday.getTime()) return "Yesterday";

  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(isoStr: string): string {
  const date = new Date(isoStr);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function CheckInHistory() {
  const router = useRouter();
  const { user } = useAuth();

  const { data, loading } = useQuery(GET_CHECKIN_HISTORY, {
    variables: {
      userId: user?.id,
      limit: 50,
    },
    skip: !user?.id,
  });

  const checkIns: CheckInRecord[] = data?.checkInHistory || [];

  // Calculate stats from real data
  const stats = useMemo(() => {
    const total = checkIns.length;
    const completedCount = checkIns.filter(
      (c) => c.status === "CHECKED_OUT" || c.status === "CHECKED_IN"
    ).length;
    const totalHours = checkIns.reduce((sum, c) => sum + (c.hoursLogged || 0), 0);
    return { total, completedCount, totalHours };
  }, [checkIns]);

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
        <Text style={styles.title}>Check-In History</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#a855f7" size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: "#27ae60" }]}>{stats.completedCount}</Text>
              <Text style={styles.statLabel}>Attended</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalHours.toFixed(1)}h</Text>
              <Text style={styles.statLabel}>Hours</Text>
            </View>
          </View>

          {checkIns.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Feather name="clock" size={40} color="rgba(255,255,255,0.2)" />
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, marginTop: 12 }}>
                No check-in history
              </Text>
            </View>
          ) : (
            <View style={styles.timelineContainer}>
              {checkIns.map((log, index) => {
                const config = STATUS_CONFIG[log.status] || STATUS_CONFIG["CHECKED_IN"];
                const isLast = index === checkIns.length - 1;
                const eventTypeColor = EVENT_TYPE_COLORS[log.event.type] || "#6c5ce7";

                return (
                  <View key={log.id} style={styles.timelineItem}>
                    {/* Timeline connector */}
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineDot, { backgroundColor: config.color }]}>
                        <Feather name={config.icon as any} size={12} color="white" />
                      </View>
                      {!isLast && <View style={styles.timelineLine} />}
                    </View>

                    {/* Content */}
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineHeader}>
                        <Text style={styles.timelineDate}>{formatDate(log.event.date)}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: `${config.color}20` }]}>
                          <Text style={[styles.statusBadgeText, { color: config.color }]}>
                            {config.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.timelineCard}>
                        <View
                          style={[
                            styles.eventTypeAccent,
                            { backgroundColor: eventTypeColor },
                          ]}
                        />
                        <View style={styles.timelineCardContent}>
                          <Text style={styles.eventName}>{log.event.title}</Text>
                          <Text style={styles.eventTime}>
                            {log.event.startTime} - {log.event.endTime}
                          </Text>

                          {log.checkInTime && (
                            <View style={styles.checkTimes}>
                              <View style={styles.checkTimeRow}>
                                <Feather name="log-in" size={12} color="rgba(255,255,255,0.5)" />
                                <Text style={styles.checkTimeText}>In: {formatTime(log.checkInTime)}</Text>
                              </View>
                              {log.checkOutTime && (
                                <View style={styles.checkTimeRow}>
                                  <Feather name="log-out" size={12} color="rgba(255,255,255,0.5)" />
                                  <Text style={styles.checkTimeText}>Out: {formatTime(log.checkOutTime)}</Text>
                                </View>
                              )}
                            </View>
                          )}

                          {log.hoursLogged != null && log.hoursLogged > 0 && (
                            <Text style={styles.hoursText}>{log.hoursLogged.toFixed(1)} hours logged</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  statValue: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },
  statLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 4,
  },
  timelineContainer: {
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: "row",
  },
  timelineLeft: {
    alignItems: "center",
    marginRight: 12,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 20,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  timelineDate: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  timelineCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  eventTypeAccent: {
    width: 4,
  },
  timelineCardContent: {
    flex: 1,
    padding: 12,
  },
  eventName: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  eventTime: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 2,
  },
  checkTimes: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
  },
  checkTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  checkTimeText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  hoursText: {
    color: "#a855f7",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 8,
  },
});
