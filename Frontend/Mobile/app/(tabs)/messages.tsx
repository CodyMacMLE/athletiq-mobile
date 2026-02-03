import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type User = {
  image?: string;
  firstName: string;
  lastName: string;
};

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

type UpcomingEvent = {
  id: string;
  date: Date;
  eventName: string;
  eventType: "practice" | "event" | "meeting";
  scheduledStart: string;
  scheduledEnd: string;
  isExcused: boolean;
  excuseReason?: string;
};

const user: User = {
  image: undefined,
  firstName: "Cody",
  lastName: "MacDonald",
};

const AVATAR_SIZE = 45;

// Helper to get relative date
function getRelativeDate(daysFromNow: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Mock check-in history
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
];

// Mock upcoming events that can be excused
const upcomingEvents: UpcomingEvent[] = [
  {
    id: "u1",
    date: getRelativeDate(1),
    eventName: "Team Practice",
    eventType: "practice",
    scheduledStart: "6:00 PM",
    scheduledEnd: "8:00 PM",
    isExcused: false,
  },
  {
    id: "u2",
    date: getRelativeDate(2),
    eventName: "Team Practice",
    eventType: "practice",
    scheduledStart: "6:00 PM",
    scheduledEnd: "8:00 PM",
    isExcused: false,
  },
  {
    id: "u3",
    date: getRelativeDate(4),
    eventName: "Game vs Thunder",
    eventType: "event",
    scheduledStart: "7:00 PM",
    scheduledEnd: "9:00 PM",
    isExcused: false,
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

  const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFutureDate(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";

  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ActivityFeed() {
  const router = useRouter();
  const [excuseModalVisible, setExcuseModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<UpcomingEvent | null>(null);
  const [excuseReason, setExcuseReason] = useState("");
  const [events, setEvents] = useState(upcomingEvents);

  const handleExcusePress = (event: UpcomingEvent) => {
    setSelectedEvent(event);
    setExcuseReason("");
    setExcuseModalVisible(true);
  };

  const handleSubmitExcuse = () => {
    if (selectedEvent && excuseReason.trim()) {
      setEvents(events.map(e =>
        e.id === selectedEvent.id
          ? { ...e, isExcused: true, excuseReason: excuseReason.trim() }
          : e
      ));
      setExcuseModalVisible(false);
      setSelectedEvent(null);
      setExcuseReason("");
    }
  };

  const handleCancelExcuse = (eventId: string) => {
    setEvents(events.map(e =>
      e.id === eventId
        ? { ...e, isExcused: false, excuseReason: undefined }
        : e
    ));
  };

  // Calculate summary stats
  const totalLogs = checkInHistory.length;
  const onTimeCount = checkInHistory.filter(l => l.status === "on-time").length;
  const lateCount = checkInHistory.filter(l => l.status === "late").length;
  const absentCount = checkInHistory.filter(l => l.status === "absent").length;

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />

      {/* Excuse Modal */}
      <Modal
        visible={excuseModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExcuseModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setExcuseModalVisible(false)}
        >
          <Pressable style={styles.excuseModalContainer} onPress={e => e.stopPropagation()}>
            <Text style={styles.excuseModalTitle}>Request Excuse</Text>
            {selectedEvent && (
              <View style={styles.excuseEventInfo}>
                <Text style={styles.excuseEventName}>{selectedEvent.eventName}</Text>
                <Text style={styles.excuseEventDate}>
                  {formatFutureDate(selectedEvent.date)} • {selectedEvent.scheduledStart}
                </Text>
              </View>
            )}
            <Text style={styles.excuseLabel}>Reason for absence</Text>
            <TextInput
              style={styles.excuseInput}
              placeholder="e.g., Doctor's appointment, family event..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={excuseReason}
              onChangeText={setExcuseReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.excuseModalButtons}>
              <Pressable
                style={[styles.excuseButton, styles.excuseButtonCancel]}
                onPress={() => setExcuseModalVisible(false)}
              >
                <Text style={styles.excuseButtonCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.excuseButton,
                  styles.excuseButtonSubmit,
                  !excuseReason.trim() && styles.excuseButtonDisabled,
                ]}
                onPress={handleSubmitExcuse}
                disabled={!excuseReason.trim()}
              >
                <Text style={styles.excuseButtonSubmitText}>Submit</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Activity</Text>
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
        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: STATUS_CONFIG["on-time"].color }]}>
              {onTimeCount}
            </Text>
            <Text style={styles.statLabel}>On Time</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: STATUS_CONFIG["late"].color }]}>
              {lateCount}
            </Text>
            <Text style={styles.statLabel}>Late</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: STATUS_CONFIG["absent"].color }]}>
              {absentCount}
            </Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
        </View>

        {/* Upcoming - Request Excuse */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          <Text style={styles.sectionSubtitle}>Request an excuse if you can't attend</Text>

          <View style={styles.upcomingList}>
            {events.map((event) => (
              <View key={event.id} style={styles.upcomingCard}>
                <View
                  style={[
                    styles.upcomingAccent,
                    { backgroundColor: EVENT_TYPE_COLORS[event.eventType] },
                  ]}
                />
                <View style={styles.upcomingContent}>
                  <View style={styles.upcomingHeader}>
                    <View>
                      <Text style={styles.upcomingName}>{event.eventName}</Text>
                      <Text style={styles.upcomingDate}>
                        {formatFutureDate(event.date)} • {event.scheduledStart} - {event.scheduledEnd}
                      </Text>
                    </View>
                  </View>
                  {event.isExcused ? (
                    <View style={styles.excusedBadgeContainer}>
                      <View style={styles.excusedBadge}>
                        <Feather name="check" size={12} color="#9b59b6" />
                        <Text style={styles.excusedBadgeText}>Excused</Text>
                      </View>
                      <Pressable
                        style={styles.cancelExcuseButton}
                        onPress={() => handleCancelExcuse(event.id)}
                      >
                        <Text style={styles.cancelExcuseText}>Cancel</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [
                        styles.excuseRequestButton,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => handleExcusePress(event)}
                    >
                      <Feather name="alert-circle" size={14} color="#a855f7" />
                      <Text style={styles.excuseRequestText}>Request Excuse</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Check-In History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Check-In History</Text>
            <Pressable onPress={() => router.push("/checkin-history")}>
              <Text style={styles.seeAll}>See All</Text>
            </Pressable>
          </View>

          <View style={styles.timelineContainer}>
            {checkInHistory.map((log, index) => {
              const config = STATUS_CONFIG[log.status];
              const isLast = index === checkInHistory.length - 1;

              return (
                <View key={log.id} style={styles.timelineItem}>
                  {/* Timeline connector */}
                  <View style={styles.timelineLeft}>
                    <View
                      style={[
                        styles.timelineDot,
                        { backgroundColor: config.color },
                      ]}
                    >
                      <Feather name={config.icon as any} size={12} color="white" />
                    </View>
                    {!isLast && <View style={styles.timelineLine} />}
                  </View>

                  {/* Log content */}
                  <View style={[styles.timelineContent, isLast && { marginBottom: 0 }]}>
                    <View style={styles.logHeader}>
                      <Text style={styles.logDate}>{formatDate(log.date)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: `${config.color}20` }]}>
                        <Text style={[styles.statusBadgeText, { color: config.color }]}>
                          {config.label}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.logCard}>
                      <View style={styles.logCardHeader}>
                        <View
                          style={[
                            styles.logEventDot,
                            { backgroundColor: EVENT_TYPE_COLORS[log.eventType] },
                          ]}
                        />
                        <Text style={styles.logEventName}>{log.eventName}</Text>
                      </View>

                      <View style={styles.logDetails}>
                        <View style={styles.logDetailRow}>
                          <Text style={styles.logDetailLabel}>Scheduled</Text>
                          <Text style={styles.logDetailValue}>
                            {log.scheduledStart} - {log.scheduledEnd}
                          </Text>
                        </View>

                        {log.checkInTime && (
                          <View style={styles.logDetailRow}>
                            <Text style={styles.logDetailLabel}>Check-in</Text>
                            <Text style={styles.logDetailValue}>{log.checkInTime}</Text>
                          </View>
                        )}

                        {log.checkOutTime && (
                          <View style={styles.logDetailRow}>
                            <Text style={styles.logDetailLabel}>Check-out</Text>
                            <Text style={styles.logDetailValue}>{log.checkOutTime}</Text>
                          </View>
                        )}

                        {log.hoursLogged !== undefined && (
                          <View style={styles.logDetailRow}>
                            <Text style={styles.logDetailLabel}>Hours Logged</Text>
                            <Text style={[styles.logDetailValue, styles.logHours]}>
                              {log.hoursLogged.toFixed(2)}h
                            </Text>
                          </View>
                        )}

                        {log.excuseReason && (
                          <View style={styles.excuseReasonContainer}>
                            <Text style={styles.excuseReasonLabel}>Reason:</Text>
                            <Text style={styles.excuseReasonText}>{log.excuseReason}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
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

  // Stats Row
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "bold",
  },
  statLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    marginTop: 2,
  },

  // Sections
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    marginBottom: 12,
  },
  seeAll: {
    color: "#a855f7",
    fontSize: 14,
    fontWeight: "500",
  },

  // Upcoming Events
  upcomingList: {
    gap: 10,
  },
  upcomingCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  upcomingAccent: {
    width: 4,
  },
  upcomingContent: {
    flex: 1,
    padding: 14,
  },
  upcomingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  upcomingName: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  upcomingDate: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 2,
  },
  excuseRequestButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: "rgba(168,85,247,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  excuseRequestText: {
    color: "#a855f7",
    fontSize: 13,
    fontWeight: "500",
  },
  excusedBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  excusedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(155,89,182,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  excusedBadgeText: {
    color: "#9b59b6",
    fontSize: 13,
    fontWeight: "500",
  },
  cancelExcuseButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelExcuseText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "500",
  },

  // Timeline
  timelineContainer: {
    marginTop: 4,
  },
  timelineItem: {
    flexDirection: "row",
  },
  timelineLeft: {
    alignItems: "center",
    width: 32,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
    marginBottom: 16,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  logDate: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "500",
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
  logCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  logCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  logEventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  logEventName: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  logDetails: {
    gap: 6,
  },
  logDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logDetailLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },
  logDetailValue: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontWeight: "500",
  },
  logHours: {
    color: "#27ae60",
    fontWeight: "600",
  },
  excuseReasonContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  excuseReasonLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginBottom: 2,
  },
  excuseReasonText: {
    color: "#9b59b6",
    fontSize: 13,
    fontStyle: "italic",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  excuseModalContainer: {
    backgroundColor: "#2a2550",
    borderRadius: 16,
    width: "100%",
    maxWidth: 340,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  excuseModalTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  excuseEventInfo: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  excuseEventName: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  excuseEventDate: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 2,
  },
  excuseLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginBottom: 8,
  },
  excuseInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 12,
    color: "white",
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  excuseModalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  excuseButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  excuseButtonCancel: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  excuseButtonCancelText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontWeight: "600",
  },
  excuseButtonSubmit: {
    backgroundColor: "#6c5ce7",
  },
  excuseButtonDisabled: {
    opacity: 0.5,
  },
  excuseButtonSubmitText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
});
