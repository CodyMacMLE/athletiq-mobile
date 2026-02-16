import { useAuth } from "@/contexts/AuthContext";
import { INVITE_GUARDIAN } from "@/lib/graphql/mutations";
import { useMutation } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
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

export default function InviteGuardian() {
  const router = useRouter();
  const { selectedOrganization } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const [inviteGuardian, { loading }] = useMutation(INVITE_GUARDIAN);

  const handleSend = async () => {
    if (!email.trim() || !selectedOrganization) return;

    try {
      await inviteGuardian({
        variables: {
          email: email.trim().toLowerCase(),
          organizationId: selectedOrganization.id,
        },
      });
      setSent(true);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send invite. Please try again.");
    }
  };

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
          <Text style={styles.headerTitle}>Invite Guardian</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {sent ? (
            /* Success State */
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Feather name="check-circle" size={56} color="#22c55e" />
              </View>
              <Text style={styles.successTitle}>Invite Sent!</Text>
              <Text style={styles.successDescription}>
                An invitation has been sent to {email}. They'll be able to view your attendance, stats, and upcoming events once they accept.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.doneButton,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => router.back()}
              >
                <LinearGradient
                  colors={["#6c5ce7", "#a855f7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.doneGradient}
                >
                  <Text style={styles.doneText}>Done</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            /* Invite Form */
            <>
              {/* Info Card */}
              <View style={styles.infoCard}>
                <View style={styles.infoIconContainer}>
                  <Feather name="users" size={22} color="#a855f7" />
                </View>
                <Text style={styles.infoTitle}>What can guardians see?</Text>
                <Text style={styles.infoDescription}>
                  Guardians can view your attendance records, stats, and upcoming events. They won't have access to any coaching tools or team management features.
                </Text>
              </View>

              {/* Email Input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Guardian's Email</Text>
                <TextInput
                  style={styles.emailInput}
                  placeholder="Enter email address"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
              </View>

              {/* Send Button */}
              <View style={styles.submitContainer}>
                <Pressable
                  style={({ pressed }) => [
                    styles.submitButton,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                    (!email.trim() || loading) && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={!email.trim() || loading}
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
                      <Text style={styles.submitText}>Send Invite</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
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
    paddingBottom: 100,
  },

  // Info card
  infoCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 20,
    alignItems: "center",
    marginBottom: 28,
  },
  infoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(168,85,247,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  infoTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  infoDescription: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  // Input
  inputSection: {
    marginBottom: 28,
  },
  inputLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  emailInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 16,
    color: "white",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  // Submit
  submitContainer: {
    marginBottom: 20,
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

  // Success state
  successContainer: {
    alignItems: "center",
    paddingTop: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(34,197,94,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
  },
  successDescription: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  doneButton: {
    borderRadius: 14,
    overflow: "hidden",
    width: "100%",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  doneGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: {
    color: "white",
    fontSize: 17,
    fontWeight: "bold",
  },
});
