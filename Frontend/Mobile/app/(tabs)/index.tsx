import { Organization, User } from "@/types";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const user: User = {
  image: undefined,
  firstName: "Cody",
  lastName: "MacDonald",
  email: "cody@example.com",
  phone: "123-456-7890",
  address: "123 Main St",
  city: "",
  country: "",
};

const AVATAR_SIZE = 45;

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Mock data - from API
const organizations: Organization[] = [
  { id: "1", name: "Shenderey" },
  { id: "2", name: "Downtown Athletics" },
  { id: "3", name: "Peak Performance" },
];
const trainingDays = [true, true, true, true, true, false, false]; // Mon-Fri are training days
const checkedInDays = [true, true, false, true, true, false, false]; // Mon-Sun check-ins
const recentActivity = [
  { name: "Cody MacDonald", time: "8:02 AM", type: "check-in" as const },
  { name: "Sarah Chen", time: "7:45 AM", type: "check-in" as const },
  { name: "Marcus Lee", time: "7:30 AM", type: "check-in" as const },
  { name: "Ava Torres", time: "6:55 AM", type: "check-in" as const },
];

export default function Index() {
  const router = useRouter();
  const [selectedOrg, setSelectedOrg] = useState(organizations[0]);
  const [orgPickerVisible, setOrgPickerVisible] = useState(false);

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />

      {/* Organization Picker Modal */}
      <Modal
        visible={orgPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOrgPickerVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setOrgPickerVisible(false)}
        >
          <View style={styles.orgPickerContainer}>
            <Text style={styles.orgPickerTitle}>Select Organization</Text>
            {organizations.map((org) => (
              <Pressable
                key={org.id}
                style={({ pressed }) => [
                  styles.orgPickerItem,
                  pressed && styles.orgPickerItemPressed,
                  selectedOrg.id === org.id && styles.orgPickerItemSelected,
                ]}
                onPress={() => {
                  setSelectedOrg(org);
                  setOrgPickerVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.orgPickerItemText,
                    selectedOrg.id === org.id && styles.orgPickerItemTextSelected,
                  ]}
                >
                  {org.name}
                </Text>
                {selectedOrg.id === org.id && (
                  <Feather name="check" size={18} color="#a855f7" />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Dashboard</Text>
          <Pressable
            style={({ pressed }) => [
              styles.subtitleContainer,
              pressed && styles.subtitlePressed,
            ]}
            onPress={() => setOrgPickerVisible(true)}
          >
            <Text style={styles.subtitle}>{selectedOrg.name}</Text>
            <Feather name="chevron-down" size={16} color="white" />
          </Pressable>
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Check-In Button */}
        <Pressable
          onPress={() => router.push("/checkin")}
          style={({ pressed }) => [
            styles.checkInButton,
            pressed && styles.checkInButtonPressed,
          ]}
        >
          <LinearGradient
            colors={["#6c5ce7", "#a855f7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.checkInGradient}
          >
            <Feather name="check-circle" size={28} color="white" />
            <Text style={styles.checkInText}>Check In</Text>
            <Text style={styles.checkInSubtext}>
              Tap to record your attendance
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>24</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>5</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>87%</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
        </View>

        {/* Weekly Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.weekRow}>
            {WEEK_DAYS.map((day, i) => {
              const isTrainingDay = trainingDays[i];
              const isCheckedIn = checkedInDays[i];

              return (
                <View key={day} style={styles.dayColumn}>
                  <View
                    style={[
                      styles.dayDot,
                      !isTrainingDay
                        ? styles.dayDotOff
                        : isCheckedIn
                          ? styles.dayDotActive
                          : styles.dayDotInactive,
                    ]}
                  >
                    {!isTrainingDay && (
                      <Feather name="minus" size={14} color="rgba(255,255,255,0.3)" />
                    )}
                    {isTrainingDay && isCheckedIn && (
                      <Feather name="check" size={14} color="white" />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.dayLabel,
                      !isTrainingDay
                        ? styles.dayLabelOff
                        : isCheckedIn && styles.dayLabelActive,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <Pressable onPress={() => router.push("/activity")}>
              <Text style={styles.seeAll}>See All</Text>
            </Pressable>
          </View>
          <View style={styles.activityList}>
            {recentActivity.map((item, i) => (
              <View
                key={i}
                style={[
                  styles.activityItem,
                  i < recentActivity.length - 1 && styles.activityItemBorder,
                ]}
              >
                <View style={styles.activityIcon}>
                  <Feather name="log-in" size={16} color="#a855f7" />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityName}>{item.name}</Text>
                  <Text style={styles.activityTime}>{item.time}</Text>
                </View>
                <View style={styles.activityBadge}>
                  <Text style={styles.activityBadgeText}>Checked In</Text>
                </View>
              </View>
            ))}
          </View>
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
    paddingHorizontal: 20,
    paddingBottom: 40,
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
  subtitleContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginLeft: -8,
    borderRadius: 8,
  },
  subtitlePressed: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  subtitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },

  // Organization Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  orgPickerContainer: {
    backgroundColor: "#2a2550",
    borderRadius: 16,
    width: "100%",
    maxWidth: 320,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  orgPickerTitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  orgPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  orgPickerItemPressed: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  orgPickerItemSelected: {
    backgroundColor: "rgba(168,85,247,0.15)",
  },
  orgPickerItemText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  orgPickerItemTextSelected: {
    color: "#a855f7",
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

  // Check-In CTA
  checkInButton: {
    marginTop: 28,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  checkInButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  checkInGradient: {
    paddingVertical: 28,
    alignItems: "center",
    gap: 8,
  },
  checkInText: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 4,
  },
  checkInSubtext: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  statValue: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  statLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    marginTop: 4,
  },

  // Sections
  section: {
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "600",
  },
  seeAll: {
    color: "#a855f7",
    fontSize: 14,
    fontWeight: "500",
  },

  // Weekly overview
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  dayColumn: {
    alignItems: "center",
    gap: 8,
  },
  dayDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  dayDotActive: {
    backgroundColor: "#6c5ce7",
  },
  dayDotInactive: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  dayDotOff: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  dayLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "500",
  },
  dayLabelActive: {
    color: "rgba(255,255,255,0.8)",
  },
  dayLabelOff: {
    color: "rgba(255,255,255,0.25)",
  },

  // Activity list
  activityList: {
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  activityItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(168,85,247,0.15)",
    justifyContent: "center",
    alignItems: "center",
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
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    marginTop: 2,
  },
  activityBadge: {
    backgroundColor: "rgba(108,92,231,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activityBadgeText: {
    color: "#a855f7",
    fontSize: 12,
    fontWeight: "600",
  },
});
