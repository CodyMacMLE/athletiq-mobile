import { useAuth } from "@/contexts/AuthContext";
import { GET_RECENT_ACTIVITY } from "@/lib/graphql/queries";
import { useQuery } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type ActivityItem = {
  id: string;
  type: string;
  time: string;
  date: string;
  eventTitle?: string;
  eventType?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    image?: string;
  };
};

const TYPE_CONFIG: Record<string, { icon: "log-in" | "log-out" | "info"; color: string; label: string }> = {
  "check-in": { icon: "log-in", color: "#27ae60", label: "Checked In" },
  "check-out": { icon: "log-out", color: "#3498db", label: "Checked Out" },
  "excused": { icon: "info", color: "#9b59b6", label: "Excused" },
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  PRACTICE: "#6c5ce7",
  EVENT: "#e74c3c",
  MEETING: "#f39c12",
  GAME: "#e74c3c",
  REST: "#27ae60",
};

function formatDateGroup(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();

  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = today.getTime() - dateDay.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function getDateKey(isoDate: string): string {
  const date = new Date(isoDate);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function Activity() {
  const router = useRouter();
  const { selectedOrganization } = useAuth();

  const { data, loading } = useQuery(GET_RECENT_ACTIVITY, {
    variables: {
      organizationId: selectedOrganization?.id,
      limit: 50,
    },
    skip: !selectedOrganization?.id,
  });

  const activityData: ActivityItem[] = data?.recentActivity || [];

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: { label: string; key: string; items: ActivityItem[] }[] = [];
    const keyMap = new Map<string, number>();

    for (const item of activityData) {
      const key = getDateKey(item.date);
      const existing = keyMap.get(key);
      if (existing !== undefined) {
        groups[existing].items.push(item);
      } else {
        keyMap.set(key, groups.length);
        groups.push({ label: formatDateGroup(item.date), key, items: [item] });
      }
    }

    return groups;
  }, [activityData]);

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
        <Text style={styles.title}>Recent Activity</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#a855f7" size="large" />
        </View>
      ) : activityData.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Feather name="activity" size={40} color="rgba(255,255,255,0.2)" />
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, marginTop: 12 }}>
            No recent activity
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {groupedActivities.map((group) => (
            <View key={group.key} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{group.label}</Text>
              <View style={styles.activityList}>
                {group.items.map((item, index) => {
                  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG["check-in"];
                  const eventColor = item.eventType
                    ? EVENT_TYPE_COLORS[item.eventType] || "#6c5ce7"
                    : undefined;
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.activityItem,
                        index < group.items.length - 1 && styles.activityItemBorder,
                      ]}
                    >
                      <View style={[styles.activityIcon, { backgroundColor: `${config.color}20` }]}>
                        <Feather name={config.icon} size={16} color={config.color} />
                      </View>
                      <View style={styles.activityInfo}>
                        <Text style={styles.activityName}>
                          {item.user.firstName} {item.user.lastName}
                        </Text>
                        {item.eventTitle ? (
                          <View style={styles.activityMeta}>
                            {eventColor && (
                              <View style={[styles.eventDot, { backgroundColor: eventColor }]} />
                            )}
                            <Text style={styles.activityEvent} numberOfLines={1}>
                              {item.eventTitle}
                            </Text>
                            <Text style={styles.activityTimeSep}>&middot;</Text>
                            <Text style={styles.activityTime}>{item.time}</Text>
                          </View>
                        ) : (
                          <Text style={styles.activityTime}>{item.time}</Text>
                        )}
                      </View>
                      <View style={[styles.activityBadge, { backgroundColor: `${config.color}20` }]}>
                        <Text style={[styles.activityBadgeText, { color: config.color }]}>
                          {config.label}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
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
  dateGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  activityList: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  activityItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    color: "white",
    fontSize: 15,
    fontWeight: "500",
  },
  activityMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activityEvent: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    flexShrink: 1,
  },
  activityTimeSep: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 13,
  },
  activityTime: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 2,
  },
  activityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activityBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
