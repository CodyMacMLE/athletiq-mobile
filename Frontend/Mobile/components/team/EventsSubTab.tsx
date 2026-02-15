import { useAuth } from "@/contexts/AuthContext";
import { GET_EVENTS } from "@/lib/graphql/queries";
import { useQuery } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type EventTab = "upcoming" | "past";

const EVENT_TYPE_COLORS: Record<string, string> = {
  PRACTICE: "#6c5ce7",
  EVENT: "#a855f7",
  MEETING: "#f39c12",
  REST: "#27ae60",
};

export function EventsSubTab() {
  const { selectedOrganization, selectedTeamId } = useAuth();
  const [tab, setTab] = useState<EventTab>("upcoming");

  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsAhead = new Date(now);
  threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3);

  const { data, loading } = useQuery(GET_EVENTS, {
    variables: {
      organizationId: selectedOrganization?.id,
      startDate: threeMonthsAgo.toISOString().split("T")[0],
      endDate: threeMonthsAhead.toISOString().split("T")[0],
    },
    skip: !selectedOrganization?.id,
  });

  const teamEvents = useMemo(() => {
    const allEvents = data?.events || [];
    return allEvents.filter(
      (e: any) =>
        e.team?.id === selectedTeamId ||
        e.participatingTeams?.some((t: any) => t.id === selectedTeamId)
    );
  }, [data, selectedTeamId]);

  const today = now.toISOString().split("T")[0];

  const upcomingEvents = useMemo(
    () => teamEvents.filter((e: any) => e.date >= today).sort((a: any, b: any) => a.date.localeCompare(b.date)),
    [teamEvents, today]
  );

  const pastEvents = useMemo(
    () => teamEvents.filter((e: any) => e.date < today).sort((a: any, b: any) => b.date.localeCompare(a.date)),
    [teamEvents, today]
  );

  const displayEvents = tab === "upcoming" ? upcomingEvents : pastEvents;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Upcoming / Past Toggle */}
      <View style={styles.tabRow}>
        {(["upcoming", "past"] as EventTab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "upcoming" ? "Upcoming" : "Past"}
            </Text>
          </Pressable>
        ))}
        <View style={styles.eventCount}>
          <Text style={styles.eventCountText}>{displayEvents.length} events</Text>
        </View>
      </View>

      {/* Event List */}
      {loading ? (
        <View style={[styles.listContainer, { paddingVertical: 40, alignItems: "center" }]}>
          <ActivityIndicator color="#a855f7" />
        </View>
      ) : displayEvents.length === 0 ? (
        <View style={[styles.listContainer, { paddingVertical: 40, alignItems: "center" }]}>
          <Feather name="calendar" size={32} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyText}>
            No {tab} events
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {displayEvents.map((event: any, index: number) => (
            <View
              key={event.id}
              style={[
                styles.eventItem,
                index < displayEvents.length - 1 && styles.eventItemBorder,
              ]}
            >
              <View
                style={[
                  styles.typeDot,
                  { backgroundColor: EVENT_TYPE_COLORS[event.type] || "#6c5ce7" },
                ]}
              />
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventMeta}>
                  {formatDate(event.date)} {"\u00B7"} {event.startTime} - {event.endTime}
                </Text>
                {event.location && (
                  <View style={styles.locationRow}>
                    <Feather name="map-pin" size={11} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.locationText}>{event.location}</Text>
                  </View>
                )}
              </View>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{event.type}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  tabActive: {
    backgroundColor: "#6c5ce7",
  },
  tabText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "500",
  },
  tabTextActive: {
    color: "white",
  },
  eventCount: {
    flex: 1,
    alignItems: "flex-end",
  },
  eventCountText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
  },
  listContainer: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginTop: 16,
    overflow: "hidden",
  },
  eventItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  eventItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  typeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    color: "white",
    fontSize: 15,
    fontWeight: "500",
  },
  eventMeta: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  locationText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
  },
  typeBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  emptyText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    marginTop: 8,
  },
});
