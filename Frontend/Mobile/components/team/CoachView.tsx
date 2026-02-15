import { RosterSubTab } from "@/components/team/RosterSubTab";
import { EventsSubTab } from "@/components/team/EventsSubTab";
import { AttendanceSubTab } from "@/components/team/AttendanceSubTab";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const TABS = ["Roster", "Events", "Attendance"] as const;
type Tab = typeof TABS[number];

export function CoachView() {
  const [activeTab, setActiveTab] = useState<Tab>("Roster");

  return (
    <View style={styles.container}>
      {/* Segmented Control */}
      <View style={styles.segmentedControl}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            style={[styles.segment, activeTab === tab && styles.segmentActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.segmentText, activeTab === tab && styles.segmentTextActive]}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Active Sub-Tab Content */}
      {activeTab === "Roster" && <RosterSubTab />}
      {activeTab === "Events" && <EventsSubTab />}
      {activeTab === "Attendance" && <AttendanceSubTab />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 3,
    marginTop: 16,
    marginHorizontal: 20,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: "#6c5ce7",
  },
  segmentText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "500",
  },
  segmentTextActive: {
    color: "white",
  },
});
