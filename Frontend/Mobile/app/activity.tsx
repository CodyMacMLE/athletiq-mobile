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
    return activityData.reduce((acc, item) => {
      const dateKey = item.date || "Unknown";
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(item);
      return acc;
    }, {} as Record<string, ActivityItem[]>);
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
          {Object.entries(groupedActivities).map(([date, items]) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{date}</Text>
              <View style={styles.activityList}>
                {items.map((item, index) => {
                  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG["check-in"];
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.activityItem,
                        index < items.length - 1 && styles.activityItemBorder,
                      ]}
                    >
                      <View style={[styles.activityIcon, { backgroundColor: `${config.color}20` }]}>
                        <Feather name={config.icon} size={16} color={config.color} />
                      </View>
                      <View style={styles.activityInfo}>
                        <Text style={styles.activityName}>
                          {item.user.firstName} {item.user.lastName}
                        </Text>
                        <Text style={styles.activityTime}>{item.time}</Text>
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
