import { View, Text, ScrollView, Switch, StyleSheet, Pressable } from "react-native";
import { Stack, router } from "expo-router";
import { useQuery, useMutation } from "@apollo/client";
import { gql } from "@apollo/client";
import { useState, useEffect } from "react";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";

const GET_NOTIFICATION_PREFERENCES = gql(`
  query GetNotificationPreferences {
    myNotificationPreferences {
      id
      emailEnabled
      pushEnabled
      smsEnabled
      eventRemindersEnabled
      eventReminderMinutes
      announcementsEnabled
      excuseStatusEnabled
      milestonesEnabled
    }
  }
`);

const UPDATE_NOTIFICATION_PREFERENCES = gql(`
  mutation UpdateNotificationPreferences($input: UpdateNotificationPreferencesInput!) {
    updateNotificationPreferences(input: $input) {
      id
      emailEnabled
      pushEnabled
      smsEnabled
      eventRemindersEnabled
      eventReminderMinutes
      announcementsEnabled
      excuseStatusEnabled
      milestonesEnabled
    }
  }
`);

const REMINDER_OPTIONS = [
  { label: "30 minutes before", value: 30 },
  { label: "1 hour before", value: 60 },
  { label: "2 hours before", value: 120 },
  { label: "3 hours before", value: 180 },
  { label: "6 hours before", value: 360 },
];

export default function NotificationSettings() {
  const { data, loading } = useQuery(GET_NOTIFICATION_PREFERENCES);
  const [updatePreferences] = useMutation(UPDATE_NOTIFICATION_PREFERENCES);

  const prefs = data?.myNotificationPreferences;

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [eventRemindersEnabled, setEventRemindersEnabled] = useState(true);
  const [eventReminderMinutes, setEventReminderMinutes] = useState(120);
  const [announcementsEnabled, setAnnouncementsEnabled] = useState(true);
  const [excuseStatusEnabled, setExcuseStatusEnabled] = useState(true);
  const [milestonesEnabled, setMilestonesEnabled] = useState(true);

  useEffect(() => {
    if (prefs) {
      setPushEnabled(prefs.pushEnabled);
      setEmailEnabled(prefs.emailEnabled);
      setEventRemindersEnabled(prefs.eventRemindersEnabled);
      setEventReminderMinutes(prefs.eventReminderMinutes);
      setAnnouncementsEnabled(prefs.announcementsEnabled);
      setExcuseStatusEnabled(prefs.excuseStatusEnabled);
      setMilestonesEnabled(prefs.milestonesEnabled);
    }
  }, [prefs]);

  const updatePref = async (input: any) => {
    try {
      await updatePreferences({ variables: { input } });
    } catch (error) {
      console.error("Failed to update preferences:", error);
    }
  };

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Notifications",
          headerStyle: { backgroundColor: "#302b6f" },
          headerTintColor: "#fff",
          headerShadowVisible: false,
          headerBackTitle: "Profile",
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : (
          <>
            {/* Delivery Channels */}
            <Text style={styles.sectionTitle}>Delivery Channels</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.iconContainer}>
                  <Feather name="bell" size={18} color="#a855f7" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Push Notifications</Text>
                  <Text style={styles.rowDescription}>Alerts on your device</Text>
                </View>
                <Switch
                  value={pushEnabled}
                  onValueChange={(value) => {
                    setPushEnabled(value);
                    updatePref({ pushEnabled: value });
                  }}
                  trackColor={{ false: "rgba(255,255,255,0.15)", true: "#a855f7" }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.iconContainer}>
                  <Feather name="mail" size={18} color="#a855f7" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Email</Text>
                  <Text style={styles.rowDescription}>Notifications via email</Text>
                </View>
                <Switch
                  value={emailEnabled}
                  onValueChange={(value) => {
                    setEmailEnabled(value);
                    updatePref({ emailEnabled: value });
                  }}
                  trackColor={{ false: "rgba(255,255,255,0.15)", true: "#a855f7" }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            {/* Event Reminders */}
            <Text style={styles.sectionTitle}>Event Reminders</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.iconContainer}>
                  <Feather name="clock" size={18} color="#a855f7" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Event Reminders</Text>
                  <Text style={styles.rowDescription}>Get notified before events</Text>
                </View>
                <Switch
                  value={eventRemindersEnabled}
                  onValueChange={(value) => {
                    setEventRemindersEnabled(value);
                    updatePref({ eventRemindersEnabled: value });
                  }}
                  trackColor={{ false: "rgba(255,255,255,0.15)", true: "#a855f7" }}
                  thumbColor="#fff"
                />
              </View>

              {eventRemindersEnabled && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.reminderLabel}>Remind me</Text>
                  {REMINDER_OPTIONS.map((option, index) => (
                    <Pressable
                      key={option.value}
                      style={({ pressed }) => [
                        styles.reminderOption,
                        index < REMINDER_OPTIONS.length - 1 && styles.reminderOptionBorder,
                        eventReminderMinutes === option.value && styles.reminderOptionSelected,
                        pressed && styles.reminderOptionPressed,
                      ]}
                      onPress={() => {
                        setEventReminderMinutes(option.value);
                        updatePref({ eventReminderMinutes: option.value });
                      }}
                    >
                      <Text
                        style={[
                          styles.reminderOptionText,
                          eventReminderMinutes === option.value && styles.reminderOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      {eventReminderMinutes === option.value && (
                        <Feather name="check" size={18} color="#a855f7" />
                      )}
                    </Pressable>
                  ))}
                </>
              )}
            </View>

            {/* Other Notifications */}
            <Text style={styles.sectionTitle}>Other Notifications</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.iconContainer}>
                  <Feather name="volume-2" size={18} color="#a855f7" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Announcements</Text>
                  <Text style={styles.rowDescription}>Team and org announcements</Text>
                </View>
                <Switch
                  value={announcementsEnabled}
                  onValueChange={(value) => {
                    setAnnouncementsEnabled(value);
                    updatePref({ announcementsEnabled: value });
                  }}
                  trackColor={{ false: "rgba(255,255,255,0.15)", true: "#a855f7" }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.iconContainer}>
                  <Feather name="file-text" size={18} color="#a855f7" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Excuse Status</Text>
                  <Text style={styles.rowDescription}>When your excuse is reviewed</Text>
                </View>
                <Switch
                  value={excuseStatusEnabled}
                  onValueChange={(value) => {
                    setExcuseStatusEnabled(value);
                    updatePref({ excuseStatusEnabled: value });
                  }}
                  trackColor={{ false: "rgba(255,255,255,0.15)", true: "#a855f7" }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.iconContainer}>
                  <Feather name="award" size={18} color="#a855f7" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Milestones</Text>
                  <Text style={styles.rowDescription}>Attendance achievements</Text>
                </View>
                <Switch
                  value={milestonesEnabled}
                  onValueChange={(value) => {
                    setMilestonesEnabled(value);
                    updatePref({ milestonesEnabled: value });
                  }}
                  trackColor={{ false: "rgba(255,255,255,0.15)", true: "#a855f7" }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </>
        )}
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
    paddingTop: 16,
    paddingBottom: 100,
  },
  loadingText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
    textAlign: "center",
    marginTop: 40,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 24,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(168,85,247,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    color: "white",
    fontSize: 15,
    fontWeight: "500",
  },
  rowDescription: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 2,
  },
  reminderLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "500",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  reminderOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  reminderOptionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  reminderOptionSelected: {
    backgroundColor: "rgba(168,85,247,0.1)",
  },
  reminderOptionPressed: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  reminderOptionText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
  },
  reminderOptionTextSelected: {
    color: "#a855f7",
    fontWeight: "500",
  },
});
