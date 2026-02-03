import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type AttendanceStatus = "on-time" | "late" | "absent" | "excused";

type CheckInLog = {
  id: string;
  date: Date;
  eventName: string;
  eventType: "practice" | "event" | "meeting";
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  scheduledStart: string;
  scheduledEnd: string;
  hoursLogged?: number;
  excuseReason?: string;
};

// Helper to get relative date
function getRelativeDate(daysFromNow: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Extended check-in history
const checkInHistory: CheckInLog[] = [
  {
    id: "1",
    date: getRelativeDate(0),
    eventName: "Team Practice",
    eventType: "practice",
    status: "on-time",
    checkInTime: "5:58 PM",
    checkOutTime: "8:02 PM",
    scheduledStart: "6:00 PM",
    scheduledEnd: "8:00 PM",
    hoursLogged: 2.07,
  },
  {
    id: "2",
    date: getRelativeDate(-1),
    eventName: "Team Practice",
    eventType: "practice",
    status: "late",
    checkInTime: "6:18 PM",
    checkOutTime: "8:00 PM",
    scheduledStart: "6:00 PM",
    scheduledEnd: "8:00 PM",
    hoursLogged: 1.7,
  },
  {
    id: "3",
    date: getRelativeDate(-2),
    eventName: "Team Meeting",
    eventType: "meeting",
    status: "on-time",
    checkInTime: "4:55 PM",
    checkOutTime: "6:00 PM",
    scheduledStart: "5:00 PM",
    scheduledEnd: "6:00 PM",
    hoursLogged: 1.08,
  },
  {
    id: "4",
    date: getRelativeDate(-3),
    eventName: "Team Practice",
    eventType: "practice",
    status: "excused",
    scheduledStart: "6:00 PM",
    scheduledEnd: "8:00 PM",
    excuseReason: "Doctor's appointment",
  },
  {
    id: "5",
    date: getRelativeDate(-4),
    eventName: "Game vs Eagles",
    eventType: "event",
    status: "on-time",
    checkInTime: "6:00 PM",
    checkOutTime: "9:15 PM",
    scheduledStart: "7:00 PM",
    scheduledEnd: "9:00 PM",
    hoursLogged: 3.25,
  },
  {
    id: "6",
    date: getRelativeDate(-6),
    eventName: "Team Practice",
    eventType: "practice",
    status: "absent",
    scheduledStart: "6:00 PM",
    scheduledEnd: "8:00 PM",
  },
  {
    id: "7",
    date: getRelativeDate(-7),
    eventName: "Team Practice",
    eventType: "practice",
    status: "on-time",
    checkInTime: "5:55 PM",
    checkOutTime: "8:00 PM",
    scheduledStart: "6:00 PM",
    scheduledEnd: "8:00 PM",
    hoursLogged: 2.08,
  },
  {
    id: "8",
    date: getRelativeDate(-8),
    eventName: "Team Meeting",
    eventType: "meeting",
    status: "on-time",
    checkInTime: "5:00 PM",
    checkOutTime: "6:00 PM",
    scheduledStart: "5:00 PM",
    scheduledEnd: "6:00 PM",
    hoursLogged: 1.0,
  },
  {
    id: "9",
    date: getRelativeDate(-10),
    eventName: "Team Practice",
    eventType: "practice",
    status: "late",
    checkInTime: "6:25 PM",
    checkOutTime: "8:00 PM",
    scheduledStart: "6:00 PM",
    scheduledEnd: "8:00 PM",
    hoursLogged: 1.58,
  },
  {
    id: "10",
    date: getRelativeDate(-11),
    eventName: "Game vs Thunder",
    eventType: "event",
    status: "on-time",
    checkInTime: "6:45 PM",
    checkOutTime: "9:00 PM",
    scheduledStart: "7:00 PM",
    scheduledEnd: "9:00 PM",
    hoursLogged: 2.25,
  },
];

const STATUS_CONFIG: Record<AttendanceStatus, { color: string; icon: string; label: string }> = {
  "on-time": { color: "#27ae60", icon: "check-circle", label: "On Time" },
  "late": { color: "#f39c12", icon: "clock", label: "Late" },
  "absent": { color: "#e74c3c", icon: "x-circle", label: "Absent" },
  "excused": { color: "#9b59b6", icon: "info", label: "Excused" },
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  practice: "#6c5ce7",
  event: "#e74c3c",
  meeting: "#f39c12",
};

function formatDate(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === yesterday.getTime()) return "Yesterday";

  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function CheckInHistory() {
  const router = useRouter();

  // Calculate stats
  const totalLogs = checkInHistory.length;
  const onTimeCount = checkInHistory.filter((l) => l.status === "on-time").length;
  const totalHours = checkInHistory.reduce((sum, l) => sum + (l.hoursLogged || 0), 0);

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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalLogs}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: "#27ae60" }]}>{onTimeCount}</Text>
            <Text style={styles.statLabel}>On Time</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalHours.toFixed(1)}h</Text>
            <Text style={styles.statLabel}>Hours</Text>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.timelineContainer}>
          {checkInHistory.map((log, index) => {
            const config = STATUS_CONFIG[log.status];
            const isLast = index === checkInHistory.length - 1;

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
                    <Text style={styles.timelineDate}>{formatDate(log.date)}</Text>
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
                        { backgroundColor: EVENT_TYPE_COLORS[log.eventType] },
                      ]}
                    />
                    <View style={styles.timelineCardContent}>
                      <Text style={styles.eventName}>{log.eventName}</Text>
                      <Text style={styles.eventTime}>
                        {log.scheduledStart} - {log.scheduledEnd}
                      </Text>

                      {log.checkInTime && (
                        <View style={styles.checkTimes}>
                          <View style={styles.checkTimeRow}>
                            <Feather name="log-in" size={12} color="rgba(255,255,255,0.5)" />
                            <Text style={styles.checkTimeText}>In: {log.checkInTime}</Text>
                          </View>
                          {log.checkOutTime && (
                            <View style={styles.checkTimeRow}>
                              <Feather name="log-out" size={12} color="rgba(255,255,255,0.5)" />
                              <Text style={styles.checkTimeText}>Out: {log.checkOutTime}</Text>
                            </View>
                          )}
                        </View>
                      )}

                      {log.hoursLogged && (
                        <Text style={styles.hoursText}>{log.hoursLogged.toFixed(1)} hours logged</Text>
                      )}

                      {log.excuseReason && (
                        <Text style={styles.excuseText}>Reason: {log.excuseReason}</Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
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
  excuseText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 8,
  },
});
