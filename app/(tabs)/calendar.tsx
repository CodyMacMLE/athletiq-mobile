import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";

type EventType = "practice" | "game" | "meeting" | "rest";

type CalendarEvent = {
  id: string;
  title: string;
  type: EventType;
  date: Date;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
};

type User = {
  image?: string;
  firstName: string;
  lastName: string;
};

const user: User = {
  image: undefined,
  firstName: "Cody",
  lastName: "MacDonald",
};

const AVATAR_SIZE = 45;
const SCREEN_WIDTH = Dimensions.get("window").width;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Mock events data
const mockEvents: CalendarEvent[] = [
  {
    id: "1",
    title: "Team Practice",
    type: "practice",
    date: new Date(2025, 1, 3),
    startTime: "6:00 PM",
    endTime: "8:00 PM",
    location: "Main Gym",
    description: "Regular team practice session. Focus on defensive drills.",
  },
  {
    id: "2",
    title: "Game vs Eagles",
    type: "game",
    date: new Date(2025, 1, 8),
    startTime: "7:00 PM",
    endTime: "9:00 PM",
    location: "Home Arena",
    description: "League game against the Eagles. Arrive 1 hour early for warmup.",
  },
  {
    id: "3",
    title: "Team Meeting",
    type: "meeting",
    date: new Date(2025, 1, 10),
    startTime: "5:00 PM",
    endTime: "6:00 PM",
    location: "Conference Room A",
    description: "Strategy review and upcoming schedule discussion.",
  },
  {
    id: "4",
    title: "Team Practice",
    type: "practice",
    date: new Date(2025, 1, 5),
    startTime: "6:00 PM",
    endTime: "8:00 PM",
    location: "Main Gym",
  },
  {
    id: "5",
    title: "Recovery Day",
    type: "rest",
    date: new Date(2025, 1, 9),
    startTime: "",
    endTime: "",
    description: "Active recovery and stretching.",
  },
  {
    id: "6",
    title: "Team Practice",
    type: "practice",
    date: new Date(2025, 1, 12),
    startTime: "6:00 PM",
    endTime: "8:00 PM",
    location: "Main Gym",
  },
  {
    id: "7",
    title: "Team Practice",
    type: "practice",
    date: new Date(2025, 1, 17),
    startTime: "6:00 PM",
    endTime: "8:00 PM",
    location: "Main Gym",
  },
  {
    id: "8",
    title: "Game vs Thunder",
    type: "game",
    date: new Date(2025, 1, 22),
    startTime: "3:00 PM",
    endTime: "5:00 PM",
    location: "Away - Thunder Arena",
    description: "Away game. Bus departs at 12:00 PM from main parking lot.",
  },
];

const EVENT_COLORS: Record<EventType, string> = {
  practice: "#6c5ce7",
  game: "#e74c3c",
  meeting: "#f39c12",
  rest: "#27ae60",
};

const EVENT_ICONS: Record<EventType, string> = {
  practice: "target",
  game: "award",
  meeting: "users",
  rest: "coffee",
};

function getMonthData(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDay = firstDay.getDay();

  const days: (number | null)[] = [];

  // Add empty slots for days before the first day of the month
  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }

  // Add the days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return days;
}

function getEventsForDate(date: Date): CalendarEvent[] {
  return mockEvents.filter(
    (event) =>
      event.date.getFullYear() === date.getFullYear() &&
      event.date.getMonth() === date.getMonth() &&
      event.date.getDate() === date.getDate()
  );
}

function generateMonthsList() {
  const months: { year: number; month: number; key: string }[] = [];
  const today = new Date();
  // Generate 24 months before and after current month
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
const initialIndex = 24; // Current month is at index 24

export default function Calendar() {
  const [currentMonthIndex, setCurrentMonthIndex] = useState(initialIndex);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const currentMonth = monthsList[currentMonthIndex];
  const today = new Date();

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
    const events = getEventsForDate(date);
    if (events.length > 0) {
      setSelectedEvent(events[0]);
      setModalVisible(true);
    }
  };

  const renderMonth = ({
    item,
  }: {
    item: { year: number; month: number; key: string };
  }) => {
    const days = getMonthData(item.year, item.month);

    return (
      <View style={styles.monthContainer}>
        {/* Days of week header */}
        <View style={styles.weekHeader}>
          {DAYS_OF_WEEK.map((day) => (
            <View key={day} style={styles.weekDayCell}>
              <Text style={styles.weekDayText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.calendarGrid}>
          {days.map((day, index) => {
            if (day === null) {
              return <View key={`empty-${index}`} style={styles.dayCell} />;
            }

            const date = new Date(item.year, item.month, day);
            const events = getEventsForDate(date);
            const isToday =
              today.getFullYear() === item.year &&
              today.getMonth() === item.month &&
              today.getDate() === day;
            const hasEvents = events.length > 0;

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
                    {events.slice(0, 3).map((event, i) => (
                      <View
                        key={i}
                        style={[
                          styles.eventDot,
                          { backgroundColor: EVENT_COLORS[event.type] },
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
  const currentMonthEvents = mockEvents.filter(
    (e) =>
      e.date.getFullYear() === currentMonth.year &&
      e.date.getMonth() === currentMonth.month
  );
  const practiceCount = currentMonthEvents.filter((e) => e.type === "practice").length;
  const gameCount = currentMonthEvents.filter((e) => e.type === "game").length;
  const meetingCount = currentMonthEvents.filter((e) => e.type === "meeting").length;

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
                    { backgroundColor: EVENT_COLORS[selectedEvent.type] },
                  ]}
                >
                  <Feather
                    name={EVENT_ICONS[selectedEvent.type] as any}
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
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: EVENT_COLORS.practice }]} />
          <Text style={styles.statText}>{practiceCount} Practices</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: EVENT_COLORS.game }]} />
          <Text style={styles.statText}>{gameCount} Games</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: EVENT_COLORS.meeting }]} />
          <Text style={styles.statText}>{meetingCount} Meetings</Text>
        </View>
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

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: EVENT_COLORS.practice }]} />
          <Text style={styles.legendText}>Practice</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: EVENT_COLORS.game }]} />
          <Text style={styles.legendText}>Game</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: EVENT_COLORS.meeting }]} />
          <Text style={styles.legendText}>Meeting</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: EVENT_COLORS.rest }]} />
          <Text style={styles.legendText}>Rest</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
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
    flex: 1,
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
    width: (SCREEN_WIDTH - 40) / 7,
    height: 52,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 4,
  },
  dayCellWithEvent: {
    // Slight highlight for days with events
  },
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

  // Legend
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 16,
    paddingBottom: 100,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "500",
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
