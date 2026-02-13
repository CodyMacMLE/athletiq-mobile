import { useAuth } from "@/contexts/AuthContext";
import { GET_EVENTS } from "@/lib/graphql/queries";
import { useQuery } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  const { user, selectedOrganization } = useAuth();
  const [currentMonthIndex, setCurrentMonthIndex] = useState(initialIndex);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [eventsTab, setEventsTab] = useState<"upcoming" | "past">("upcoming");
  const flatListRef = useRef<FlatList>(null);

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
    if (dayEvents.length > 0) {
      setSelectedEvent(dayEvents[0]);
      setModalVisible(true);
    }
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
                    {dayEvents.slice(0, 3).map((event, i) => (
                      <View
                        key={i}
                        style={[
                          styles.eventDot,
                          { backgroundColor: getEventColor(event.type) },
                        ]}
                      />
                    ))}
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

  if (!user || !selectedOrganization) return null;

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />

      {/* Event Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.eventModalContainer}>
            {selectedEvent && (
              <>
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
                  <Text style={styles.eventModalTitle}>
                    {selectedEvent.title}
                  </Text>

                  <View style={styles.eventModalRow}>
                    <Feather
                      name="calendar"
                      size={16}
                      color="rgba(255,255,255,0.6)"
                    />
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
                      <Feather
                        name="clock"
                        size={16}
                        color="rgba(255,255,255,0.6)"
                      />
                      <Text style={styles.eventModalText}>
                        {selectedEvent.startTime} - {selectedEvent.endTime}
                      </Text>
                    </View>
                  )}

                  {selectedEvent.location && (
                    <View style={styles.eventModalRow}>
                      <Feather
                        name="map-pin"
                        size={16}
                        color="rgba(255,255,255,0.6)"
                      />
                      <Text style={styles.eventModalText}>
                        {selectedEvent.location}
                      </Text>
                    </View>
                  )}

                  {selectedEvent.description && (
                    <Text style={styles.eventModalDescription}>
                      {selectedEvent.description}
                    </Text>
                  )}

                  <Pressable
                    style={({ pressed }) => [
                      styles.eventModalButton,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.eventModalButtonText}>Close</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Calendar</Text>
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
    backgroundColor: "#6c5ce7",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  eventModalButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
