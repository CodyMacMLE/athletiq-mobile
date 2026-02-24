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
import Svg, { Circle, G } from "react-native-svg";
import { NotificationBell } from "./NotificationBell";
import { OrgTeamSubtitle } from "./OrgTeamSubtitle";

const SCREEN_HEIGHT = Dimensions.get("window").height;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const AVATAR_SIZE = 45;

const RING_SIZE = 200;
const RING_RADIUS = 78;
const RING_STROKE = 18;
const RING_CENTER = RING_SIZE / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Colors
const COLOR_NET    = "#6c5ce7";   // main purple – net pay arc
const COLOR_DED    = "#a78bfa";   // lighter purple – deductions arc
const COLOR_TRACK  = "rgba(255,255,255,0.1)"; // dim background track
const COLOR_SALARY = "#00cec9";   // teal – used when on salary (no hourly math)

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMonthRange(year: number, monthIdx: number): string {
  const start = new Date(year, monthIdx, 1);
  const end   = new Date(year, monthIdx + 1, 0);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────

interface DonutProps {
  grossPay: number;
  netPay: number | null;
  deductionTotal: number;
  isSalary: boolean;
}

function DonutChart({ grossPay, netPay, deductionTotal, isSalary }: DonutProps) {
  const hasPay = grossPay > 0 && netPay != null;

  // Compute arc lengths
  const netArc = hasPay
    ? ((netPay! / grossPay) * RING_CIRCUMFERENCE)
    : 0;
  const dedArc = hasPay && deductionTotal > 0
    ? ((deductionTotal / grossPay) * RING_CIRCUMFERENCE)
    : 0;

  // Offsets: we start at top (rotate -90deg).
  // Net pay arc starts at 0 offset (top), deductions follow.
  const netOffset  = 0;
  const dedOffset  = RING_CIRCUMFERENCE - netArc;

  const mainColor = isSalary ? COLOR_SALARY : COLOR_NET;

  return (
    <View style={styles.donutWrapper}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <G rotation="-90" origin={`${RING_CENTER}, ${RING_CENTER}`}>
          {/* Background track */}
          <Circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_RADIUS}
            stroke={COLOR_TRACK}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          {/* Deductions arc (drawn first, behind net pay) */}
          {dedArc > 0 && (
            <Circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              stroke={COLOR_DED}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={`${dedArc} ${RING_CIRCUMFERENCE - dedArc}`}
              strokeDashoffset={-netArc}
              strokeLinecap="round"
            />
          )}
          {/* Net pay arc */}
          {netArc > 0 && (
            <Circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              stroke={mainColor}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={`${netArc} ${RING_CIRCUMFERENCE - netArc}`}
              strokeDashoffset={netOffset}
              strokeLinecap="round"
            />
          )}
          {/* Full fill if no deductions */}
          {!hasPay && (
            <Circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              stroke={mainColor}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeOpacity={0.25}
            />
          )}
        </G>
      </Svg>
      {/* Center text overlay */}
      <View style={styles.donutCenter} pointerEvents="none">
        <Text style={styles.donutAmount}>
          {grossPay > 0 ? `$${formatMoney(grossPay)}` : "—"}
        </Text>
        <Text style={styles.donutLabel}>
          {isSalary ? "Salary this month" : "Gross pay"}
        </Text>
      </View>
    </View>
  );
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

const EVENT_COLORS: Record<string, string> = {
  PRACTICE: "#6c5ce7",
  EVENT:    "#e74c3c",
  MEETING:  "#f39c12",
  REST:     "#27ae60",
};
function getEventColor(type: string): string {
  return EVENT_COLORS[type] || EVENT_COLORS[type?.toUpperCase?.()] || "#6c5ce7";
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
      <View style={styles.sheetOverlay}>
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.sheetBackdrop, { opacity: backdropAnim }]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={{ transform: [{ translateY: slideAnim }], width: "100%" }}>
          <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{dateLabel}</Text>

            <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {entries.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.sheetSubtitle}>Logged Hours</Text>
                  <View style={styles.sheetList}>
                    {entries.map((entry, idx) => (
                      <View key={entry.checkIn?.id ?? idx} style={styles.sheetItem}>
                        <View style={[styles.sheetAccent, { backgroundColor: getEventColor(entry.event.type) }]} />
                        <View style={styles.sheetItemContent}>
                          <View style={styles.sheetItemTop}>
                            <Text style={styles.sheetItemTitle} numberOfLines={1}>
                              {entry.event.title}
                            </Text>
                            <View style={styles.sheetHoursBadge}>
                              <Text style={styles.sheetHoursText}>
                                {entry.hoursLogged.toFixed(2)} hrs
                              </Text>
                            </View>
                          </View>
                          <View style={styles.sheetMetaRow}>
                            <Feather name="clock" size={12} color="rgba(255,255,255,0.45)" />
                            <Text style={styles.sheetMetaText}>
                              {formatTime(entry.checkIn?.checkInTime)} – {formatTime(entry.checkIn?.checkOutTime)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {missedEvents.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.sheetSubtitle}>Add Missed Class</Text>
                  <View style={styles.sheetList}>
                    {missedEvents.map((event) => (
                      <View key={event.id} style={styles.sheetItem}>
                        <View style={[styles.sheetAccent, { backgroundColor: getEventColor(event.type) }]} />
                        <View style={styles.sheetItemContent}>
                          <View style={styles.sheetItemTop}>
                            <Text style={styles.sheetItemTitle} numberOfLines={1}>{event.title}</Text>
                          </View>
                          {event.startTime ? (
                            <View style={styles.sheetMetaRow}>
                              <Feather name="clock" size={12} color="rgba(255,255,255,0.45)" />
                              <Text style={styles.sheetMetaText}>
                                {event.startTime}{event.endTime ? ` – ${event.endTime}` : ""}
                              </Text>
                            </View>
                          ) : null}
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
                <Text style={styles.sheetEmpty}>No events scheduled for this day.</Text>
              )}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [styles.sheetCloseBtn, pressed && { opacity: 0.7 }]}
              onPress={onClose}
            >
              <Text style={styles.sheetCloseBtnText}>Close</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Entries Sheet ────────────────────────────────────────────────────────────

function EntriesSheet({
  visible,
  entries,
  slideAnim,
  backdropAnim,
  onClose,
  onDayPress,
}: {
  visible: boolean;
  entries: DayEntry[];
  slideAnim: Animated.Value;
  backdropAnim: Animated.Value;
  onClose: () => void;
  onDayPress: (date: Date) => void;
}) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.sheetBackdrop, { opacity: backdropAnim }]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={{ transform: [{ translateY: slideAnim }], width: "100%" }}>
          <Pressable style={[styles.sheetContainer, { paddingBottom: 40 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>All Check-ins</Text>

            <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {entries.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="clock" size={24} color="rgba(255,255,255,0.2)" />
                  <Text style={styles.emptyStateText}>No check-ins this month</Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {entries.map((entry, idx) => (
                    <Pressable
                      key={entry.checkIn?.id ?? idx}
                      style={({ pressed }) => [styles.entryCard, pressed && { opacity: 0.8 }]}
                      onPress={() => {
                        onClose();
                        setTimeout(() => onDayPress(parseEventDate(entry.event.date)), 300);
                      }}
                    >
                      <View style={[styles.entryAccent, { backgroundColor: getEventColor(entry.event.type) }]} />
                      <View style={styles.entryContent}>
                        <View style={styles.entryTop}>
                          <Text style={styles.entryTitle} numberOfLines={1}>
                            {entry.event.title}
                          </Text>
                          <Text style={styles.entryHours}>
                            {entry.hoursLogged.toFixed(2)} hrs
                          </Text>
                        </View>
                        <View style={styles.entryMeta}>
                          <View style={styles.entryMetaItem}>
                            <Feather name="calendar" size={11} color="rgba(255,255,255,0.4)" />
                            <Text style={styles.entryMetaText}>
                              {formatEventDate(entry.event.date)}
                            </Text>
                          </View>
                          <View style={styles.entryMetaItem}>
                            <Feather name="clock" size={11} color="rgba(255,255,255,0.4)" />
                            <Text style={styles.entryMetaText}>
                              {formatTime(entry.checkIn?.checkInTime)} – {formatTime(entry.checkIn?.checkOutTime)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.2)" />
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [styles.sheetCloseBtn, { marginTop: 16 }, pressed && { opacity: 0.7 }]}
              onPress={onClose}
            >
              <Text style={styles.sheetCloseBtnText}>Close</Text>
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

  const [currentYear, setCurrentYear]       = useState(today.getFullYear());
  const [currentMonthNum, setCurrentMonthNum] = useState(today.getMonth());
  const currentYearRef      = useRef(today.getFullYear());
  const currentMonthNumRef  = useRef(today.getMonth());
  currentYearRef.current     = currentYear;
  currentMonthNumRef.current = currentMonthNum;

  // Day sheet (tap a specific day)
  const [daySheetVisible,  setDaySheetVisible]  = useState(false);
  const [daySheetDate,     setDaySheetDate]      = useState<Date | null>(null);

  // Entries sheet ("View details")
  const [entriesSheetVisible, setEntriesSheetVisible] = useState(false);

  const backdropAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim       = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const entBackdropAnim = useRef(new Animated.Value(0)).current;
  const entSlideAnim    = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Swipe to change month
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5 && Math.abs(gs.dx) > 10,
      onPanResponderRelease: (_, gs) => {
        const y = currentYearRef.current;
        const m = currentMonthNumRef.current;
        if (gs.dx < -40) {
          if (m === 11) { setCurrentYear(y + 1); setCurrentMonthNum(0); }
          else setCurrentMonthNum(m + 1);
        } else if (gs.dx > 40) {
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

  const apiMonth = currentMonthNum + 1;

  const startDate = useMemo(() => {
    return new Date(currentYear, currentMonthNum, 1).toISOString().split("T")[0];
  }, [currentYear, currentMonthNum]);

  const endDate = useMemo(() => {
    return new Date(currentYear, currentMonthNum + 1, 0).toISOString().split("T")[0];
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
      id: e.id, title: e.title, type: e.type,
      date: e.date, startTime: e.startTime || "", endTime: e.endTime || "",
    })),
    [eventsData]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<number, DayEvent[]>();
    allEvents.forEach((ev) => {
      const d = parseEventDate(ev.date).getDate();
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(ev);
    });
    return map;
  }, [allEvents]);

  const sheetEntries: DayEntry[] = useMemo(() => {
    if (!daySheetDate) return [];
    const d = daySheetDate.getDate();
    return (hours?.entries ?? []).filter(
      (e: DayEntry) => parseEventDate(e.event.date).getDate() === d
    );
  }, [daySheetDate, hours]);

  const sheetEvents: DayEvent[] = useMemo(() => {
    if (!daySheetDate) return [];
    return eventsByDay.get(daySheetDate.getDate()) ?? [];
  }, [daySheetDate, eventsByDay]);

  function openDaySheet(date: Date) {
    backdropAnim.setValue(0);
    slideAnim.setValue(SCREEN_HEIGHT);
    setDaySheetDate(date);
    setDaySheetVisible(true);
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();
  }

  function closeDaySheet(callback?: () => void) {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 240, useNativeDriver: true }),
    ]).start(() => { setDaySheetVisible(false); callback?.(); });
  }

  function openEntriesSheet() {
    entBackdropAnim.setValue(0);
    entSlideAnim.setValue(SCREEN_HEIGHT);
    setEntriesSheetVisible(true);
    Animated.parallel([
      Animated.timing(entBackdropAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(entSlideAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();
  }

  function closeEntriesSheet(callback?: () => void) {
    Animated.parallel([
      Animated.timing(entBackdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(entSlideAnim, { toValue: SCREEN_HEIGHT, duration: 240, useNativeDriver: true }),
    ]).start(() => { setEntriesSheetVisible(false); callback?.(); });
  }

  // Derived pay values
  const grossPay  = hours?.grossPay  ?? 0;
  const netPay    = hours?.netPay    ?? null;
  const isSalary  = (hours?.salaryAmount ?? null) != null;
  const deductionTotal = (grossPay > 0 && netPay != null) ? grossPay - netPay : 0;
  const appliedDeductions: { name: string; type: string; value: number; amount: number }[] =
    hours?.appliedDeductions ?? [];
  const totalHours = hours?.totalHours ?? 0;
  const hasPay = grossPay > 0;

  const isCurrentMonth =
    today.getFullYear() === currentYear && today.getMonth() === currentMonthNum;

  return (
    <>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        {...panResponder.panHandlers}
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
        <View style={styles.monthNav}>
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

        {/* ── Donut Chart ── */}
        {hoursLoading ? (
          <View style={styles.donutPlaceholder}>
            <ActivityIndicator color="#6c5ce7" size="large" />
          </View>
        ) : (
          <View style={styles.donutSection}>
            <DonutChart
              grossPay={grossPay}
              netPay={netPay}
              deductionTotal={deductionTotal}
              isSalary={isSalary}
            />

            {/* ── Pay breakdown rows ── */}
            {hasPay && (
              <View style={styles.breakdownCard}>
                {/* Net pay */}
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <View style={[styles.breakdownDot, { backgroundColor: isSalary ? COLOR_SALARY : COLOR_NET }]} />
                    <Text style={styles.breakdownLabel}>Net pay</Text>
                  </View>
                  <Text style={styles.breakdownValue}>
                    ${formatMoney(netPay ?? grossPay)}
                  </Text>
                </View>

                {/* Each deduction */}
                {appliedDeductions.map((ded, i) => (
                  <View key={i} style={styles.breakdownRow}>
                    <View style={styles.breakdownLeft}>
                      <View
                        style={[
                          styles.breakdownDot,
                          { backgroundColor: i === 0 ? COLOR_DED : `rgba(167,139,250,${0.8 - i * 0.15})` },
                        ]}
                      />
                      <Text style={styles.breakdownLabel}>{ded.name}</Text>
                    </View>
                    <Text style={[styles.breakdownValue, styles.breakdownDeduction]}>
                      -${formatMoney(ded.amount)}
                    </Text>
                  </View>
                ))}

                {/* Divider + gross */}
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <View style={[styles.breakdownDot, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
                    <Text style={[styles.breakdownLabel, { color: "rgba(255,255,255,0.45)" }]}>Gross pay</Text>
                  </View>
                  <Text style={[styles.breakdownValue, { color: "rgba(255,255,255,0.45)" }]}>
                    ${formatMoney(grossPay)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── This Month Card ── */}
        <View style={styles.paycheckCard}>
          <Text style={styles.paycheckLabel}>
            {isCurrentMonth ? "THIS MONTH" : MONTHS[currentMonthNum].toUpperCase() + " " + currentYear}
          </Text>
          <Text style={styles.paycheckSubtitle}>{getMonthRange(currentYear, currentMonthNum)}</Text>

          <View style={styles.paycheckRow}>
            <View>
              {hasPay ? (
                <>
                  <Text style={styles.paycheckAmount}>
                    ${formatMoney(netPay ?? grossPay)}
                  </Text>
                  <Text style={styles.paycheckAmountLabel}>
                    {netPay != null && appliedDeductions.length > 0 ? "Net pay" : "Est. pay"}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.paycheckAmount}>
                    {totalHours.toFixed(1)} hrs
                  </Text>
                  <Text style={styles.paycheckAmountLabel}>Hours logged</Text>
                </>
              )}
            </View>
            <View style={styles.paycheckRight}>
              <Text style={styles.paycheckHoursValue}>{totalHours.toFixed(1)}</Text>
              <Text style={styles.paycheckHoursLabel}>Hours worked</Text>
            </View>
          </View>

          {hasPay && (
            <Text style={styles.paycheckRate}>
              {isSalary
                ? `Salary: $${formatMoney(hours?.salaryAmount ?? 0)}/mo`
                : `Rate: $${(hours?.hourlyRate ?? 0).toFixed(2)}/hr`}
            </Text>
          )}

          <Pressable
            style={({ pressed }) => [styles.viewDetailsBtn, pressed && { opacity: 0.7 }]}
            onPress={openEntriesSheet}
          >
            <Text style={styles.viewDetailsBtnText}>View details</Text>
            <Feather name="chevron-right" size={14} color="#a78bfa" />
          </Pressable>
        </View>

        {/* ── Hours-only summary (no pay configured) ── */}
        {!hasPay && !hoursLoading && (
          <View style={styles.hintCard}>
            <Feather name="info" size={14} color="rgba(255,255,255,0.3)" />
            <Text style={styles.hintText}>
              Ask your admin to set your pay rate to see earnings here.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Day Sheet ── */}
      <DaySheet
        visible={daySheetVisible}
        date={daySheetDate}
        entries={sheetEntries}
        eventsOnDay={sheetEvents}
        userId={user?.id ?? ""}
        organizationId={selectedOrganization?.id ?? ""}
        slideAnim={slideAnim}
        backdropAnim={backdropAnim}
        onClose={() => closeDaySheet()}
        onCheckInAdded={() => closeDaySheet(() => refetch())}
      />

      {/* ── Entries Sheet ── */}
      <EntriesSheet
        visible={entriesSheetVisible}
        entries={hours?.entries ?? []}
        slideAnim={entSlideAnim}
        backdropAnim={entBackdropAnim}
        onClose={() => closeEntriesSheet()}
        onDayPress={(date) => openDaySheet(date)}
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
    paddingTop: 80,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: "column",
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

  // Month nav
  monthNav: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  monthArrow: { padding: 4 },
  monthTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    minWidth: 170,
    textAlign: "center",
  },

  // Donut
  donutSection: { alignItems: "center", paddingBottom: 8 },
  donutPlaceholder: {
    height: RING_SIZE + 40,
    alignItems: "center",
    justifyContent: "center",
  },
  donutWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  donutCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: RING_SIZE - RING_STROKE * 2 - 20,
  },
  donutAmount: {
    color: "white",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  donutLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },

  // Breakdown card (below donut)
  breakdownCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    marginHorizontal: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    width: "90%",
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  breakdownLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  breakdownDot: { width: 10, height: 10, borderRadius: 5 },
  breakdownLabel: { color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: "500" },
  breakdownValue: { color: "white", fontSize: 15, fontWeight: "700" },
  breakdownDeduction: { color: "#a78bfa" },
  breakdownDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 2,
  },

  // "This Month" / paycheck card
  paycheckCard: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  paycheckLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  paycheckSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginBottom: 14,
  },
  paycheckRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 4,
  },
  paycheckAmount: { color: "white", fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  paycheckAmountLabel: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 2 },
  paycheckRight: { alignItems: "flex-end" },
  paycheckHoursValue: { color: "white", fontSize: 22, fontWeight: "700" },
  paycheckHoursLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },
  paycheckRate: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  viewDetailsBtnText: {
    color: "#a78bfa",
    fontSize: 14,
    fontWeight: "600",
  },

  // Hint
  hintCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  hintText: { color: "rgba(255,255,255,0.3)", fontSize: 13, flex: 1 },

  // Entry cards (inside entries sheet)
  entryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  entryAccent: { width: 4, alignSelf: "stretch" },
  entryContent: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
  entryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  entryTitle: { color: "white", fontSize: 14, fontWeight: "600", flex: 1, marginRight: 8 },
  entryHours: { color: "#a78bfa", fontSize: 13, fontWeight: "600" },
  entryMeta: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  entryMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  entryMetaText: { color: "rgba(255,255,255,0.45)", fontSize: 12 },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 40,
  },
  emptyStateText: { color: "rgba(255,255,255,0.3)", fontSize: 14 },

  // Shared sheet styles
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: { backgroundColor: "rgba(0,0,0,0.6)" },
  sheetContainer: {
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
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: { color: "white", fontSize: 17, fontWeight: "700", marginBottom: 4 },
  sheetSubtitle: { color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 12 },
  sheetEmpty: { color: "rgba(255,255,255,0.35)", fontSize: 14, textAlign: "center", paddingVertical: 20 },
  sheetList: { gap: 8 },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  sheetAccent: { width: 4, alignSelf: "stretch" },
  sheetItemContent: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, gap: 6 },
  sheetItemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sheetItemTitle: { color: "white", fontSize: 15, fontWeight: "600", flex: 1 },
  sheetHoursBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(167,139,250,0.15)" },
  sheetHoursText: { fontSize: 11, fontWeight: "600", color: "#a78bfa" },
  sheetMetaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  sheetMetaText: { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  sheetCloseBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 16,
  },
  sheetCloseBtnText: { color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: "600" },

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
