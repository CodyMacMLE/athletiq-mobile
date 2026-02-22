import { useAuth } from "@/contexts/AuthContext";
import { CREATE_EXCUSE_REQUEST } from "@/lib/graphql/mutations";
import { useMutation } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const EVENT_TYPE_COLORS: Record<string, string> = {
  PRACTICE: "#6c5ce7",
  EVENT: "#e74c3c",
  MEETING: "#f39c12",
  GAME: "#e74c3c",
  REST: "#27ae60",
  practice: "#6c5ce7",
  event: "#e74c3c",
  meeting: "#f39c12",
  game: "#e74c3c",
};

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function RequestAbsence() {
  const router = useRouter();
  const { user, targetUserId } = useAuth();
  const params = useLocalSearchParams<{
    eventId: string;
    eventTitle: string;
    eventDate: string;
    eventStartTime: string;
    eventEndTime: string;
    eventType: string;
    teamName: string;
    attemptCount: string;
  }>();

  const [reason, setReason] = useState("");
  const currentAttempt = params.attemptCount ? parseInt(params.attemptCount) + 1 : 1;
  const attemptsRemaining = 3 - (currentAttempt - 1);
  const [createExcuse, { loading }] = useMutation(CREATE_EXCUSE_REQUEST, {
    refetchQueries: ["GetMyExcuseRequests"],
  });

  const handleSubmit = async () => {
    if (!reason.trim() || !targetUserId || !params.eventId) return;

    try {
      await createExcuse({
        variables: {
          input: {
            userId: targetUserId,
            eventId: params.eventId,
            reason: reason.trim(),
          },
        },
      });
      router.back();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit absence request.");
    }
  };

  const eventColor = EVENT_TYPE_COLORS[params.eventType || ""] || "#6c5ce7";

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.5 }]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={22} color="white" />
          </Pressable>
          <Text style={styles.headerTitle}>Request Absence</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Event Card */}
          <View style={styles.eventCard}>
            <View style={[styles.eventAccent, { backgroundColor: eventColor }]} />
            <View style={styles.eventCardContent}>
              <Text style={styles.eventTitle}>{params.eventTitle}</Text>

              <View style={styles.eventDetailRow}>
                <Feather name="calendar" size={14} color="rgba(255,255,255,0.5)" />
                <Text style={styles.eventDetailText}>
                  {params.eventDate ? formatDate(params.eventDate) : ""}
                </Text>
              </View>

              {params.eventStartTime ? (
                <View style={styles.eventDetailRow}>
                  <Feather name="clock" size={14} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.eventDetailText}>
                    {params.eventStartTime}
                    {params.eventEndTime ? ` - ${params.eventEndTime}` : ""}
                  </Text>
                </View>
              ) : null}

              {params.teamName ? (
                <View style={styles.eventDetailRow}>
                  <Feather name="users" size={14} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.eventDetailText}>{params.teamName}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Attempt indicator */}
          <View style={styles.attemptBadge}>
            <Feather name="alert-circle" size={13} color="rgba(255,255,255,0.4)" />
            <Text style={styles.attemptText}>
              Request {currentAttempt} of 3 · {attemptsRemaining} remaining
            </Text>
          </View>

          {/* Reason Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Reason for absence</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Describe why you will be absent..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              autoFocus
            />
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              (!reason.trim() || loading) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!reason.trim() || loading}
          >
            <LinearGradient
              colors={["#6c5ce7", "#a855f7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitGradient}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitText}>Submit Request</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 70,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  // Event Card
  eventCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  eventAccent: {
    width: 5,
  },
  eventCardContent: {
    flex: 1,
    padding: 16,
  },
  eventTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 10,
  },
  eventDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  eventDetailText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
  },

  attemptBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  attemptText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
  },

  // Input
  inputSection: {
    marginTop: 24,
  },
  inputLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  reasonInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 16,
    color: "white",
    fontSize: 16,
    minHeight: 140,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    lineHeight: 22,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  submitButton: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    color: "white",
    fontSize: 17,
    fontWeight: "bold",
  },
});
