import { useAuth } from "@/contexts/AuthContext";
import {
  GET_UPCOMING_EVENTS,
  GET_CHECKIN_HISTORY,
  GET_MY_EXCUSE_REQUESTS,
} from "@/lib/graphql/queries";
import { CREATE_EXCUSE_REQUEST, CANCEL_EXCUSE_REQUEST } from "@/lib/graphql/mutations";
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
  TextInput,
  View,
} from "react-native";

type AttendanceStatus = "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED";

const AVATAR_SIZE = 45;

const STATUS_CONFIG: Record<AttendanceStatus, { color: string; icon: string; label: string }> = {
  ON_TIME: { color: "#27ae60", icon: "check-circle", label: "On Time" },
  LATE: { color: "#f39c12", icon: "clock", label: "Late" },
  ABSENT: { color: "#e74c3c", icon: "x-circle", label: "Absent" },
  EXCUSED: { color: "#9b59b6", icon: "info", label: "Excused" },
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  PRACTICE: "#6c5ce7",
  EVENT: "#e74c3c",
  MEETING: "#f39c12",
  GAME: "#e74c3c",
  REST: "#27ae60",
};

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (eventDate.getTime() === today.getTime()) return "Today";
  if (eventDate.getTime() === yesterday.getTime()) return "Yesterday";

  const diffDays = Math.floor((today.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFutureDate(isoDate: string): string {
  const date = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (eventDate.getTime() === today.getTime()) return "Today";
  if (eventDate.getTime() === tomorrow.getTime()) return "Tomorrow";

  const diffDays = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ActivityFeed() {
  const router = useRouter();
  const { user, selectedOrganization } = useAuth();
  const [excuseModalVisible, setExcuseModalVisible] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventName, setSelectedEventName] = useState("");
  const [selectedEventDate, setSelectedEventDate] = useState("");
  const [excuseReason, setExcuseReason] = useState("");

  // Queries
  const { data: upcomingData, loading: upcomingLoading } = useQuery(GET_UPCOMING_EVENTS, {
    variables: { organizationId: selectedOrganization?.id, limit: 3 },
    skip: !selectedOrganization?.id,
  });

  const { data: checkinData, loading: checkinLoading } = useQuery(GET_CHECKIN_HISTORY, {
    variables: { userId: user?.id, limit: 50 },
    skip: !user?.id,
  });

  const { data: excuseData } = useQuery(GET_MY_EXCUSE_REQUESTS, {
    variables: { userId: user?.id },
    skip: !user?.id,
  });

  // Mutations
  const [createExcuse, { loading: creatingExcuse }] = useMutation(CREATE_EXCUSE_REQUEST, {
    refetchQueries: ["GetMyExcuseRequests"],
  });

  const [cancelExcuse] = useMutation(CANCEL_EXCUSE_REQUEST, {
    refetchQueries: ["GetMyExcuseRequests"],
  });

  const upcomingEvents = upcomingData?.upcomingEvents || [];
  const allCheckInHistory = checkinData?.checkInHistory || [];
  const excuseRequests = excuseData?.myExcuseRequests || [];

  // Only show check-ins from the last 7 days on this page
  const checkInHistory = useMemo(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);
    return allCheckInHistory.filter((ci: any) => {
      const ciDate = new Date(ci.event?.date || ci.checkInTime);
      return ciDate >= oneWeekAgo;
    });
  }, [allCheckInHistory]);

  // Map excuse requests by eventId for quick lookup
  const excusesByEvent = useMemo(() => {
    const map = new Map<string, any>();
    for (const er of excuseRequests) {
      if (er.status === "PENDING" || er.status === "APPROVED") {
        map.set(er.event.id, er);
      }
    }
    return map;
  }, [excuseRequests]);

  // Stats from all check-in history (not just this week)
  const stats = useMemo(() => {
    let onTime = 0;
    let late = 0;
    let absent = 0;
    for (const ci of allCheckInHistory) {
      if (ci.status === "ON_TIME") onTime++;
      else if (ci.status === "LATE") late++;
      else if (ci.status === "ABSENT") absent++;
    }
    return { onTime, late, absent };
  }, [allCheckInHistory]);

  const handleExcusePress = (event: any) => {
    setSelectedEventId(event.id);
    setSelectedEventName(event.title);
    setSelectedEventDate(event.date);
    setExcuseReason("");
    setExcuseModalVisible(true);
  };

  const handleSubmitExcuse = async () => {
    if (!selectedEventId || !excuseReason.trim() || !user?.id) return;

    try {
      await createExcuse({
        variables: {
          input: {
            userId: user.id,
            eventId: selectedEventId,
            reason: excuseReason.trim(),
          },
        },
      });
      setExcuseModalVisible(false);
      setSelectedEventId(null);
      setExcuseReason("");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit excuse request.");
    }
  };

  const handleCancelExcuse = (excuseId: string) => {
    Alert.alert("Cancel Excuse", "Are you sure you want to cancel this excuse request?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            await cancelExcuse({ variables: { id: excuseId } });
          } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to cancel excuse request.");
          }
        },
      },
    ]);
  };

  if (!user || !selectedOrganization) return null;

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
            {selectedEventId && (
              <View style={styles.excuseEventInfo}>
                <Text style={styles.excuseEventName}>{selectedEventName}</Text>
                <Text style={styles.excuseEventDate}>
                  {formatFutureDate(selectedEventDate)}
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
                  (!excuseReason.trim() || creatingExcuse) && styles.excuseButtonDisabled,
                ]}
                onPress={handleSubmitExcuse}
                disabled={!excuseReason.trim() || creatingExcuse}
              >
                {creatingExcuse ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.excuseButtonSubmitText}>Submit</Text>
                )}
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
          {checkinLoading ? (
            <View style={[styles.statCard, { flex: 1 }]}>
              <ActivityIndicator color="#a855f7" />
            </View>
          ) : (
            <>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: STATUS_CONFIG.ON_TIME.color }]}>
                  {stats.onTime}
                </Text>
                <Text style={styles.statLabel}>On Time</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: STATUS_CONFIG.LATE.color }]}>
                  {stats.late}
                </Text>
                <Text style={styles.statLabel}>Late</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: STATUS_CONFIG.ABSENT.color }]}>
                  {stats.absent}
                </Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
            </>
          )}
        </View>

        {/* Upcoming - Request Excuse */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          <Text style={styles.sectionSubtitle}>Request an excuse if you can't attend</Text>

          {upcomingLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#a855f7" />
            </View>
          ) : upcomingEvents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="calendar" size={20} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>No upcoming events</Text>
            </View>
          ) : (
            <View style={styles.upcomingList}>
              {upcomingEvents.map((event: any) => {
                const excuse = excusesByEvent.get(event.id);
                const eventColor = EVENT_TYPE_COLORS[event.type] || "#6c5ce7";

                return (
                  <View key={event.id} style={styles.upcomingCard}>
                    <View
                      style={[styles.upcomingAccent, { backgroundColor: eventColor }]}
                    />
                    <View style={styles.upcomingContent}>
                      <View style={styles.upcomingHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.upcomingName}>{event.title}</Text>
                          <Text style={styles.upcomingDate}>
                            {formatFutureDate(event.date)}
                            {event.startTime ? ` \u2022 ${event.startTime}` : ""}
                            {event.endTime ? ` - ${event.endTime}` : ""}
                          </Text>
                          {event.team && (
                            <Text style={styles.upcomingTeam}>{event.team.name}</Text>
                          )}
                        </View>
                      </View>
                      {excuse ? (
                        <View style={styles.excusedBadgeContainer}>
                          <View style={styles.excusedBadge}>
                            <Feather
                              name={excuse.status === "APPROVED" ? "check" : "clock"}
                              size={12}
                              color="#9b59b6"
                            />
                            <Text style={styles.excusedBadgeText}>
                              {excuse.status === "APPROVED" ? "Excused" : "Pending"}
                            </Text>
                          </View>
                          {excuse.status === "PENDING" && (
                            <Pressable
                              style={styles.cancelExcuseButton}
                              onPress={() => handleCancelExcuse(excuse.id)}
                            >
                              <Text style={styles.cancelExcuseText}>Cancel</Text>
                            </Pressable>
                          )}
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
                );
              })}
            </View>
          )}
        </View>

        {/* Check-In History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Check-In History</Text>
            <Pressable onPress={() => router.push("/checkin-history")}>
              <Text style={styles.seeAll}>See All</Text>
            </Pressable>
          </View>

          {checkinLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#a855f7" />
            </View>
          ) : checkInHistory.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="clipboard" size={20} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>No check-in history yet</Text>
            </View>
          ) : (
            <View style={styles.timelineContainer}>
              {checkInHistory.map((log: any, index: number) => {
                const config = STATUS_CONFIG[log.status as AttendanceStatus] || STATUS_CONFIG.ON_TIME;
                const isLast = index === checkInHistory.length - 1;
                const eventColor = EVENT_TYPE_COLORS[log.event?.type] || "#6c5ce7";

                return (
                  <View key={log.id} style={styles.timelineItem}>
                    {/* Timeline connector */}
                    <View style={styles.timelineLeft}>
                      <View
                        style={[styles.timelineDot, { backgroundColor: config.color }]}
                      >
                        <Feather name={config.icon as any} size={12} color="white" />
                      </View>
                      {!isLast && <View style={styles.timelineLine} />}
                    </View>

                    {/* Log content */}
                    <View style={[styles.timelineContent, isLast && { marginBottom: 0 }]}>
                      <View style={styles.logHeader}>
                        <Text style={styles.logDate}>
                          {log.event?.date ? formatDate(log.event.date) : ""}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: `${config.color}20` }]}>
                          <Text style={[styles.statusBadgeText, { color: config.color }]}>
                            {config.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.logCard}>
                        <View style={styles.logCardHeader}>
                          <View
                            style={[styles.logEventDot, { backgroundColor: eventColor }]}
                          />
                          <Text style={styles.logEventName}>
                            {log.event?.title || "Unknown Event"}
                          </Text>
                        </View>

                        <View style={styles.logDetails}>
                          {log.event?.startTime && (
                            <View style={styles.logDetailRow}>
                              <Text style={styles.logDetailLabel}>Scheduled</Text>
                              <Text style={styles.logDetailValue}>
                                {log.event.startTime}
                                {log.event.endTime ? ` - ${log.event.endTime}` : ""}
                              </Text>
                            </View>
                          )}

                          {log.checkInTime && (
                            <View style={styles.logDetailRow}>
                              <Text style={styles.logDetailLabel}>Check-in</Text>
                              <Text style={styles.logDetailValue}>
                                {new Date(log.checkInTime).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </Text>
                            </View>
                          )}

                          {log.checkOutTime && (
                            <View style={styles.logDetailRow}>
                              <Text style={styles.logDetailLabel}>Check-out</Text>
                              <Text style={styles.logDetailValue}>
                                {new Date(log.checkOutTime).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </Text>
                            </View>
                          )}

                          {log.hoursLogged != null && log.hoursLogged > 0 && (
                            <View style={styles.logDetailRow}>
                              <Text style={styles.logDetailLabel}>Hours Logged</Text>
                              <Text style={[styles.logDetailValue, styles.logHours]}>
                                {log.hoursLogged.toFixed(2)}h
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
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

  // Loading / Empty
  loadingContainer: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    paddingVertical: 20,
  },
  emptyText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
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
  upcomingTeam: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
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
