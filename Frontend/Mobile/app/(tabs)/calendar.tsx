import { useAuth } from "@/contexts/AuthContext";
import { NoOrgScreen } from "@/components/NoOrgScreen";
import { NotificationBell } from "@/components/NotificationBell";
import { GET_EVENTS, GET_CHECKIN_HISTORY, GET_MY_EXCUSE_REQUESTS, GET_MY_RSVPS } from "@/lib/graphql/queries";
import { CANCEL_EXCUSE_REQUEST, UPSERT_RSVP, DELETE_RSVP } from "@/lib/graphql/mutations";
import { useQuery, useMutation } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewToken,
} from "react-native";

type EventType = "practice" | "event" | "meeting" | "rest";

type CalendarEvent = {
  id: string;
  title: string;
  type: EventType;
  date: Date;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
  team?: { id: string; name: string };
};

const AVATAR_SIZE = 45;
const SCREEN_WIDTH = Dimensions.get("window").width;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EVENT_COLORS: Record<string, string> = {
  practice: "#6c5ce7",
  event: "#e74c3c",
  meeting: "#f39c12",
  rest: "#27ae60",
  PRACTICE: "#6c5ce7",
  EVENT: "#e74c3c",
  MEETING: "#f39c12",
  GAME: "#e74c3c",
};

const EVENT_ICONS: Record<string, string> = {
  practice: "target",
  event: "award",
  meeting: "users",
  rest: "coffee",
  PRACTICE: "target",
  EVENT: "award",
  MEETING: "users",
  GAME: "award",
};

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  ON_TIME: { color: "#27ae60", icon: "check-circle", label: "On Time" },
  LATE: { color: "#f39c12", icon: "clock", label: "Late" },
  ABSENT: { color: "#e74c3c", icon: "x-circle", label: "Absent" },
  EXCUSED: { color: "#9b59b6", icon: "info", label: "Excused" },
};

function getMonthData(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDay = firstDay.getDay();

  const days: (number | null)[] = [];

  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return days;
}

// Parse an ISO date string (e.g. "2026-02-12T12:00:00.000Z") into a local Date
// by extracting the YYYY-MM-DD portion. This avoids timezone offset shifting the day.
function parseEventDate(iso: string): Date {
  const [year, month, day] = iso.split("T")[0].split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatRelativeDate(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(date);
  eventDate.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function generateMonthsList() {
  const months: { year: number; month: number; key: string }[] = [];
  const today = new Date();
  for (let i = -24; i <= 24; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      key: `${date.getFullYear()}-${date.getMonth()}`,
    });
  }
  return months;
}

const monthsList = generateMonthsList();
const initialIndex = 24;

export default function Calendar() {
  const { user, selectedOrganization, targetUserId, isViewingAsGuardian } = useAuth();
  const [currentMonthIndex, setCurrentMonthIndex] = useState(initialIndex);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [dayPickerVisible, setDayPickerVisible] = useState(false);
  const [dayPickerEvents, setDayPickerEvents] = useState<CalendarEvent[]>([]);
  const [dayPickerDate, setDayPickerDate] = useState<Date | null>(null);
  const [eventsTab, setEventsTab] = useState<"upcoming" | "past">("upcoming");
  const [rsvpNote, setRsvpNote] = useState("");
  const [pendingRsvpStatus, setPendingRsvpStatus] = useState<"GOING" | "MAYBE" | "NOT_GOING" | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  const currentMonth = monthsList[currentMonthIndex];
  const today = new Date();

  // Fetch events for a wide range (3 months before and after current view)
  const startDate = useMemo(() => {
    const d = new Date(currentMonth.year, currentMonth.month - 3, 1);
    return d.toISOString().split("T")[0];
  }, [currentMonth.year, currentMonth.month]);

  const endDate = useMemo(() => {
    const d = new Date(currentMonth.year, currentMonth.month + 4, 0);
    return d.toISOString().split("T")[0];
  }, [currentMonth.year, currentMonth.month]);

  const { data: eventsData, loading: eventsLoading } = useQuery(GET_EVENTS, {
    variables: {
      organizationId: selectedOrganization?.id,
      startDate,
      endDate,
    },
    skip: !selectedOrganization?.id,
  });

  // Fetch user's check-in history and excuse requests
  const { data: checkinData } = useQuery(GET_CHECKIN_HISTORY, {
    variables: { userId: targetUserId, limit: 100 },
    skip: !targetUserId,
  });

  const { data: excuseData } = useQuery(GET_MY_EXCUSE_REQUESTS, {
    variables: { userId: targetUserId },
    skip: !targetUserId,
  });

  const { data: rsvpData } = useQuery(GET_MY_RSVPS, {
    variables: { userId: targetUserId },
    skip: !targetUserId,
  });

  const [cancelExcuse] = useMutation(CANCEL_EXCUSE_REQUEST, {
    refetchQueries: ["GetMyExcuseRequests"],
  });

  const [upsertRsvp] = useMutation(UPSERT_RSVP, {
    refetchQueries: ["GetMyRsvps"],
  });

  const [deleteRsvp] = useMutation(DELETE_RSVP, {
    refetchQueries: ["GetMyRsvps", "GetMyExcuseRequests"],
  });

  // Build lookup maps for check-ins and excuses by eventId
  const checkinByEvent = useMemo(() => {
    const map = new Map<string, any>();
    for (const ci of (checkinData?.checkInHistory || [])) {
      map.set(ci.event.id, ci);
    }
    return map;
  }, [checkinData]);

  const excuseByEvent = useMemo(() => {
    const map = new Map<string, any>();
    for (const er of (excuseData?.myExcuseRequests || [])) {
      if (er.status === "PENDING" || er.status === "APPROVED") {
        map.set(er.event.id, er);
      }
    }
    return map;
  }, [excuseData]);

  const rsvpByEvent = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of (rsvpData?.myRsvps || [])) {
      map.set(r.eventId, r);
    }
    return map;
  }, [rsvpData]);

  // Parse API events into CalendarEvent objects
  const events: CalendarEvent[] = useMemo(() => {
    if (!eventsData?.events) return [];
    return eventsData.events.map((e: any) => ({
      id: e.id,
      title: e.title,
      type: (e.type || "event").toLowerCase() as EventType,
      date: parseEventDate(e.date),
      startTime: e.startTime || "",
      endTime: e.endTime || "",
      location: e.location,
      description: e.description,
      team: e.team,
    }));
  }, [eventsData]);

  function getEventsForDate(date: Date): CalendarEvent[] {
    return events.filter(
      (event) =>
        event.date.getFullYear() === date.getFullYear() &&
        event.date.getMonth() === date.getMonth() &&
        event.date.getDate() === date.getDate()
    );
  }

  // Events for the currently viewed month
  const currentMonthEvents = useMemo(() =>
    events.filter(
      (e) =>
        e.date.getFullYear() === currentMonth.year &&
        e.date.getMonth() === currentMonth.month
    ),
    [events, currentMonth.year, currentMonth.month]
  );

  // Split current month's events into upcoming (today+future) and past
  const { monthUpcoming, monthPast } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcoming = currentMonthEvents
      .filter((e) => e.date >= now)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const past = currentMonthEvents
      .filter((e) => e.date < now)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    return { monthUpcoming: upcoming, monthPast: past };
  }, [currentMonthEvents]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentMonthIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const goToToday = () => {
    flatListRef.current?.scrollToIndex({ index: initialIndex, animated: true });
  };

  const handleDayPress = (day: number) => {
    const date = new Date(currentMonth.year, currentMonth.month, day);
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length === 1) {
      setPendingRsvpStatus(null);
      setRsvpNote("");
      setSelectedEvent(dayEvents[0]);
      setModalVisible(true);
    } else if (dayEvents.length > 1) {
      setDayPickerDate(date);
      setDayPickerEvents(dayEvents);
      setDayPickerVisible(true);
    }
  };

  const handlePickerSelectEvent = (event: CalendarEvent) => {
    setDayPickerVisible(false);
    setPendingRsvpStatus(null);
    setRsvpNote("");
    setSelectedEvent(event);
    setModalVisible(true);
  };

  const getEventColor = (type: string) => EVENT_COLORS[type] || EVENT_COLORS[type.toLowerCase()] || "#6c5ce7";
  const getEventIcon = (type: string) => EVENT_ICONS[type] || EVENT_ICONS[type.toLowerCase()] || "calendar";

  const renderMonth = ({
    item,
  }: {
    item: { year: number; month: number; key: string };
  }) => {
    const days = getMonthData(item.year, item.month);

    return (
      <View style={styles.monthContainer}>
        <View style={styles.weekHeader}>
          {DAYS_OF_WEEK.map((day) => (
            <View key={day} style={styles.weekDayCell}>
              <Text style={styles.weekDayText}>{day}</Text>
            </View>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {days.map((day, index) => {
            if (day === null) {
              return <View key={`empty-${index}`} style={styles.dayCell} />;
            }

            const date = new Date(item.year, item.month, day);
            const dayEvents = getEventsForDate(date);
            const isToday =
              today.getFullYear() === item.year &&
              today.getMonth() === item.month &&
              today.getDate() === day;
            const hasEvents = dayEvents.length > 0;

            return (
              <Pressable
                key={`day-${day}`}
                style={[styles.dayCell, hasEvents && styles.dayCellWithEvent]}
                onPress={() => hasEvents && handleDayPress(day)}
              >
                <View
                  style={[styles.dayNumber, isToday && styles.dayNumberToday]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isToday && styles.dayTextToday,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
                {hasEvents && (
                  <View style={styles.eventDots}>
                    <View
                      style={[
                        styles.eventDot,
                        { backgroundColor: getEventColor(dayEvents[0].type) },
                      ]}
                    />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  // Calculate stats for current month
  const practiceCount = currentMonthEvents.filter((e) => e.type === "practice").length;
  const eventCount = currentMonthEvents.filter((e) => e.type === "event" || e.type === "game").length;
  const meetingCount = currentMonthEvents.filter((e) => e.type === "meeting").length;

  const displayedEvents = eventsTab === "upcoming" ? monthUpcoming : monthPast;

  const isEventPast = selectedEvent ? selectedEvent.date < (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })() : false;
  const selectedCheckIn = selectedEvent ? checkinByEvent.get(selectedEvent.id) : null;
  const selectedExcuse = selectedEvent ? excuseByEvent.get(selectedEvent.id) : null;
  const selectedRsvp = selectedEvent ? rsvpByEvent.get(selectedEvent.id) : null;

  const handleRequestAbsence = () => {
    if (!selectedEvent) return;
    setModalVisible(false);
    router.push({
      pathname: "/request-absence",
      params: {
        eventId: selectedEvent.id,
        eventTitle: selectedEvent.title,
        eventDate: selectedEvent.date.toISOString(),
        eventStartTime: selectedEvent.startTime || "",
        eventEndTime: selectedEvent.endTime || "",
        eventType: selectedEvent.type || "",
        teamName: selectedEvent.team?.name || "",
      },
    });
  };

  const handleRsvpPress = async (status: "GOING" | "MAYBE" | "NOT_GOING") => {
    if (!selectedEvent || !targetUserId) return;
    const currentRsvp = rsvpByEvent.get(selectedEvent.id);
    // Tapping the already-selected status clears it
    if (currentRsvp?.status === status) {
      try {
        await deleteRsvp({ variables: { userId: targetUserId, eventId: selectedEvent.id } });
        setPendingRsvpStatus(null);
        setRsvpNote("");
      } catch (error: any) {
        Alert.alert("Error", error.message || "Failed to clear RSVP.");
      }
      return;
    }
    if (status === "NOT_GOING") {
      // Show note input before confirming
      setPendingRsvpStatus("NOT_GOING");
      setRsvpNote("");
      return;
    }
    try {
      await upsertRsvp({ variables: { input: { userId: targetUserId, eventId: selectedEvent.id, status } } });
      setPendingRsvpStatus(null);
      setRsvpNote("");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save RSVP.");
    }
  };

  const handleConfirmNotGoing = async () => {
    if (!selectedEvent || !targetUserId) return;
    try {
      await upsertRsvp({
        variables: {
          input: {
            userId: targetUserId,
            eventId: selectedEvent.id,
            status: "NOT_GOING",
            note: rsvpNote.trim() || undefined,
          },
        },
      });
      setPendingRsvpStatus(null);
      setRsvpNote("");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save RSVP.");
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

  if (!user) return null;
  if (!selectedOrganization) return <NoOrgScreen title="Calendar" />;

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />

      {/* Day Picker Modal — shown when multiple events on one day */}
      <Modal
        visible={dayPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDayPickerVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDayPickerVisible(false)}>
          <Pressable style={styles.dayPickerContainer} onPress={(e) => e.stopPropagation()}>
            {/* Handle bar */}
            <View style={styles.dayPickerHandle} />

            <Text style={styles.dayPickerTitle}>
              {dayPickerDate?.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>
            <Text style={styles.dayPickerSubtitle}>
              {dayPickerEvents.length} events — tap one to view details
            </Text>

            <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }}>
              <View style={styles.dayPickerList}>
                {dayPickerEvents.map((event) => (
                  <Pressable
                    key={event.id}
                    style={({ pressed }) => [styles.dayPickerItem, pressed && { opacity: 0.7 }]}
                    onPress={() => handlePickerSelectEvent(event)}
                  >
                    <View style={[styles.dayPickerAccent, { backgroundColor: getEventColor(event.type) }]} />
                    <View style={styles.dayPickerItemContent}>
                      <View style={styles.dayPickerItemTop}>
                        <Text style={styles.dayPickerItemTitle} numberOfLines={1}>{event.title}</Text>
                        <View style={[styles.dayPickerTypeBadge, { backgroundColor: `${getEventColor(event.type)}25` }]}>
                          <Text style={[styles.dayPickerTypeText, { color: getEventColor(event.type) }]}>
                            {event.type.charAt(0).toUpperCase() + event.type.slice(1).toLowerCase()}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.dayPickerItemMeta}>
                        {event.startTime ? (
                          <View style={styles.dayPickerMetaRow}>
                            <Feather name="clock" size={12} color="rgba(255,255,255,0.45)" />
                            <Text style={styles.dayPickerMetaText}>{event.startTime}{event.endTime ? ` – ${event.endTime}` : ""}</Text>
                          </View>
                        ) : null}
                        {event.location ? (
                          <View style={styles.dayPickerMetaRow}>
                            <Feather name="map-pin" size={12} color="rgba(255,255,255,0.45)" />
                            <Text style={styles.dayPickerMetaText} numberOfLines={1}>{event.location}</Text>
                          </View>
                        ) : null}
                        {event.team ? (
                          <View style={styles.dayPickerMetaRow}>
                            <Feather name="users" size={12} color="rgba(255,255,255,0.45)" />
                            <Text style={styles.dayPickerMetaText}>{event.team.name}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.3)" />
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Pressable
              style={({ pressed }) => [styles.dayPickerCloseBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setDayPickerVisible(false)}
            >
              <Text style={styles.dayPickerCloseBtnText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Event Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setModalVisible(false); setPendingRsvpStatus(null); setRsvpNote(""); }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => { setModalVisible(false); setPendingRsvpStatus(null); setRsvpNote(""); }}
        >
            <Pressable style={styles.eventModalContainer} onPress={(e) => e.stopPropagation()}>
            {selectedEvent && (
              <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View
                  style={[
                    styles.eventModalHeader,
                    { backgroundColor: getEventColor(selectedEvent.type) },
                  ]}
                >
                  <Feather
                    name={getEventIcon(selectedEvent.type) as any}
                    size={24}
                    color="white"
                  />
                  <Text style={styles.eventModalType}>
                    {selectedEvent.type.charAt(0).toUpperCase() +
                      selectedEvent.type.slice(1)}
                  </Text>
                </View>

                <View style={styles.eventModalContent}>
                  {/* Event Summary */}
                  <Text style={styles.eventModalTitle}>
                    {selectedEvent.title}
                  </Text>

                  <View style={styles.eventModalRow}>
                    <Feather name="calendar" size={16} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.eventModalText}>
                      {selectedEvent.date.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </Text>
                  </View>

                  {selectedEvent.startTime && (
                    <View style={styles.eventModalRow}>
                      <Feather name="clock" size={16} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.eventModalText}>
                        {selectedEvent.startTime} - {selectedEvent.endTime}
                      </Text>
                    </View>
                  )}

                  {selectedEvent.location && (
                    <View style={styles.eventModalRow}>
                      <Feather name="map-pin" size={16} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.eventModalText}>
                        {selectedEvent.location}
                      </Text>
                    </View>
                  )}

                  {selectedEvent.team && (
                    <View style={styles.eventModalRow}>
                      <Feather name="users" size={16} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.eventModalText}>
                        {selectedEvent.team.name}
                      </Text>
                    </View>
                  )}

                  {selectedEvent.description && (
                    <Text style={styles.eventModalDescription}>
                      {selectedEvent.description}
                    </Text>
                  )}

                  {/* Past Event: Attendance Info */}
                  {isEventPast && (
                    <View style={styles.attendanceSection}>
                      <Text style={styles.attendanceSectionTitle}>Your Attendance</Text>

                      {selectedCheckIn ? (
                        <View style={styles.attendanceCard}>
                          {/* Status Badge */}
                          <View style={styles.attendanceStatusRow}>
                            <View style={[
                              styles.attendanceStatusBadge,
                              { backgroundColor: `${(STATUS_CONFIG[selectedCheckIn.status] || STATUS_CONFIG.ABSENT).color}20` },
                            ]}>
                              <Feather
                                name={(STATUS_CONFIG[selectedCheckIn.status] || STATUS_CONFIG.ABSENT).icon as any}
                                size={14}
                                color={(STATUS_CONFIG[selectedCheckIn.status] || STATUS_CONFIG.ABSENT).color}
                              />
                              <Text style={[
                                styles.attendanceStatusText,
                                { color: (STATUS_CONFIG[selectedCheckIn.status] || STATUS_CONFIG.ABSENT).color },
                              ]}>
                                {(STATUS_CONFIG[selectedCheckIn.status] || STATUS_CONFIG.ABSENT).label}
                              </Text>
                            </View>
                          </View>

                          {/* Check-in/out times */}
                          {selectedCheckIn.checkInTime && (
                            <View style={styles.attendanceDetailRow}>
                              <Text style={styles.attendanceLabel}>Check-in</Text>
                              <Text style={styles.attendanceValue}>
                                {new Date(selectedCheckIn.checkInTime).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </Text>
                            </View>
                          )}

                          {selectedCheckIn.checkOutTime && (
                            <View style={styles.attendanceDetailRow}>
                              <Text style={styles.attendanceLabel}>Check-out</Text>
                              <Text style={styles.attendanceValue}>
                                {new Date(selectedCheckIn.checkOutTime).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </Text>
                            </View>
                          )}

                          {selectedCheckIn.hoursLogged != null && selectedCheckIn.hoursLogged > 0 && (
                            <View style={styles.attendanceDetailRow}>
                              <Text style={styles.attendanceLabel}>Hours Logged</Text>
                              <Text style={[styles.attendanceValue, { color: "#27ae60", fontWeight: "700" }]}>
                                {selectedCheckIn.hoursLogged.toFixed(2)}h
                              </Text>
                            </View>
                          )}
                        </View>
                      ) : selectedExcuse ? (
                        <View style={styles.attendanceCard}>
                          <View style={styles.attendanceStatusRow}>
                            <View style={[styles.attendanceStatusBadge, { backgroundColor: "rgba(155,89,182,0.2)" }]}>
                              <Feather name="info" size={14} color="#9b59b6" />
                              <Text style={[styles.attendanceStatusText, { color: "#9b59b6" }]}>
                                {selectedExcuse.status === "APPROVED" ? "Excused" : "Excuse Pending"}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.excuseReasonBox}>
                            <Text style={styles.excuseReasonLabel}>Reason</Text>
                            <Text style={styles.excuseReasonText}>{selectedExcuse.reason}</Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.attendanceCard}>
                          <View style={styles.attendanceStatusRow}>
                            <View style={[styles.attendanceStatusBadge, { backgroundColor: "rgba(231,76,60,0.2)" }]}>
                              <Feather name="x-circle" size={14} color="#e74c3c" />
                              <Text style={[styles.attendanceStatusText, { color: "#e74c3c" }]}>
                                Absent
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.noAttendanceText}>No check-in recorded</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Upcoming Event: RSVP Widget */}
                  {!isEventPast && !isViewingAsGuardian && (
                    <View style={styles.attendanceSection}>
                      <Text style={styles.attendanceSectionTitle}>Are you going?</Text>

                      {/* RSVP Pill Buttons */}
                      <View style={styles.rsvpPillRow}>
                        {(["GOING", "MAYBE", "NOT_GOING"] as const).map((status) => {
                          const isSelected = selectedRsvp?.status === status || pendingRsvpStatus === status;
                          const colors: Record<string, { bg: string; text: string; activeBg: string }> = {
                            GOING: { bg: "rgba(39,174,96,0.15)", text: "#27ae60", activeBg: "rgba(39,174,96,0.35)" },
                            MAYBE: { bg: "rgba(243,156,18,0.15)", text: "#f39c12", activeBg: "rgba(243,156,18,0.35)" },
                            NOT_GOING: { bg: "rgba(231,76,60,0.15)", text: "#e74c3c", activeBg: "rgba(231,76,60,0.35)" },
                          };
                          const c = colors[status];
                          const labels: Record<string, string> = { GOING: "Going", MAYBE: "Maybe", NOT_GOING: "Not Going" };
                          return (
                            <Pressable
                              key={status}
                              style={({ pressed }) => [
                                styles.rsvpPill,
                                { backgroundColor: isSelected ? c.activeBg : c.bg, borderColor: c.text },
                                pressed && { opacity: 0.7 },
                              ]}
                              onPress={() => handleRsvpPress(status)}
                            >
                              <Text style={[styles.rsvpPillText, { color: c.text, fontWeight: isSelected ? "700" : "500" }]}>
                                {labels[status]}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {/* Not Going note input */}
                      {pendingRsvpStatus === "NOT_GOING" && (
                        <View style={styles.rsvpNoteContainer}>
                          <TextInput
                            style={styles.rsvpNoteInput}
                            placeholder="Reason (optional)"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            value={rsvpNote}
                            onChangeText={setRsvpNote}
                            multiline
                          />
                          <Pressable
                            style={({ pressed }) => [styles.rsvpConfirmBtn, pressed && { opacity: 0.7 }]}
                            onPress={handleConfirmNotGoing}
                          >
                            <Text style={styles.rsvpConfirmBtnText}>Confirm</Text>
                          </Pressable>
                        </View>
                      )}

                      {/* Excuse status block (auto-created or manual) */}
                      {selectedExcuse && (
                        <View style={[styles.attendanceCard, { marginTop: 10 }]}>
                          <View style={styles.attendanceStatusRow}>
                            <View style={[styles.attendanceStatusBadge, { backgroundColor: "rgba(155,89,182,0.2)" }]}>
                              <Feather
                                name={selectedExcuse.status === "APPROVED" ? "check" : "clock"}
                                size={14}
                                color="#9b59b6"
                              />
                              <Text style={[styles.attendanceStatusText, { color: "#9b59b6" }]}>
                                {selectedExcuse.status === "APPROVED" ? "Excused" : "Excuse Pending"}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.excuseReasonBox}>
                            <Text style={styles.excuseReasonLabel}>Reason</Text>
                            <Text style={styles.excuseReasonText}>{selectedExcuse.reason}</Text>
                          </View>
                          {selectedExcuse.status === "PENDING" && (
                            <Pressable
                              style={({ pressed }) => [styles.cancelExcuseBtn, pressed && { opacity: 0.7 }]}
                              onPress={() => handleCancelExcuse(selectedExcuse.id)}
                            >
                              <Text style={styles.cancelExcuseBtnText}>Cancel Request</Text>
                            </Pressable>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  <Pressable
                    style={({ pressed }) => [
                      styles.eventModalButton,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => { setModalVisible(false); setPendingRsvpStatus(null); setRsvpNote(""); }}
                  >
                    <Text style={styles.eventModalButtonText}>Close</Text>
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Calendar</Text>
        </View>

        <View style={styles.headerRight}>
          <NotificationBell />
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
      </View>

      {/* Month/Year Title and Navigation */}
      <View style={styles.monthHeader}>
        <View style={styles.monthNavigation}>
          <Pressable
            style={({ pressed }) => [
              styles.monthArrow,
              pressed && { opacity: 0.5 },
            ]}
            onPress={() => {
              if (currentMonthIndex > 0) {
                flatListRef.current?.scrollToIndex({
                  index: currentMonthIndex - 1,
                  animated: true,
                });
              }
            }}
          >
            <Feather name="chevron-left" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>
          <Text style={styles.monthTitle}>
            {MONTHS[currentMonth.month]} {currentMonth.year}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.monthArrow,
              pressed && { opacity: 0.5 },
            ]}
            onPress={() => {
              if (currentMonthIndex < monthsList.length - 1) {
                flatListRef.current?.scrollToIndex({
                  index: currentMonthIndex + 1,
                  animated: true,
                });
              }
            }}
          >
            <Feather name="chevron-right" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.todayButton,
            pressed && { opacity: 0.7 },
          ]}
          onPress={goToToday}
        >
          <Text style={styles.todayButtonText}>Today</Text>
        </Pressable>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {eventsLoading ? (
          <ActivityIndicator color="#a855f7" />
        ) : (
          <>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: EVENT_COLORS.practice }]} />
              <Text style={styles.statText}>{practiceCount} Practices</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: EVENT_COLORS.event }]} />
              <Text style={styles.statText}>{eventCount} Events</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: EVENT_COLORS.meeting }]} />
              <Text style={styles.statText}>{meetingCount} Meetings</Text>
            </View>
          </>
        )}
      </View>

      {/* Swipeable Calendar */}
      <FlatList
        ref={flatListRef}
        data={monthsList}
        renderItem={renderMonth}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={styles.calendarList}
      />

      {/* Events Tabs */}
      <View style={styles.tabSection}>
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, eventsTab === "upcoming" && styles.tabActive]}
            onPress={() => setEventsTab("upcoming")}
          >
            <Text style={[styles.tabText, eventsTab === "upcoming" && styles.tabTextActive]}>
              Upcoming ({monthUpcoming.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, eventsTab === "past" && styles.tabActive]}
            onPress={() => setEventsTab("past")}
          >
            <Text style={[styles.tabText, eventsTab === "past" && styles.tabTextActive]}>
              Past ({monthPast.length})
            </Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.upcomingList}>
          {eventsLoading ? (
            <View style={styles.noEventsCard}>
              <ActivityIndicator color="#a855f7" />
            </View>
          ) : displayedEvents.length === 0 ? (
            <View style={styles.noEventsCard}>
              <Feather name="calendar" size={20} color="rgba(255,255,255,0.3)" />
              <Text style={styles.noEventsText}>
                {eventsTab === "upcoming" ? "No upcoming events this month" : "No past events this month"}
              </Text>
            </View>
          ) : (
            displayedEvents.map((event) => (
              <Pressable
                key={event.id}
                style={({ pressed }) => [
                  styles.upcomingCard,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => {
                  setPendingRsvpStatus(null);
                  setRsvpNote("");
                  setSelectedEvent(event);
                  setModalVisible(true);
                }}
              >
                <View
                  style={[
                    styles.upcomingCardAccent,
                    { backgroundColor: getEventColor(event.type) },
                  ]}
                />
                <View style={styles.upcomingCardContent}>
                  <View style={styles.upcomingCardHeader}>
                    <Text style={styles.upcomingCardTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text style={styles.upcomingCardDate}>
                      {formatRelativeDate(event.date)}
                    </Text>
                  </View>
                  <View style={styles.upcomingCardDetails}>
                    {event.startTime && (
                      <View style={styles.upcomingCardDetail}>
                        <Feather name="clock" size={12} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.upcomingCardDetailText}>
                          {event.startTime}
                        </Text>
                      </View>
                    )}
                    {event.location && (
                      <View style={styles.upcomingCardDetail}>
                        <Feather name="map-pin" size={12} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.upcomingCardDetailText} numberOfLines={1}>
                          {event.location}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.3)" />
              </Pressable>
            ))
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
    flex: 1,
    minHeight: 58,
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  // Month Header
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  monthNavigation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  monthArrow: {
    padding: 4,
  },
  monthTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    minWidth: 160,
    textAlign: "center",
  },
  todayButton: {
    backgroundColor: "rgba(108,92,231,0.3)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  todayButtonText: {
    color: "#a855f7",
    fontSize: 14,
    fontWeight: "600",
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    marginBottom: 8,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "500",
  },

  // Calendar
  calendarList: {
    flexGrow: 0,
  },
  monthContainer: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 20,
  },
  weekHeader: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekDayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  weekDayText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: Math.floor((SCREEN_WIDTH - 40) / 7),
    height: 40,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  dayCellWithEvent: {},
  dayNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumberToday: {
    backgroundColor: "#6c5ce7",
  },
  dayText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  dayTextToday: {
    fontWeight: "bold",
  },
  eventDots: {
    flexDirection: "row",
    gap: 3,
    marginTop: 2,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Tabs
  tabSection: {
    paddingHorizontal: 20,
    marginTop: 4,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "rgba(108,92,231,0.4)",
  },
  tabText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "white",
  },

  // Event Cards
  upcomingList: {
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  upcomingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  upcomingCardAccent: {
    width: 4,
    alignSelf: "stretch",
  },
  upcomingCardContent: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  upcomingCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  upcomingCardTitle: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  upcomingCardDate: {
    color: "#a855f7",
    fontSize: 13,
    fontWeight: "600",
  },
  upcomingCardDetails: {
    flexDirection: "row",
    gap: 14,
  },
  upcomingCardDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  upcomingCardDetailText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  noEventsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    paddingVertical: 20,
  },
  noEventsText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  eventModalContainer: {
    backgroundColor: "#2a2550",
    borderRadius: 16,
    width: "100%",
    maxWidth: 340,
    maxHeight: "80%",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  eventModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  eventModalType: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  eventModalContent: {
    padding: 20,
  },
  eventModalTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  eventModalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  eventModalText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
  },
  eventModalDescription: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  eventModalButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  eventModalButtonText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    fontWeight: "600",
  },

  // Attendance section in modal
  attendanceSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  attendanceSectionTitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  attendanceCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  attendanceStatusRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  attendanceStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  attendanceStatusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  attendanceDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
  },
  attendanceLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },
  attendanceValue: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "600",
  },
  noAttendanceText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
  },
  excuseReasonBox: {
    marginTop: 4,
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

  // Excuse request button
  requestExcuseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(168,85,247,0.15)",
    paddingVertical: 12,
    borderRadius: 10,
  },
  requestExcuseBtnText: {
    color: "#a855f7",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelExcuseBtn: {
    alignItems: "center",
    marginTop: 10,
    paddingVertical: 8,
  },
  cancelExcuseBtnText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    fontWeight: "500",
  },

  // RSVP
  rsvpPillRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  rsvpPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  rsvpPillText: {
    fontSize: 13,
  },
  rsvpNoteContainer: {
    gap: 8,
    marginTop: 4,
  },
  rsvpNoteInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "white",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    minHeight: 60,
    textAlignVertical: "top",
  },
  rsvpConfirmBtn: {
    backgroundColor: "rgba(231,76,60,0.3)",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  rsvpConfirmBtnText: {
    color: "#e74c3c",
    fontSize: 14,
    fontWeight: "600",
  },

  // Day Picker Modal
  dayPickerContainer: {
    backgroundColor: "#2a2550",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: "100%",
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  dayPickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 16,
  },
  dayPickerTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  dayPickerSubtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    marginBottom: 16,
  },
  dayPickerList: {
    gap: 8,
  },
  dayPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  dayPickerAccent: {
    width: 4,
    alignSelf: "stretch",
  },
  dayPickerItemContent: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 6,
  },
  dayPickerItemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  dayPickerItemTitle: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  dayPickerTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dayPickerTypeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  dayPickerItemMeta: {
    gap: 4,
  },
  dayPickerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dayPickerMetaText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  dayPickerCloseBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 16,
  },
  dayPickerCloseBtnText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    fontWeight: "600",
  },
});
