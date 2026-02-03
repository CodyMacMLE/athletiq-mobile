import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type ActivityItem = {
  id: string;
  name: string;
  time: string;
  date: string;
  type: "check-in" | "check-out" | "excused";
};

// Mock extended activity data
const activityData: ActivityItem[] = [
  { id: "1", name: "Cody MacDonald", time: "8:02 AM", date: "Today", type: "check-in" },
  { id: "2", name: "Sarah Chen", time: "7:45 AM", date: "Today", type: "check-in" },
  { id: "3", name: "Marcus Lee", time: "7:30 AM", date: "Today", type: "check-in" },
  { id: "4", name: "Ava Torres", time: "6:55 AM", date: "Today", type: "check-in" },
  { id: "5", name: "Jake Wilson", time: "6:50 AM", date: "Today", type: "check-in" },
  { id: "6", name: "Emma Davis", time: "6:45 AM", date: "Today", type: "check-in" },
  { id: "7", name: "Liam Brown", time: "8:15 PM", date: "Yesterday", type: "check-out" },
  { id: "8", name: "Cody MacDonald", time: "8:02 PM", date: "Yesterday", type: "check-out" },
  { id: "9", name: "Sarah Chen", time: "8:00 PM", date: "Yesterday", type: "check-out" },
  { id: "10", name: "Marcus Lee", time: "6:00 PM", date: "Yesterday", type: "check-in" },
  { id: "11", name: "Ava Torres", time: "5:58 PM", date: "Yesterday", type: "check-in" },
  { id: "12", name: "Jake Wilson", time: "5:55 PM", date: "Yesterday", type: "check-in" },
  { id: "13", name: "Taylor Smith", time: "4:00 PM", date: "Yesterday", type: "excused" },
  { id: "14", name: "Emma Davis", time: "8:10 PM", date: "2 days ago", type: "check-out" },
  { id: "15", name: "Cody MacDonald", time: "8:00 PM", date: "2 days ago", type: "check-out" },
];

const TYPE_CONFIG = {
  "check-in": { icon: "log-in" as const, color: "#27ae60", label: "Checked In" },
  "check-out": { icon: "log-out" as const, color: "#3498db", label: "Checked Out" },
  "excused": { icon: "info" as const, color: "#9b59b6", label: "Excused" },
};

export default function Activity() {
  const router = useRouter();

  // Group activities by date
  const groupedActivities = activityData.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {} as Record<string, ActivityItem[]>);

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
                const config = TYPE_CONFIG[item.type];
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
                      <Text style={styles.activityName}>{item.name}</Text>
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
