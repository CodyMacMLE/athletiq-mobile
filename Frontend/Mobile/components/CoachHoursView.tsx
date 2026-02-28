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

const SCREEN_HEIGHT = Dimensions.get("window").height;
const AVATAR_SIZE   = 45;

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// Ring chart sizing
const RING_SIZE   = 220;
const RING_HALF   = RING_SIZE / 2;
const RING_STROKE = 20;
const INNER_SIZE  = RING_SIZE - RING_STROKE * 2;
const INNER_HALF  = INNER_SIZE / 2;

// Colors
const C_NET   = "#6c5ce7";
const C_DED   = "#a78bfa";
const C_TRACK = "rgba(255,255,255,0.08)";
const C_INNER = "#1a1535"; // matches app background

// ─── Pure-RN Arc ─────────────────────────────────────────────────────────────
// Draws a filled arc from 0% to `percent` (0–1) starting at 12 o'clock, clockwise.
// Two half-containers with overflow:hidden + filled circles rotated to reveal arc.

function ArcFill({ percent, color, size }: { percent: number; color: string; size: number }) {
  const half      = size / 2;
  const clipped   = Math.max(0, Math.min(1, percent));
  const rightRot  = `${Math.min(clipped * 2, 1) * 180 - 180}deg`;
  const leftRot   = `${Math.max((clipped - 0.5) * 2, 0) * 180 - 180}deg`;

  return (
    <View style={{ position: "absolute", width: size, height: size }}>
      {/* Right half: covers 0%–50% */}
      <View style={{ position: "absolute", left: half, width: half, height: size, overflow: "hidden" }}>
        <View
          style={{
            position: "absolute",
            left: -half,
            width: size,
            height: size,
            borderRadius: half,
            backgroundColor: color,
            transform: [{ rotate: rightRot }],
          }}
        />
      </View>

      {/* Left half: covers 50%–100% */}
      {clipped > 0.5 && (
        <View style={{ position: "absolute", left: 0, width: half, height: size, overflow: "hidden" }}>
          <View
            style={{
              position: "absolute",
              left: 0,
              width: size,
              height: size,
              borderRadius: half,
              backgroundColor: color,
              transform: [{ rotate: leftRot }],
            }}
          />
        </View>
      )}
    </View>
  );
}

// ─── Donut Ring ───────────────────────────────────────────────────────────────

interface DonutProps {
  grossPay:       number;
  netPay:         number | null;
  totalHours:     number;
  isSalary:       boolean;
  hasDeductions:  boolean;
}

function DonutRing({ grossPay, netPay, totalHours, isSalary, hasDeductions }: DonutProps) {
  const hasPay    = grossPay > 0 && netPay != null;
  const netPct    = hasPay ? netPay! / grossPay : 0;
  const mainColor = isSalary ? "#00cec9" : C_NET;

  return (
    <View style={styles.ringWrapper}>
      {/* Track */}
      <View style={[styles.ringTrack, { backgroundColor: C_TRACK }]} />

      {/* Deductions arc (full circle, lighter color) */}
      {hasPay && hasDeductions && <ArcFill percent={1} color={C_DED} size={RING_SIZE} />}

      {/* Net pay arc */}
      {hasPay && <ArcFill percent={netPct} color={mainColor} size={RING_SIZE} />}

      {/* Donut hole — clips center, holds center text */}
      <View style={[styles.ringInner, { backgroundColor: C_INNER }]}>
        {hasPay ? (
          <>
            <Text style={styles.ringAmount}>${formatMoney(grossPay)}</Text>
            <Text style={styles.ringLabel}>{isSalary ? "Salary" : "Gross pay"}</Text>
          </>
        ) : (
          <>
            <Text style={styles.ringAmount}>{totalHours.toFixed(1)}</Text>
            <Text style={styles.ringLabel}>hrs this month</Text>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseEventDate(iso: string): Date {
  const [year, month, day] = iso.split("T")[0].split("-").map(Number);
  return new Date(year, month - 1, day);
}

function buildDateTime(dateISO: string, timeStr: string): string {
  const base  = parseEventDate(dateISO);
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

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatEventDate(iso: string): string {
  return parseEventDate(iso).toLocaleDateString([], {
    weekday: "short", month: "short", day: "numeric",
  });
}

function formatMoney(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMonthRange(year: number, monthIdx: number): string {
  const start = new Date(year, monthIdx, 1);
  const end   = new Date(year, monthIdx + 1, 0);
  const fmt   = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

const EVENT_COLORS: Record<string, string> = {
  PRACTICE: "#6c5ce7", EVENT: "#e74c3c", MEETING: "#f39c12", REST: "#27ae60",
};
function getEventColor(type: string): string {
  return EVENT_COLORS[type] || "#6c5ce7";
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface DayEvent {
  id: string; title: string; type: string; date: string;
  startTime: string; endTime: string;
}
interface DayEntry {
  event: DayEvent;
  checkIn: { id: string; checkInTime: string | null; checkOutTime: string | null; status: string } | null;
  hoursLogged: number;
}

// ─── Day Sheet ───────────────────────────────────────────────────────────────

function DaySheet({
  visible, date, entries, eventsOnDay, userId, organizationId,
  slideAnim, backdropAnim, onClose, onCheckInAdded,
}: {
  visible: boolean; date: Date | null; entries: DayEntry[]; eventsOnDay: DayEvent[];
  userId: string; organizationId: string;
  slideAnim: Animated.Value; backdropAnim: Animated.Value;
  onClose: () => void; onCheckInAdded: () => void;
}) {
  const [addCheckIn]    = useMutation(ADMIN_CHECK_IN);
  const [addingId, setAddingId] = useState<string | null>(null);

  const checkedIds  = new Set(entries.map((e) => e.event.id));
  const missed      = eventsOnDay.filter((ev) => !checkedIds.has(ev.id));

  async function handleAdd(event: DayEvent) {
    setAddingId(event.id);
    try {
      await addCheckIn({
        variables: {
          input: {
            userId, eventId: event.id, status: "ON_TIME",
            checkInTime:  buildDateTime(event.date, event.startTime),
            checkOutTime: buildDateTime(event.date, event.endTime),
          },
        },
      });
      onCheckInAdded();
    } finally { setAddingId(null); }
  }

  if (!visible) return null;
  const dateLabel = date?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={ss.overlay}>
        <Animated.View style={[StyleSheet.absoluteFill, ss.backdrop, { opacity: backdropAnim }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={{ transform: [{ translateY: slideAnim }], width: "100%" }}>
          <Pressable style={ss.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={ss.handle} />
            <Text style={ss.sheetTitle}>{dateLabel}</Text>
            <ScrollView bounces={false} style={{ maxHeight: 380 }}>
              {entries.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={ss.sheetSub}>Logged Hours</Text>
                  {entries.map((entry, i) => (
                    <View key={entry.checkIn?.id ?? i} style={[ss.item, { marginBottom: 8 }]}>
                      <View style={[ss.accent, { backgroundColor: getEventColor(entry.event.type) }]} />
                      <View style={ss.itemBody}>
                        <View style={ss.itemTop}>
                          <Text style={ss.itemTitle} numberOfLines={1}>{entry.event.title}</Text>
                          <View style={ss.hoursBadge}>
                            <Text style={ss.hoursText}>{entry.hoursLogged.toFixed(2)} hrs</Text>
                          </View>
                        </View>
                        <View style={ss.metaRow}>
                          <Feather name="clock" size={12} color="rgba(255,255,255,0.4)" />
                          <Text style={ss.metaText}>
                            {formatTime(entry.checkIn?.checkInTime)} – {formatTime(entry.checkIn?.checkOutTime)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
              {missed.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={ss.sheetSub}>Add Missed Class</Text>
                  {missed.map((event) => (
                    <View key={event.id} style={[ss.item, { marginBottom: 8 }]}>
                      <View style={[ss.accent, { backgroundColor: getEventColor(event.type) }]} />
                      <View style={ss.itemBody}>
                        <Text style={ss.itemTitle} numberOfLines={1}>{event.title}</Text>
                        {event.startTime ? (
                          <View style={ss.metaRow}>
                            <Feather name="clock" size={12} color="rgba(255,255,255,0.4)" />
                            <Text style={ss.metaText}>
                              {event.startTime}{event.endTime ? ` – ${event.endTime}` : ""}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Pressable
                        style={({ pressed }) => [ss.addBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => handleAdd(event)}
                        disabled={addingId === event.id}
                      >
                        {addingId === event.id
                          ? <ActivityIndicator size="small" color="white" />
                          : <Text style={ss.addBtnText}>+ Add</Text>
                        }
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              {entries.length === 0 && missed.length === 0 && (
                <Text style={ss.empty}>No events scheduled for this day.</Text>
              )}
            </ScrollView>
            <Pressable
              style={({ pressed }) => [ss.closeBtn, pressed && { opacity: 0.7 }]}
              onPress={onClose}
            >
              <Text style={ss.closeBtnText}>Close</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Entries Sheet ────────────────────────────────────────────────────────────

function EntriesSheet({
  visible, entries, slideAnim, backdropAnim, onClose, onDayPress,
}: {
  visible: boolean; entries: DayEntry[];
  slideAnim: Animated.Value; backdropAnim: Animated.Value;
  onClose: () => void; onDayPress: (d: Date) => void;
}) {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={ss.overlay}>
        <Animated.View style={[StyleSheet.absoluteFill, ss.backdrop, { opacity: backdropAnim }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={{ transform: [{ translateY: slideAnim }], width: "100%" }}>
          <Pressable style={[ss.sheet, { paddingBottom: 40 }]} onPress={(e) => e.stopPropagation()}>
            <View style={ss.handle} />
            <Text style={ss.sheetTitle}>All Check-ins</Text>
            <ScrollView bounces={false} style={{ maxHeight: 480 }}>
              {entries.length === 0 ? (
                <View style={ss.emptyState}>
                  <Feather name="clock" size={24} color="rgba(255,255,255,0.2)" />
                  <Text style={ss.emptyStateText}>No check-ins this month</Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {entries.map((entry, i) => (
                    <Pressable
                      key={entry.checkIn?.id ?? i}
                      style={({ pressed }) => [ss.entryCard, pressed && { opacity: 0.8 }]}
                      onPress={() => {
                        onClose();
                        setTimeout(() => onDayPress(parseEventDate(entry.event.date)), 300);
                      }}
                    >
                      <View style={[ss.accent, { backgroundColor: getEventColor(entry.event.type) }]} />
                      <View style={ss.itemBody}>
                        <View style={ss.itemTop}>
                          <Text style={ss.itemTitle} numberOfLines={1}>{entry.event.title}</Text>
                          <Text style={ss.entryHours}>{entry.hoursLogged.toFixed(2)} hrs</Text>
                        </View>
                        <View style={ss.entryMeta}>
                          <View style={ss.metaRow}>
                            <Feather name="calendar" size={11} color="rgba(255,255,255,0.4)" />
                            <Text style={ss.metaText}>{formatEventDate(entry.event.date)}</Text>
                          </View>
                          <View style={ss.metaRow}>
                            <Feather name="clock" size={11} color="rgba(255,255,255,0.4)" />
                            <Text style={ss.metaText}>
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
              style={({ pressed }) => [ss.closeBtn, { marginTop: 16 }, pressed && { opacity: 0.7 }]}
              onPress={onClose}
            >
              <Text style={ss.closeBtnText}>Close</Text>
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

  const [currentYear,     setCurrentYear]     = useState(today.getFullYear());
  const [currentMonthNum, setCurrentMonthNum] = useState(today.getMonth());
  const yearRef  = useRef(today.getFullYear());
  const monthRef = useRef(today.getMonth());
  yearRef.current  = currentYear;
  monthRef.current = currentMonthNum;

  const [daySheetVisible, setDaySheetVisible]     = useState(false);
  const [daySheetDate,    setDaySheetDate]         = useState<Date | null>(null);
  const [entSheetVisible, setEntSheetVisible]      = useState(false);

  const backdropAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim       = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const entBackdropAnim = useRef(new Animated.Value(0)).current;
  const entSlideAnim    = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5 && Math.abs(gs.dx) > 10,
      onPanResponderRelease: (_, gs) => {
        const y = yearRef.current;
        const m = monthRef.current;
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

  const goToPrev = () => {
    if (currentMonthNum === 0) { setCurrentYear((y) => y - 1); setCurrentMonthNum(11); }
    else setCurrentMonthNum((m) => m - 1);
  };
  const goToNext = () => {
    if (currentMonthNum === 11) { setCurrentYear((y) => y + 1); setCurrentMonthNum(0); }
    else setCurrentMonthNum((m) => m + 1);
  };

  const apiMonth = currentMonthNum + 1;

  const startDate = useMemo(
    () => new Date(currentYear, currentMonthNum, 1).toISOString().split("T")[0],
    [currentYear, currentMonthNum]
  );
  const endDate = useMemo(
    () => new Date(currentYear, currentMonthNum + 1, 0).toISOString().split("T")[0],
    [currentYear, currentMonthNum]
  );

  // No organizationId → aggregate all orgs where this coach has check-ins
  const { data: hoursData, loading: hoursLoading, refetch } = useQuery(GET_COACH_MY_HOURS, {
    variables: { month: apiMonth, year: currentYear },
    fetchPolicy: "cache-and-network",
  });

  // Still fetch events scoped to selected org for the day sheet "add missed" feature
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

  const sheetEvents: DayEvent[] = useMemo(
    () => (daySheetDate ? eventsByDay.get(daySheetDate.getDate()) ?? [] : []),
    [daySheetDate, eventsByDay]
  );

  function openDaySheet(date: Date) {
    backdropAnim.setValue(0); slideAnim.setValue(SCREEN_HEIGHT);
    setDaySheetDate(date); setDaySheetVisible(true);
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(slideAnim,    { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();
  }
  function closeDaySheet(cb?: () => void) {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim,    { toValue: SCREEN_HEIGHT, duration: 240, useNativeDriver: true }),
    ]).start(() => { setDaySheetVisible(false); cb?.(); });
  }
  function openEntriesSheet() {
    entBackdropAnim.setValue(0); entSlideAnim.setValue(SCREEN_HEIGHT);
    setEntSheetVisible(true);
    Animated.parallel([
      Animated.timing(entBackdropAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(entSlideAnim,    { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();
  }
  function closeEntriesSheet(cb?: () => void) {
    Animated.parallel([
      Animated.timing(entBackdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(entSlideAnim,    { toValue: SCREEN_HEIGHT, duration: 240, useNativeDriver: true }),
    ]).start(() => { setEntSheetVisible(false); cb?.(); });
  }

  // Derived pay data
  const grossPay   = hours?.grossPay  ?? 0;
  const netPay     = hours?.netPay    ?? null;
  const isSalary   = (hours?.salaryAmount ?? null) != null;
  const hasPay     = grossPay > 0;
  const appliedDed: { name: string; type: string; value: number; amount: number }[] =
    hours?.appliedDeductions ?? [];
  const hasDeductions = appliedDed.length > 0 && netPay != null && netPay < grossPay;
  const totalHours = hours?.totalHours ?? 0;

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
          <Pressable style={({ pressed }) => [styles.arrow, pressed && { opacity: 0.5 }]} onPress={goToPrev}>
            <Feather name="chevron-left" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>
          <Text style={styles.monthTitle}>{MONTHS[currentMonthNum]} {currentYear}</Text>
          <Pressable style={({ pressed }) => [styles.arrow, pressed && { opacity: 0.5 }]} onPress={goToNext}>
            <Feather name="chevron-right" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>

        {/* ── Ring Chart ── */}
        {hoursLoading ? (
          <View style={styles.ringPlaceholder}>
            <ActivityIndicator color="#6c5ce7" size="large" />
          </View>
        ) : (
          <View style={styles.ringSection}>
            <DonutRing
              grossPay={grossPay}
              netPay={netPay}
              totalHours={totalHours}
              isSalary={isSalary}
              hasDeductions={hasDeductions}
            />

            {/* ── Pay Breakdown ── */}
            {hasPay && (
              <View style={styles.breakdownCard}>
                <View style={styles.bRow}>
                  <View style={styles.bLeft}>
                    <View style={[styles.bDot, { backgroundColor: isSalary ? "#00cec9" : C_NET }]} />
                    <Text style={styles.bLabel}>Net pay</Text>
                  </View>
                  <Text style={styles.bValue}>${formatMoney(netPay ?? grossPay)}</Text>
                </View>

                {appliedDed.map((d, i) => (
                  <View key={i} style={styles.bRow}>
                    <View style={styles.bLeft}>
                      <View style={[styles.bDot, { backgroundColor: C_DED, opacity: 1 - i * 0.15 }]} />
                      <Text style={styles.bLabel}>{d.name}</Text>
                    </View>
                    <Text style={[styles.bValue, { color: C_DED }]}>-${formatMoney(d.amount)}</Text>
                  </View>
                ))}

                <View style={styles.bDivider} />
                <View style={styles.bRow}>
                  <View style={styles.bLeft}>
                    <View style={[styles.bDot, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
                    <Text style={[styles.bLabel, { color: "rgba(255,255,255,0.4)" }]}>Gross pay</Text>
                  </View>
                  <Text style={[styles.bValue, { color: "rgba(255,255,255,0.4)" }]}>
                    ${formatMoney(grossPay)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── This Month Card ── */}
        <View style={styles.paycheckCard}>
          <Text style={styles.pcLabel}>
            {isCurrentMonth ? "THIS MONTH" : `${MONTHS[currentMonthNum].toUpperCase()} ${currentYear}`}
          </Text>
          <Text style={styles.pcRange}>{getMonthRange(currentYear, currentMonthNum)}</Text>

          <View style={styles.pcRow}>
            <View>
              {hasPay ? (
                <>
                  <Text style={styles.pcAmount}>${formatMoney(netPay ?? grossPay)}</Text>
                  <Text style={styles.pcAmountLabel}>
                    {hasDeductions ? "Net pay" : "Est. pay"}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.pcAmount}>{totalHours.toFixed(1)} hrs</Text>
                  <Text style={styles.pcAmountLabel}>Hours logged</Text>
                </>
              )}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.pcHours}>{totalHours.toFixed(1)}</Text>
              <Text style={styles.pcHoursLabel}>Hours worked</Text>
            </View>
          </View>

          {hasPay && (
            <Text style={styles.pcRate}>
              {isSalary
                ? `Salary: $${formatMoney(hours?.salaryAmount ?? 0)}/mo`
                : `Rate: $${(hours?.hourlyRate ?? 0).toFixed(2)}/hr`}
            </Text>
          )}

          <Pressable
            style={({ pressed }) => [styles.viewDetails, pressed && { opacity: 0.7 }]}
            onPress={openEntriesSheet}
          >
            <Text style={styles.viewDetailsText}>View details</Text>
            <Feather name="chevron-right" size={14} color="#a78bfa" />
          </Pressable>
        </View>

        {!hasPay && !hoursLoading && (
          <View style={styles.hintCard}>
            <Feather name="info" size={14} color="rgba(255,255,255,0.3)" />
            <Text style={styles.hintText}>
              Ask your admin to set your pay rate to see earnings here.
            </Text>
          </View>
        )}
      </ScrollView>

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

      <EntriesSheet
        visible={entSheetVisible}
        entries={hours?.entries ?? []}
        slideAnim={entSlideAnim}
        backdropAnim={entBackdropAnim}
        onClose={() => closeEntriesSheet()}
        onDayPress={(date) => openDaySheet(date)}
      />
    </>
  );
}

// ─── Ring styles (computed) ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView:    { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 80, paddingHorizontal: 20, paddingBottom: 8,
  },
  headerLeft: { flexDirection: "column", gap: 4, flex: 1, minHeight: 58 },
  title:      { color: "white", fontSize: 22, fontWeight: "bold" },
  headerRight:{ flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    justifyContent: "center", alignItems: "center", overflow: "hidden",
    backgroundColor: "#241e4a", borderWidth: 0.5, borderColor: "#463e70",
  },
  avatarImage: { backgroundColor: "transparent" },
  avatarText:  { color: "white", fontSize: 15, fontWeight: "600" },

  monthNav: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    gap: 12, paddingVertical: 12, paddingHorizontal: 20,
  },
  arrow:      { padding: 4 },
  monthTitle: { color: "white", fontSize: 18, fontWeight: "600", minWidth: 170, textAlign: "center" },

  ringSection:     { alignItems: "center", paddingBottom: 8 },
  ringPlaceholder: { height: RING_SIZE + 40, alignItems: "center", justifyContent: "center" },

  // Breakdown card
  breakdownCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16, marginHorizontal: 20, marginTop: 12,
    padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    width: "90%",
  },
  bRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  bLeft:    { flexDirection: "row", alignItems: "center", gap: 10 },
  bDot:     { width: 10, height: 10, borderRadius: 5 },
  bLabel:   { color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: "500" },
  bValue:   { color: "white", fontSize: 15, fontWeight: "700" },
  bDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 2 },

  // Paycheck card
  paycheckCard: {
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 16,
    marginHorizontal: 20, marginTop: 16, padding: 18,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  pcLabel:       { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 2 },
  pcRange:       { color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 14 },
  pcRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 },
  pcAmount:      { color: "white", fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  pcAmountLabel: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 2 },
  pcHours:       { color: "white", fontSize: 22, fontWeight: "700" },
  pcHoursLabel:  { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },
  pcRate:        { color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 6, marginBottom: 12 },
  viewDetails:   { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  viewDetailsText: { color: "#a78bfa", fontSize: 14, fontWeight: "600" },

  hintCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 20, marginTop: 12, padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  hintText: { color: "rgba(255,255,255,0.3)", fontSize: 13, flex: 1 },

  // ─── Ring component styles ───────────────────────────────────────────────
  ringWrapper: { width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center", marginVertical: 8 },
  ringTrack:   { position: "absolute", width: RING_SIZE, height: RING_SIZE, borderRadius: RING_HALF },
  ringInner: {
    position: "absolute",
    width: INNER_SIZE, height: INNER_SIZE, borderRadius: INNER_HALF,
    left: RING_STROKE, top: RING_STROKE,
    alignItems: "center", justifyContent: "center",
  },
  ringAmount: { color: "white", fontSize: 26, fontWeight: "800" as const, letterSpacing: -0.5, textAlign: "center" as const },
  ringLabel:  { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4, textAlign: "center" as const },
});

// ─── Shared sheet styles ──────────────────────────────────────────────────────

const ss = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: "#2a2550", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingHorizontal: 20, paddingBottom: 36,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  handle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 16 },
  sheetTitle:{ color: "white", fontSize: 17, fontWeight: "700", marginBottom: 4 },
  sheetSub:  { color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 10 },
  empty:     { color: "rgba(255,255,255,0.35)", fontSize: 14, textAlign: "center", paddingVertical: 20 },

  item: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12,
    overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  accent:    { width: 4, alignSelf: "stretch" },
  itemBody:  { flex: 1, paddingVertical: 12, paddingHorizontal: 12, gap: 5 },
  itemTop:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  itemTitle: { color: "white", fontSize: 14, fontWeight: "600", flex: 1 },
  hoursBadge:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(167,139,250,0.15)" },
  hoursText: { fontSize: 11, fontWeight: "600", color: "#a78bfa" },
  metaRow:   { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText:  { color: "rgba(255,255,255,0.45)", fontSize: 12 },

  entryCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12,
    overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  entryHours: { color: "#a78bfa", fontSize: 13, fontWeight: "600" },
  entryMeta:  { flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 3 },

  emptyState:     { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40 },
  emptyStateText: { color: "rgba(255,255,255,0.3)", fontSize: 14 },

  closeBtn:     { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  closeBtnText: { color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: "600" },

  addBtn:     { backgroundColor: "#6c5ce7", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginRight: 12, minWidth: 64, alignItems: "center" },
  addBtnText: { color: "white", fontSize: 13, fontWeight: "600" },
});
