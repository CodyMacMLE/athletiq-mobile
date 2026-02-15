import { SUBMIT_FEEDBACK } from "@/lib/graphql/mutations";
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

type FaqItem = {
  question: string;
  answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "How do I check in to an event?",
    answer:
      "Tap an NFC tag registered to your organization when you arrive at an event. The app will automatically match you to the current or upcoming event and record your check-in. You can also be checked in manually by a coach or admin.",
  },
  {
    question: "How do NFC tags work?",
    answer:
      "NFC tags are small physical tags placed at event locations. When you tap your phone on a tag, the app reads its unique ID and matches it to your organization. It then finds today's event and records your attendance automatically.",
  },
  {
    question: "How do I request an absence?",
    answer:
      'Go to the Calendar tab, tap on the event you\'ll miss, then tap "Request Absence." Enter your reason and submit. Your coach or admin will review and approve or deny the request.',
  },
  {
    question: "How do I change my profile picture?",
    answer:
      "Go to the Profile tab and tap the camera icon on your avatar. Select a photo from your library. The image will be cropped to a square and uploaded automatically.",
  },
  {
    question: "Who can see my attendance data?",
    answer:
      "Your attendance data is visible to you, your team coaches, and organization admins/owners. Other team members can see leaderboard rankings but not your detailed attendance records.",
  },
];

const CATEGORIES = [
  { key: "BUG", label: "Bug Report" },
  { key: "FEATURE", label: "Feature Request" },
  { key: "QUESTION", label: "Question" },
  { key: "OTHER", label: "Other" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

export default function HelpSupport() {
  const router = useRouter();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [message, setMessage] = useState("");

  const [submitFeedback, { loading }] = useMutation(SUBMIT_FEEDBACK);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleSubmit = async () => {
    if (!category || !message.trim()) return;

    try {
      await submitFeedback({
        variables: {
          input: {
            category,
            message: message.trim(),
          },
        },
      });
      Alert.alert("Thank you!", "Your feedback has been submitted. We'll get back to you soon.");
      setCategory(null);
      setMessage("");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit feedback. Please try again.");
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
          <Text style={styles.headerTitle}>Help & Support</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* FAQ Section */}
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.faqCard}>
            {FAQ_ITEMS.map((item, index) => (
              <View key={index}>
                <Pressable
                  style={({ pressed }) => [
                    styles.faqItem,
                    index < FAQ_ITEMS.length - 1 && styles.faqItemBorder,
                    pressed && styles.faqItemPressed,
                  ]}
                  onPress={() => toggleFaq(index)}
                >
                  <Text style={styles.faqQuestion}>{item.question}</Text>
                  <Feather
                    name={expandedFaq === index ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="rgba(255,255,255,0.4)"
                  />
                </Pressable>
                {expandedFaq === index && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{item.answer}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Feedback Form */}
          <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Send Feedback</Text>

          {/* Category Chips */}
          <View style={styles.chipRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.key}
                style={[
                  styles.chip,
                  category === cat.key && styles.chipSelected,
                ]}
                onPress={() => setCategory(cat.key)}
              >
                <Text
                  style={[
                    styles.chipText,
                    category === cat.key && styles.chipTextSelected,
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Message Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Message</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Describe your issue or suggestion..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          {/* Submit Button */}
          <View style={styles.submitContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                (!category || !message.trim() || loading) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!category || !message.trim() || loading}
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
                  <Text style={styles.submitText}>Submit Feedback</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
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

  // Section
  sectionTitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },

  // FAQ
  faqCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  faqItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  faqItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  faqItemPressed: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  faqQuestion: {
    color: "white",
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  faqAnswerText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    lineHeight: 20,
  },

  // Category Chips
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  chipSelected: {
    backgroundColor: "rgba(168,85,247,0.25)",
    borderColor: "#a855f7",
  },
  chipText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: "500",
  },
  chipTextSelected: {
    color: "#a855f7",
  },

  // Input
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  messageInput: {
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
});
