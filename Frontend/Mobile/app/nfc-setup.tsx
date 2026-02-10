import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "@apollo/client";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import {
  GET_ORGANIZATION_NFC_TAGS,
  REGISTER_NFC_TAG,
  DEACTIVATE_NFC_TAG,
} from "@/lib/graphql";

let NfcManager: any = null;
let NfcTech: any = null;
let Ndef: any = null;
try {
  const nfc = require("react-native-nfc-manager");
  NfcManager = nfc.default;
  NfcTech = nfc.NfcTech;
  Ndef = nfc.Ndef;
} catch {
  // Native module not available
}

type SetupState = "idle" | "naming" | "writing" | "success" | "error";

export default function NfcSetup() {
  const router = useRouter();
  const { selectedOrganization } = useAuth();
  const [setupState, setSetupState] = useState<SetupState>("idle");
  const [tagName, setTagName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  const orgId = selectedOrganization?.id;

  const { data, loading, refetch } = useQuery(GET_ORGANIZATION_NFC_TAGS, {
    variables: { organizationId: orgId },
    skip: !orgId,
  });

  const [registerNfcTag] = useMutation(REGISTER_NFC_TAG);
  const [deactivateNfcTag] = useMutation(DEACTIVATE_NFC_TAG);

  const tags = data?.organizationNfcTags || [];

  // Pulse animation for write mode
  useEffect(() => {
    if (setupState !== "writing") return;
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0.2,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.6,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => {
      pulse.stop();
      pulseAnim.setValue(1);
      opacityAnim.setValue(0.6);
    };
  }, [setupState, pulseAnim, opacityAnim]);

  const handleStartRegister = () => {
    setTagName("");
    setSetupState("naming");
  };

  const handleConfirmName = async () => {
    if (!tagName.trim()) return;
    setSetupState("writing");
    await writeTag();
  };

  const handleCancelWrite = () => {
    if (NfcManager) {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
    setSetupState("idle");
  };

  async function writeTag() {
    if (!NfcManager || !Ndef || !orgId) {
      setErrorMessage("NFC is not available on this device");
      setSetupState("error");
      return;
    }

    try {
      const token = crypto.randomUUID();
      await NfcManager.requestTechnology(NfcTech.Ndef);

      const bytes = Ndef.encodeMessage([Ndef.textRecord(token)]);
      await NfcManager.ndefHandler.writeNdefMessage(bytes);

      // Register tag in backend
      await registerNfcTag({
        variables: {
          input: {
            token,
            name: tagName.trim(),
            organizationId: orgId,
          },
        },
      });

      setSetupState("success");
      refetch();
    } catch (err: any) {
      const gqlError = err?.graphQLErrors?.[0]?.message || err?.message || "";
      setErrorMessage(gqlError || "Failed to write NFC tag");
      setSetupState("error");
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  }

  const handleDeactivate = (tagId: string, name: string) => {
    Alert.alert(
      "Deactivate Tag",
      `Are you sure you want to deactivate "${name}"? Athletes will no longer be able to check in with this tag.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: async () => {
            try {
              await deactivateNfcTag({ variables: { id: tagId } });
              refetch();
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Failed to deactivate tag");
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(parseInt(dateStr));
    if (isNaN(date.getTime())) {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />

      {/* Name Input Modal */}
      <Modal
        visible={setupState === "naming"}
        transparent
        animationType="fade"
        onRequestClose={() => setSetupState("idle")}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSetupState("idle")}
          />
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Name This Tag</Text>
            <Text style={styles.modalSubtitle}>
              Give this NFC tag a name to identify it (e.g. "Front Desk", "Gym Door")
            </Text>
            <TextInput
              style={styles.modalInput}
              value={tagName}
              onChangeText={setTagName}
              placeholder="Tag name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoFocus
              maxLength={50}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setSetupState("idle")}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.modalButtonSave,
                  !tagName.trim() && { opacity: 0.5 },
                ]}
                onPress={handleConfirmName}
                disabled={!tagName.trim()}
              >
                <Text style={styles.modalButtonSaveText}>Next</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="white" />
        </Pressable>
        <Text style={styles.title}>NFC Tags</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Writing State */}
      {setupState === "writing" && (
        <View style={styles.writeContainer}>
          <Text style={styles.writeTitle}>Hold Tag Near Device</Text>
          <Text style={styles.writeSubtitle}>
            Place the NFC tag against your phone to write the check-in data
          </Text>
          <View style={styles.scanArea}>
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: opacityAnim,
                },
              ]}
            />
            <View style={styles.scanIcon}>
              <Feather name="smartphone" size={48} color="white" />
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleCancelWrite}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {/* Success State */}
      {setupState === "success" && (
        <View style={styles.writeContainer}>
          <Text style={styles.writeTitle}>Tag Registered!</Text>
          <Text style={styles.writeSubtitle}>
            "{tagName}" is ready for check-ins
          </Text>
          <View style={styles.scanArea}>
            <View style={[styles.scanIcon, styles.scanIconSuccess]}>
              <Feather name="check" size={48} color="white" />
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.doneButton,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setSetupState("idle")}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      )}

      {/* Error State */}
      {setupState === "error" && (
        <View style={styles.writeContainer}>
          <Text style={styles.writeTitle}>Registration Failed</Text>
          <Text style={styles.writeSubtitle}>{errorMessage}</Text>
          <View style={styles.scanArea}>
            <View style={[styles.scanIcon, styles.scanIconError]}>
              <Feather name="alert-triangle" size={48} color="white" />
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setSetupState("idle")}
          >
            <Text style={styles.cancelButtonText}>Back</Text>
          </Pressable>
        </View>
      )}

      {/* Idle State — Tag list */}
      {(setupState === "idle" || setupState === "naming") && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator color="#a855f7" style={{ marginTop: 40 }} />
          ) : tags.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="smartphone" size={32} color="rgba(255,255,255,0.3)" />
              </View>
              <Text style={styles.emptyTitle}>No NFC Tags</Text>
              <Text style={styles.emptySubtitle}>
                Register an NFC tag to enable contactless check-ins for your organization
              </Text>
            </View>
          ) : (
            <View style={styles.tagList}>
              {tags.map((tag: any) => (
                <View key={tag.id} style={styles.tagCard}>
                  <View style={styles.tagInfo}>
                    <View style={styles.tagIconContainer}>
                      <Feather name="smartphone" size={18} color="#a855f7" />
                    </View>
                    <View style={styles.tagDetails}>
                      <Text style={styles.tagName}>{tag.name}</Text>
                      <Text style={styles.tagDate}>
                        Registered {formatDate(tag.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.deactivateButton,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => handleDeactivate(tag.id, tag.name)}
                  >
                    <Feather name="trash-2" size={16} color="#ef4444" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Register button */}
          <Pressable
            style={({ pressed }) => [
              styles.registerButton,
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleStartRegister}
          >
            <Feather name="plus" size={20} color="white" />
            <Text style={styles.registerButtonText}>Register New Tag</Text>
          </Pressable>
        </ScrollView>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 8,
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
    fontSize: 20,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 16,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },

  // Tag list
  tagList: {
    gap: 12,
  },
  tagCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tagInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  tagIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(168,85,247,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  tagDetails: {
    flex: 1,
  },
  tagName: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  tagDate: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    marginTop: 2,
  },
  deactivateButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Register button
  registerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6c5ce7",
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 24,
  },
  registerButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  // Write state
  writeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  writeTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  writeSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
  },
  scanArea: {
    marginTop: 48,
    width: 160,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: "#a855f7",
  },
  scanIcon: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(108,92,231,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(168,85,247,0.4)",
  },
  scanIconSuccess: {
    backgroundColor: "rgba(34,197,94,0.3)",
    borderColor: "rgba(34,197,94,0.5)",
  },
  scanIconError: {
    backgroundColor: "rgba(239,68,68,0.3)",
    borderColor: "rgba(239,68,68,0.5)",
  },
  cancelButton: {
    marginTop: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  cancelButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  doneButton: {
    marginTop: 40,
    backgroundColor: "#6c5ce7",
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 14,
  },
  doneButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#2a2550",
    borderRadius: 16,
    width: "100%",
    maxWidth: 340,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  modalSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 14,
    color: "white",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  modalButtonCancelText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontWeight: "600",
  },
  modalButtonSave: {
    backgroundColor: "#6c5ce7",
  },
  modalButtonSaveText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
});
