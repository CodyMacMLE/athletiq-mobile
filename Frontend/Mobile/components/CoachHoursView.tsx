import { useAuth } from "@/contexts/AuthContext";
import { GET_COACH_MY_HOURS, GET_EVENTS } from "@/lib/graphql/queries";
import { ADMIN_CHECK_IN } from "@/lib/graphql/mutations";
import { useMutation, useQuery } from "@apollo/client";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRef, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NotificationBell } from "./NotificationBell";
import { OrgTeamSubtitle } from "./OrgTeamSubtitle";

const AVATAR_SIZE = 45;
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EVENT_COLORS: Record<string, string> = {
  PRACTICE: "#6c5ce7",
  EVENT: "#e74c3c",
  MEETING: "#f39c12",
  REST: "#27ae60",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMonthData(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
}

function parseEventDate(iso: string): Date {
  const [year, month, day] = iso.split("T")[0].split("-").map(Number);
  return new Date(year, month - 1, day);
}

function buildDateTime(dateISO: string, timeStr: string): string {
  const base = parseEventDate(dateISO);
  const parts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!parts) return base.toISOString();
  let h = parseInt(parts[1], 10);
  const m = parseInt(parts[2], 10);
  const period = parts[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  base.setHours(h, m, 0, 0);
  return base.toISOString();
}

function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatEventDate(isoString: string): string {
  return parseEventDate(isoString).toLocaleDateString([], {
    weekday: "short", month: "short", day: "numeric",
  });
}

function getEventColor(type: string): string {
  return EVENT_COLORS[type] || EVENT_COLORS[type?.toUpperCase?.()] || "#6c5ce7";
}

// ─── Day Sheet ───────────────────────────────────────────────────────────────

interface DayEvent {
  id: string;
  title: string;
  type: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface DayEntry {
  event: DayEvent;
  checkIn: { id: string; checkInTime: string | null; checkOutTime: string | null; status: string } | null;
  hoursLogged: number;
}

function DaySheet({
  visible,
  date,
  entries,
  eventsOnDay,
  userId,
  organizationId,
  slideAnim,
  backdropAnim,
  onClose,
  onCheckInAdded,
}: {
  visible: boolean;
  date: Date | null;
  entries: DayEntry[];
  eventsOnDay: DayEvent[];
  userId: string;
  organizationId: string;
  slideAnim: Animated.Value;
  backdropAnim: Animated.Value;
  onClose: () => void;
  onCheckInAdded: () => void;
}) {
  const [addCheckIn] = useMutation(ADMIN_CHECK_IN);
  const [addingEventId, setAddingEventId] = useState<string | null>(null);

  const checkedInEventIds = new Set(entries.map((e) => e.event.id));
  const missedEvents = eventsOnDay.filter((ev) => !checkedInEventIds.has(ev.id));

  async function handleAdd(event: DayEvent) {
    setAddingEventId(event.id);
    try {
      await addCheckIn({
        variables: {
          input: {
            userId,
            eventId: event.id,
            status: "ON_TIME",
            checkInTime: buildDateTime(event.date, event.startTime),
            checkOutTime: buildDateTime(event.date, event.endTime),
          },
        },
      });
      onCheckInAdded();
    } finally {
      setAddingEventId(null);
    }
  }

  const dateLabel = date?.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.dayPickerOverlay}>
        {/* Fading backdrop */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.dayPickerBackdrop, { opacity: backdropAnim }]}
        />
        {/* Dismiss tap */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {/* Sliding sheet */}
        <Animated.View style={{ transform: [{ translateY: slideAnim }], width: "100%" }}>
          <Pressable style={styles.dayPickerContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dayPickerHandle} />
            <Text style={styles.dayPickerTitle}>{dateLabel}</Text>

            <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {/* Logged entries */}
              {entries.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.dayPickerSubtitle}>Logged Hours</Text>
                  <View style={styles.dayPickerList}>
                    {entries.map((entry, idx) => (
                      <View key={entry.checkIn?.id ?? idx} style={styles.dayPickerItem}>
                        <View style={[styles.dayPickerAccent, { backgroundColor: getEventColor(entry.event.type) }]} />
                        <View style={styles.dayPickerItemContent}>
                          <View style={styles.dayPickerItemTop}>
                            <Text style={styles.dayPickerItemTitle} numberOfLines={1}>
                              {entry.event.title}
                            </Text>
                            <View style={[styles.dayPickerTypeBadge, { backgroundColor: "rgba(167,139,250,0.15)" }]}>
                              <Text style={[styles.dayPickerTypeText, { color: "#a78bfa" }]}>
                                {entry.hoursLogged.toFixed(2)} hrs
                              </Text>
                            </View>
                          </View>
                          <View style={styles.dayPickerItemMeta}>
                            <View style={styles.dayPickerMetaRow}>
                              <Feather name="clock" size={12} color="rgba(255,255,255,0.45)" />
                              <Text style={styles.dayPickerMetaText}>
                                {formatTime(entry.checkIn?.checkInTime)} – {formatTime(entry.checkIn?.checkOutTime)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Missed events to add */}
              {missedEvents.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.dayPickerSubtitle}>Add Missed Class</Text>
                  <View style={styles.dayPickerList}>
                    {missedEvents.map((event) => (
                      <View key={event.id} style={styles.dayPickerItem}>
                        <View style={[styles.dayPickerAccent, { backgroundColor: getEventColor(event.type) }]} />
                        <View style={styles.dayPickerItemContent}>
                          <View style={styles.dayPickerItemTop}>
                            <Text style={styles.dayPickerItemTitle} numberOfLines={1}>
                              {event.title}
                            </Text>
                          </View>
                          <View style={styles.dayPickerItemMeta}>
                            {event.startTime ? (
                              <View style={styles.dayPickerMetaRow}>
                                <Feather name="clock" size={12} color="rgba(255,255,255,0.45)" />
                                <Text style={styles.dayPickerMetaText}>
                                  {event.startTime}{event.endTime ? ` – ${event.endTime}` : ""}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <Pressable
                          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
                          onPress={() => handleAdd(event)}
                          disabled={addingEventId === event.id}
                        >
                          {addingEventId === event.id ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <Text style={styles.addBtnText}>+ Add</Text>
                          )}
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {entries.length === 0 && missedEvents.length === 0 && (
                <Text style={styles.dayPickerEmpty}>No events scheduled for this day.</Text>
              )}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [styles.dayPickerCloseBtn, pressed && { opacity: 0.7 }]}
              onPress={onClose}
            >
              <Text style={styles.dayPickerCloseBtnText}>Close</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CoachHoursView() {
  const { user, selectedOrganization } = useAuth();
  const today = new Date();

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonthNum, setCurrentMonthNum] = useState(today.getMonth()); // 0-indexed like calendar.tsx
  const currentYearRef = useRef(today.getFullYear());
  const currentMonthNumRef = useRef(today.getMonth());
  currentYearRef.current = currentYear;
  currentMonthNumRef.current = currentMonthNum;

  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetDate, setSheetDate] = useState<Date | null>(null);

  const backdropAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Swipe left/right to change month (same pattern as calendar.tsx)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5 && Math.abs(gs.dx) > 10,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -40) {
          const y = currentYearRef.current;
          const m = currentMonthNumRef.current;
          if (m === 11) { setCurrentYear(y + 1); setCurrentMonthNum(0); }
          else setCurrentMonthNum(m + 1);
        } else if (gs.dx > 40) {
          const y = currentYearRef.current;
          const m = currentMonthNumRef.current;
          if (m === 0) { setCurrentYear(y - 1); setCurrentMonthNum(11); }
          else setCurrentMonthNum(m - 1);
        }
      },
    })
  ).current;

  const goToPrevMonth = () => {
    if (currentMonthNum === 0) { setCurrentYear((y) => y - 1); setCurrentMonthNum(11); }
    else setCurrentMonthNum((m) => m - 1);
  };

  const goToNextMonth = () => {
    if (currentMonthNum === 11) { setCurrentYear((y) => y + 1); setCurrentMonthNum(0); }
    else setCurrentMonthNum((m) => m + 1);
  };

  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonthNum(today.getMonth());
  };

  // API uses 1-indexed months
  const apiMonth = currentMonthNum + 1;

  const startDate = useMemo(() => {
    const d = new Date(currentYear, currentMonthNum, 1);
    return d.toISOString().split("T")[0];
  }, [currentYear, currentMonthNum]);

  const endDate = useMemo(() => {
    const d = new Date(currentYear, currentMonthNum + 1, 0);
    return d.toISOString().split("T")[0];
  }, [currentYear, currentMonthNum]);

  const { data: hoursData, loading: hoursLoading, refetch } = useQuery(GET_COACH_MY_HOURS, {
    variables: { organizationId: selectedOrganization?.id ?? "", month: apiMonth, year: currentYear },
    skip: !selectedOrganization?.id,
    fetchPolicy: "cache-and-network",
  });

  const { data: eventsData } = useQuery(GET_EVENTS, {
    variables: { organizationId: selectedOrganization?.id ?? "", startDate, endDate },
    skip: !selectedOrganization?.id,
    fetchPolicy: "cache-and-network",
  });

  const hours = hoursData?.coachMyHours;
  const allEvents: DayEvent[] = useMemo(
    () => (eventsData?.events ?? []).map((e: any) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      date: e.date,
      startTime: e.startTime || "",
      endTime: e.endTime || "",
    })),
    [eventsData]
  );

  // Map day number → events on that day
  const eventsByDay = useMemo(() => {
    const map = new Map<number, DayEvent[]>();
    allEvents.forEach((ev) => {
      const d = parseEventDate(ev.date).getDate();
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(ev);
    });
    return map;
  }, [allEvents]);

  // Days that have at least one check-in entry
  const checkedInDays = useMemo(() => {
    const s = new Set<number>();
    (hours?.entries ?? []).forEach((e: DayEntry) => s.add(parseEventDate(e.event.date).getDate()));
    return s;
  }, [hours]);

  // Entries for the sheet date
  const sheetEntries: DayEntry[] = useMemo(() => {
    if (!sheetDate) return [];
    const d = sheetDate.getDate();
    return (hours?.entries ?? []).filter(
      (e: DayEntry) => parseEventDate(e.event.date).getDate() === d
    );
  }, [sheetDate, hours]);

  const sheetEvents: DayEvent[] = useMemo(() => {
    if (!sheetDate) return [];
    return eventsByDay.get(sheetDate.getDate()) ?? [];
  }, [sheetDate, eventsByDay]);

  function openSheet(date: Date) {
    backdropAnim.setValue(0);
    slideAnim.setValue(SCREEN_HEIGHT);
    setSheetDate(date);
    setSheetVisible(true);
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();
  }

  function closeSheet(callback?: () => void) {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 240, useNativeDriver: true }),
    ]).start(() => {
      setSheetVisible(false);
      callback?.();
    });
  }

  const handleDayPress = (day: number) => {
    const dayEvents = eventsByDay.get(day) ?? [];
    const hasEntry = checkedInDays.has(day);
    if (dayEvents.length > 0 || hasEntry) {
      openSheet(new Date(currentYear, currentMonthNum, day));
    }
  };

  // Stats for the month
  const practiceCount = allEvents.filter((e) => e.type === "PRACTICE").length;
  const eventCount = allEvents.filter((e) => e.type === "EVENT").length;
  const meetingCount = allEvents.filter((e) => e.type === "MEETING").length;

  const calendarDays = getMonthData(currentYear, currentMonthNum);

  return (
    <>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>My Hours</Text>
            <OrgTeamSubtitle onPress={() => {}} />
          </View>
          <View style={styles.headerRight}>
            <NotificationBell />
            {user?.image ? (
              <Image source={user.image} style={[styles.avatar, styles.avatarImage]} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Month Navigation ── */}
        <View style={styles.monthHeader}>
          <View style={styles.monthNavigation}>
            <Pressable
              style={({ pressed }) => [styles.monthArrow, pressed && { opacity: 0.5 }]}
              onPress={goToPrevMonth}
            >
              <Feather name="chevron-left" size={22} color="rgba(255,255,255,0.6)" />
            </Pressable>
            <Text style={styles.monthTitle}>
              {MONTHS[currentMonthNum]} {currentYear}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.monthArrow, pressed && { opacity: 0.5 }]}
              onPress={goToNextMonth}
            >
              <Feather name="chevron-right" size={22} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>
          <Pressable
            style={({ pressed }) => [styles.todayButton, pressed && { opacity: 0.7 }]}
            onPress={goToToday}
          >
            <Text style={styles.todayButtonText}>Today</Text>
          </Pressable>
        </View>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          {hoursLoading ? (
            <ActivityIndicator color="#a855f7" />
          ) : (
            <>
              <View style={styles.statItem}>
                <View style={[styles.statDot, { backgroundColor: EVENT_COLORS.PRACTICE }]} />
                <Text style={styles.statText}>{practiceCount} Practices</Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statDot, { backgroundColor: EVENT_COLORS.EVENT }]} />
                <Text style={styles.statText}>{eventCount} Events</Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statDot, { backgroundColor: EVENT_COLORS.MEETING }]} />
                <Text style={styles.statText}>{meetingCount} Meetings</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Calendar Grid ── */}
        <View style={styles.monthContainer} {...panResponder.panHandlers}>
          {/* Day-of-week headers */}
          <View style={styles.weekHeader}>
            {DAYS_OF_WEEK.map((day) => (
              <View key={day} style={styles.weekDayCell}>
                <Text style={styles.weekDayText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Day cells */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }

              const isToday =
                today.getFullYear() === currentYear &&
                today.getMonth() === currentMonthNum &&
                today.getDate() === day;
              const hasCheckIn = checkedInDays.has(day);
              const dayEventsForCell = eventsByDay.get(day) ?? [];
              const hasEvent = dayEventsForCell.length > 0;
              const isTappable = hasEvent || hasCheckIn;

              return (
                <Pressable
                  key={`day-${day}`}
                  style={styles.dayCell}
                  onPress={() => isTappable && handleDayPress(day)}
                >
                  <View
                    style={[
                      styles.dayNumber,
                      isToday && styles.dayNumberToday,
                      hasCheckIn && !isToday && styles.dayNumberChecked,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        (isToday || hasCheckIn) && styles.dayTextHighlighted,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                  {hasEvent && (
                    <View style={styles.eventDots}>
                      <View
                        style={[
                          styles.eventDot,
                          { backgroundColor: getEventColor(dayEventsForCell[0].type) },
                        ]}
                      />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Summary Cards ── */}
        <View style={styles.cards}>
          <View style={styles.card}>
            <Text style={styles.cardValue}>{hours?.totalHours?.toFixed(1) ?? "0.0"} hrs</Text>
            <Text style={styles.cardLabel}>This month</Text>
          </View>
          {hours?.hourlyRate != null && (
            <View style={styles.card}>
              <Text style={styles.cardValue}>
                ${hours?.totalPay != null ? hours.totalPay.toFixed(2) : "0.00"}
              </Text>
              <Text style={styles.cardLabel}>Est. pay</Text>
            </View>
          )}
        </View>

        {/* ── Entries List ── */}
        {!hoursLoading && (
          <View style={styles.upcomingList}>
            {(hours?.entries?.length ?? 0) === 0 ? (
              <View style={styles.noEventsCard}>
                <Feather name="clock" size={20} color="rgba(255,255,255,0.3)" />
                <Text style={styles.noEventsText}>
                  No check-ins for {MONTHS[currentMonthNum]} {currentYear}
                </Text>
              </View>
            ) : (
              hours.entries.map((entry: DayEntry, idx: number) => (
                <Pressable
                  key={entry.checkIn?.id ?? idx}
                  style={({ pressed }) => [styles.upcomingCard, pressed && { opacity: 0.8 }]}
                  onPress={() => openSheet(parseEventDate(entry.event.date))}
                >
                  <View
                    style={[
                      styles.upcomingCardAccent,
                      { backgroundColor: getEventColor(entry.event.type) },
                    ]}
                  />
                  <View style={styles.upcomingCardContent}>
                    <View style={styles.upcomingCardHeader}>
                      <Text style={styles.upcomingCardTitle} numberOfLines={1}>
                        {entry.event.title}
                      </Text>
                      <Text style={styles.upcomingCardHours}>
                        {entry.hoursLogged.toFixed(2)} hrs
                      </Text>
                    </View>
                    <View style={styles.upcomingCardDetails}>
                      <View style={styles.upcomingCardDetail}>
                        <Feather name="calendar" size={12} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.upcomingCardDetailText}>
                          {formatEventDate(entry.event.date)}
                        </Text>
                      </View>
                      <View style={styles.upcomingCardDetail}>
                        <Feather name="clock" size={12} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.upcomingCardDetailText}>
                          {formatTime(entry.checkIn?.checkInTime)} – {formatTime(entry.checkIn?.checkOutTime)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.3)" />
                </Pressable>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Day Sheet ── */}
      <DaySheet
        visible={sheetVisible}
        date={sheetDate}
        entries={sheetEntries}
        eventsOnDay={sheetEvents}
        userId={user?.id ?? ""}
        organizationId={selectedOrganization?.id ?? ""}
        slideAnim={slideAnim}
        backdropAnim={backdropAnim}
        onClose={() => closeSheet()}
        onCheckInAdded={() => closeSheet(() => refetch())}
      />
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  // Header
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
  title: { color: "white", fontSize: 22, fontWeight: "bold" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
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
  avatarImage: { backgroundColor: "transparent" },
  avatarText: { color: "white", fontSize: 15, fontWeight: "600" },

  // Month header — exact copy from calendar.tsx
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
  monthArrow: { padding: 4 },
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
  todayButtonText: { color: "#a855f7", fontSize: 14, fontWeight: "600" },

  // Stats row — exact copy from calendar.tsx
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
  statItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statText: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "500" },

  // Calendar grid — exact copy from calendar.tsx
  monthContainer: { paddingHorizontal: 20, paddingBottom: 8 },
  weekHeader: { flexDirection: "row", marginBottom: 8 },
  weekDayCell: { flex: 1, alignItems: "center", paddingVertical: 8 },
  weekDayText: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: Math.floor((SCREEN_WIDTH - 40) / 7),
    height: 48,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  dayNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumberToday: { backgroundColor: "#6c5ce7" },
  dayNumberChecked: { backgroundColor: "rgba(108,92,231,0.4)", borderWidth: 1.5, borderColor: "#6c5ce7" },
  dayText: { color: "white", fontSize: 14, fontWeight: "500" },
  dayTextHighlighted: { fontWeight: "bold" },
  eventDots: { flexDirection: "row", gap: 3, marginTop: 5 },
  eventDot: { width: 6, height: 6, borderRadius: 3 },

  // Summary cards
  cards: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cardValue: { color: "white", fontSize: 20, fontWeight: "700", marginBottom: 4 },
  cardLabel: { color: "rgba(255,255,255,0.6)", fontSize: 13 },

  // Entries list — using same card style as calendar.tsx upcomingCard
  upcomingList: { gap: 10, paddingHorizontal: 20, paddingTop: 4 },
  upcomingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  upcomingCardAccent: { width: 4, alignSelf: "stretch" },
  upcomingCardContent: { flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
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
  upcomingCardHours: { color: "#a78bfa", fontSize: 13, fontWeight: "600" },
  upcomingCardDetails: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  upcomingCardDetail: { flexDirection: "row", alignItems: "center", gap: 4 },
  upcomingCardDetailText: { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  noEventsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    paddingVertical: 20,
  },
  noEventsText: { color: "rgba(255,255,255,0.3)", fontSize: 14 },

  // Day sheet — exact copy from calendar.tsx dayPicker styles
  dayPickerOverlay: { flex: 1, justifyContent: "flex-end" },
  dayPickerBackdrop: { backgroundColor: "rgba(0,0,0,0.6)" },
  dayPickerContainer: {
    backgroundColor: "#2a2550",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  dayPickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 16,
  },
  dayPickerTitle: { color: "white", fontSize: 17, fontWeight: "700", marginBottom: 4 },
  dayPickerSubtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    marginBottom: 12,
  },
  dayPickerEmpty: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
  },
  dayPickerList: { gap: 8 },
  dayPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  dayPickerAccent: { width: 4, alignSelf: "stretch" },
  dayPickerItemContent: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, gap: 6 },
  dayPickerItemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  dayPickerItemTitle: { color: "white", fontSize: 15, fontWeight: "600", flex: 1 },
  dayPickerTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  dayPickerTypeText: { fontSize: 11, fontWeight: "600" },
  dayPickerItemMeta: { gap: 4 },
  dayPickerMetaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dayPickerMetaText: { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  dayPickerCloseBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 16,
  },
  dayPickerCloseBtnText: { color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: "600" },

  // Add button in sheet
  addBtn: {
    backgroundColor: "#6c5ce7",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 12,
    minWidth: 64,
    alignItems: "center",
  },
  addBtnText: { color: "white", fontSize: 13, fontWeight: "600" },
});
