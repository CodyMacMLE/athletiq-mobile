import { View, Text, ScrollView, Switch, StyleSheet, Pressable } from "react-native";
import { Stack, router } from "expo-router";
import { useQuery, useMutation } from "@apollo/client";
import { gql } from "@apollo/client";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";

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

  // Local state for immediate UI updates
  const [emailEnabled, setEmailEnabled] = useState(prefs?.emailEnabled ?? true);
  const [pushEnabled, setPushEnabled] = useState(prefs?.pushEnabled ?? true);
  const [eventRemindersEnabled, setEventRemindersEnabled] = useState(prefs?.eventRemindersEnabled ?? true);
  const [eventReminderMinutes, setEventReminderMinutes] = useState(prefs?.eventReminderMinutes ?? 120);
  const [announcementsEnabled, setAnnouncementsEnabled] = useState(prefs?.announcementsEnabled ?? true);
  const [excuseStatusEnabled, setExcuseStatusEnabled] = useState(prefs?.excuseStatusEnabled ?? true);
  const [milestonesEnabled, setMilestonesEnabled] = useState(prefs?.milestonesEnabled ?? true);

  // Update local state when data loads
  useEffect(() => {
    if (prefs) {
      setEmailEnabled(prefs.emailEnabled);
      setPushEnabled(prefs.pushEnabled);
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

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: "Notification Settings",
            headerStyle: { backgroundColor: "#1a1640" },
            headerTintColor: "#fff",
          }}
        />
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Notification Settings",
          headerStyle: { backgroundColor: "#1a1640" },
          headerTintColor: "#fff",
        }}
      />

      <ScrollView style={styles.scrollView}>
        {/* Delivery Channels */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Channels</Text>
          <Text style={styles.sectionDescription}>
            Choose how you want to receive notifications
          </Text>

          <View style={styles.setting}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={20} color="#9ca3af" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDescription}>Receive alerts on your device</Text>
              </View>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={(value) => {
                setPushEnabled(value);
                updatePref({ pushEnabled: value });
              }}
              trackColor={{ false: "#374151", true: "#a855f7" }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.setting}>
            <View style={styles.settingLeft}>
              <Ionicons name="mail-outline" size={20} color="#9ca3af" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Email</Text>
                <Text style={styles.settingDescription}>Receive notifications via email</Text>
              </View>
            </View>
            <Switch
              value={emailEnabled}
              onValueChange={(value) => {
                setEmailEnabled(value);
                updatePref({ emailEnabled: value });
              }}
              trackColor={{ false: "#374151", true: "#a855f7" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Event Reminders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Reminders</Text>

          <View style={styles.setting}>
            <View style={styles.settingLeft}>
              <Ionicons name="time-outline" size={20} color="#9ca3af" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Event Reminders</Text>
                <Text style={styles.settingDescription}>Get notified before events start</Text>
              </View>
            </View>
            <Switch
              value={eventRemindersEnabled}
              onValueChange={(value) => {
                setEventRemindersEnabled(value);
                updatePref({ eventRemindersEnabled: value });
              }}
              trackColor={{ false: "#374151", true: "#a855f7" }}
              thumbColor="#fff"
            />
          </View>

          {eventRemindersEnabled && (
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Remind me</Text>
              {REMINDER_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.pickerOption,
                    eventReminderMinutes === option.value && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setEventReminderMinutes(option.value);
                    updatePref({ eventReminderMinutes: option.value });
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      eventReminderMinutes === option.value && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {eventReminderMinutes === option.value && (
                    <Ionicons name="checkmark" size={20} color="#a855f7" />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Other Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Other Notifications</Text>

          <View style={styles.setting}>
            <View style={styles.settingLeft}>
              <Ionicons name="megaphone-outline" size={20} color="#9ca3af" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Announcements</Text>
                <Text style={styles.settingDescription}>Team and organization announcements</Text>
              </View>
            </View>
            <Switch
              value={announcementsEnabled}
              onValueChange={(value) => {
                setAnnouncementsEnabled(value);
                updatePref({ announcementsEnabled: value });
              }}
              trackColor={{ false: "#374151", true: "#a855f7" }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.setting}>
            <View style={styles.settingLeft}>
              <Ionicons name="document-text-outline" size={20} color="#9ca3af" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Excuse Status Updates</Text>
                <Text style={styles.settingDescription}>When your excuse is approved/denied</Text>
              </View>
            </View>
            <Switch
              value={excuseStatusEnabled}
              onValueChange={(value) => {
                setExcuseStatusEnabled(value);
                updatePref({ excuseStatusEnabled: value });
              }}
              trackColor={{ false: "#374151", true: "#a855f7" }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.setting}>
            <View style={styles.settingLeft}>
              <Ionicons name="trophy-outline" size={20} color="#9ca3af" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Milestones</Text>
                <Text style={styles.settingDescription}>Celebrate attendance achievements</Text>
              </View>
            </View>
            <Switch
              value={milestonesEnabled}
              onValueChange={(value) => {
                setMilestonesEnabled(value);
                updatePref({ milestonesEnabled: value });
              }}
              trackColor={{ false: "#374151", true: "#a855f7" }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0a2e",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#9ca3af",
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 16,
  },
  setting: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1640",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#fff",
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: "#9ca3af",
  },
  pickerContainer: {
    backgroundColor: "#1a1640",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#9ca3af",
    marginBottom: 12,
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerOptionSelected: {
    backgroundColor: "#2a2058",
  },
  pickerOptionText: {
    fontSize: 15,
    color: "#d1d5db",
  },
  pickerOptionTextSelected: {
    color: "#a855f7",
    fontWeight: "500",
  },
});
