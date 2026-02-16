import { useAuth } from "@/contexts/AuthContext";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "@apollo/client";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NFC_CHECK_IN, AD_HOC_NFC_CHECK_IN } from "@/lib/graphql";
import DateTimePicker from "@react-native-community/datetimepicker";

let NfcManager: any = null;
let NfcTech: any = null;
let Ndef: any = null;
try {
  const nfc = require("react-native-nfc-manager");
  NfcManager = nfc.default;
  NfcTech = nfc.NfcTech;
  Ndef = nfc.Ndef;
} catch {
  // Native module not available (e.g. running in Expo Go)
}

type ScanState = "scanning" | "success" | "error" | "tooEarly" | "noEvent" | "adHocSuccess";
type CheckAction = "CHECKED_IN" | "CHECKED_OUT" | null;

function extractNdefText(tag: any): string | null {
  if (!tag?.ndefMessage?.length || !Ndef) return null;
  for (const record of tag.ndefMessage) {
    if (record.tnf === 1 && record.type?.length === 1 && record.type[0] === 0x54) {
      const payload = record.payload;
      if (!payload || payload.length < 2) continue;
      const langCodeLen = payload[0] & 0x3f;
      const text = Ndef.text.decodePayload(Uint8Array.from(payload));
      if (text) return text;
      const textBytes = payload.slice(1 + langCodeLen);
      return String.fromCharCode(...textBytes);
    }
  }
  return null;
}

export default function CheckIn() {
  const router = useRouter();
  const { user, selectedOrganization, isViewingAsGuardian, selectedAthlete, targetUserId } = useAuth();
  const [scanState, setScanState] = useState<ScanState>("scanning");
  const [nfcSupported, setNfcSupported] = useState(true);
  const [resultMessage, setResultMessage] = useState("");
  const [resultDetails, setResultDetails] = useState("");
  const [checkAction, setCheckAction] = useState<CheckAction>(null);
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  // Too early state
  const [earlyEventTitle, setEarlyEventTitle] = useState("");
  const [earlyEventTime, setEarlyEventTime] = useState("");

  // Ad-hoc state
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [adHocStartTime, setAdHocStartTime] = useState<Date>(new Date());
  const [adHocEndTime, setAdHocEndTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    return d;
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [adHocNote, setAdHocNote] = useState("");
  const [adHocSubmitting, setAdHocSubmitting] = useState(false);

  const [nfcCheckIn] = useMutation(NFC_CHECK_IN, {
    refetchQueries: ["GetActiveCheckIn"],
  });
  const [adHocNfcCheckIn] = useMutation(AD_HOC_NFC_CHECK_IN);

  // Get user's teams in selected org (only teams where user is an athlete, not a coach)
  const userTeams = user?.memberships?.filter(
    (m) => m.team.organization.id === selectedOrganization?.id && ["MEMBER", "CAPTAIN"].includes(m.role)
  ) || [];

  useEffect(() => {
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
    return () => pulse.stop();
  }, [pulseAnim, opacityAnim]);

  useEffect(() => {
    if (!NfcManager) {
      setNfcSupported(false);
      return;
    }

    async function initNfc() {
      const supported = await NfcManager.isSupported();
      setNfcSupported(supported);
      if (!supported) return;

      await NfcManager.start();
      readTag();
    }

    initNfc();

    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, []);

  async function readTag() {
    if (!NfcManager) {
      setScanState("error");
      setResultMessage("Scan Failed");
      setResultDetails("NFC is not available");
      return;
    }
    setScanState("scanning");
    setCheckAction(null);
    setScannedToken(null);
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();

      if (!tag) {
        setScanState("error");
        setResultMessage("Scan Failed");
        setResultDetails("Could not read the NFC tag");
        return;
      }

      const token = extractNdefText(tag);
      if (!token) {
        setScanState("error");
        setResultMessage("Unrecognized Tag");
        setResultDetails("This tag is not registered with Athletiq");
        return;
      }

      setScannedToken(token);

      const { data } = await nfcCheckIn({
        variables: {
          token,
          forUserId: isViewingAsGuardian ? selectedAthlete?.id : undefined,
        },
      });
      const result = data.nfcCheckIn;
      const action = result.action;
      const event = result.event;
      const checkInRecord = result.checkIn;

      setCheckAction(action);
      setScanState("success");

      if (action === "CHECKED_IN") {
        setResultMessage("Checked In!");
        const statusLabel = checkInRecord.status === "ON_TIME" ? "On Time" : "Late";
        setResultDetails(`${event.title} \u2022 ${statusLabel}`);
      } else {
        setResultMessage("Checked Out!");
        const hours = checkInRecord.hoursLogged
          ? `${checkInRecord.hoursLogged.toFixed(1)}h logged`
          : "";
        setResultDetails(`${event.title}${hours ? ` \u2022 ${hours}` : ""}`);
      }
    } catch (err: any) {
      const message = err?.message || "";
      const gqlError = err?.graphQLErrors?.[0]?.message || message;

      if (gqlError.startsWith("TOO_EARLY:")) {
        const parts = gqlError.split(":");
        setEarlyEventTitle(parts[1] || "Event");
        setEarlyEventTime(parts[2] || "");
        setScanState("tooEarly");
      } else if (gqlError.includes("No events today")) {
        setScanState("noEvent");
        if (userTeams.length === 1) {
          setSelectedTeamId(userTeams[0].team.id);
        }
      } else if (gqlError.includes("Unrecognized tag")) {
        setScanState("error");
        setResultMessage("Unrecognized Tag");
        setResultDetails("This tag is not registered with Athletiq");
      } else if (gqlError.includes("Tag deactivated")) {
        setScanState("error");
        setResultMessage("Tag Deactivated");
        setResultDetails("This tag has been deactivated by an admin");
      } else if (gqlError.includes("Already checked out")) {
        setScanState("error");
        setResultMessage("Already Checked Out");
        setResultDetails("You have already checked in and out of this event");
      } else if (gqlError.includes("not a member")) {
        setScanState("error");
        setResultMessage("Not a Member");
        setResultDetails("You are not a member of this organization");
      } else {
        setScanState("error");
        setResultMessage("Scan Failed");
        setResultDetails("Could not process check-in");
      }
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  }

  function formatTimeForApi(date: Date): string {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function formatTimeDisplay(date: Date): string {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  async function submitAdHocCheckIn() {
    if (!scannedToken || !selectedTeamId) return;
    setAdHocSubmitting(true);
    try {
      await adHocNfcCheckIn({
        variables: {
          input: {
            token: scannedToken,
            teamId: selectedTeamId,
            startTime: formatTimeForApi(adHocStartTime),
            endTime: formatTimeForApi(adHocEndTime),
            note: adHocNote.trim() || null,
          },
        },
      });
      setScanState("adHocSuccess");
    } catch (err: any) {
      setScanState("error");
      setResultMessage("Submission Failed");
      setResultDetails(err?.graphQLErrors?.[0]?.message || "Could not submit ad-hoc check-in");
    } finally {
      setAdHocSubmitting(false);
    }
  }

  const getIconName = (): keyof typeof Feather.glyphMap => {
    if (scanState === "scanning") return "smartphone";
    if (scanState === "error") return "alert-triangle";
    if (scanState === "tooEarly") return "clock";
    if (scanState === "noEvent") return "edit-3";
    if (scanState === "adHocSuccess") return "send";
    if (checkAction === "CHECKED_OUT") return "log-out";
    return "check";
  };

  const getIconStyle = () => {
    if (scanState === "success") return styles.scanIconSuccess;
    if (scanState === "error") return styles.scanIconError;
    if (scanState === "tooEarly") return styles.scanIconWarning;
    if (scanState === "adHocSuccess") return styles.scanIconPending;
    if (scanState === "noEvent") return styles.scanIconDefault;
    return undefined;
  };

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.container}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />

      <Pressable style={styles.closeButton} onPress={() => router.back()}>
        <Feather name="x" size={24} color="white" />
      </Pressable>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Scanning State */}
        {scanState === "scanning" && (
          <>
            <Text style={styles.title}>
              {isViewingAsGuardian
                ? `Checking in ${selectedAthlete?.firstName}`
                : "Ready to Scan"}
            </Text>
            <Text style={styles.subtitle}>
              {nfcSupported
                ? "Hold your device near the NFC tag"
                : Platform.OS === "ios"
                  ? "NFC is not available on this device"
                  : "NFC is not supported on this device"}
            </Text>
          </>
        )}

        {/* Success State */}
        {scanState === "success" && (
          <>
            <Text style={styles.title}>{resultMessage}</Text>
            <Text style={styles.subtitle}>{resultDetails}</Text>
          </>
        )}

        {/* Error State */}
        {scanState === "error" && (
          <>
            <Text style={styles.title}>{resultMessage}</Text>
            <Text style={styles.subtitle}>{resultDetails}</Text>
          </>
        )}

        {/* Too Early State */}
        {scanState === "tooEarly" && (
          <>
            <Text style={styles.title}>Too Early</Text>
            <Text style={styles.subtitle}>
              Check-in for{" "}
              <Text style={{ color: "#a78bfa", fontWeight: "600" }}>{earlyEventTitle}</Text>
              {" "}opens 30 minutes before the event
            </Text>
            <View style={styles.earlyCard}>
              <Feather name="calendar" size={18} color="#a78bfa" />
              <Text style={styles.earlyCardText}>
                {earlyEventTitle} at {earlyEventTime}
              </Text>
            </View>
          </>
        )}

        {/* No Event - Ad-Hoc Form */}
        {scanState === "noEvent" && (
          <>
            <Text style={styles.title}>No Events Today</Text>
            <Text style={styles.subtitle}>
              Submit an ad-hoc check-in for coach approval
            </Text>
          </>
        )}

        {/* Ad-Hoc Success */}
        {scanState === "adHocSuccess" && (
          <>
            <Text style={styles.title}>Submitted</Text>
            <Text style={styles.subtitle}>
              Your check-in has been submitted and is pending approval from a coach or admin
            </Text>
          </>
        )}

        {/* Scan Indicator (shown for scanning, success, error, tooEarly, adHocSuccess) */}
        {scanState !== "noEvent" && (
          <View style={styles.scanArea}>
            {scanState === "scanning" && (
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: pulseAnim }],
                    opacity: opacityAnim,
                  },
                ]}
              />
            )}
            <View style={[styles.scanIcon, getIconStyle()]}>
              <Feather name={getIconName()} size={48} color="white" />
            </View>
          </View>
        )}

        {/* Ad-Hoc Form (no event state) */}
        {scanState === "noEvent" && (
          <View style={styles.adHocForm}>
            <Text style={styles.formLabel}>Select Team</Text>
            <View style={styles.teamPicker}>
              {userTeams.map((m) => (
                <Pressable
                  key={m.team.id}
                  style={[
                    styles.teamOption,
                    selectedTeamId === m.team.id && styles.teamOptionSelected,
                  ]}
                  onPress={() => setSelectedTeamId(m.team.id)}
                >
                  <Text
                    style={[
                      styles.teamOptionText,
                      selectedTeamId === m.team.id && styles.teamOptionTextSelected,
                    ]}
                  >
                    {m.team.name}
                  </Text>
                  {selectedTeamId === m.team.id && (
                    <Feather name="check" size={16} color="#a855f7" />
                  )}
                </Pressable>
              ))}
            </View>

            <Text style={[styles.formLabel, { marginTop: 20 }]}>Time</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Text style={styles.timeLabel}>Start</Text>
                <Pressable
                  style={[styles.timeButton, showStartPicker && styles.timeButtonActive]}
                  onPress={() => { setShowStartPicker(!showStartPicker); setShowEndPicker(false); }}
                >
                  <Feather name="clock" size={16} color="#a855f7" />
                  <Text style={styles.timeButtonText}>{formatTimeDisplay(adHocStartTime)}</Text>
                </Pressable>
              </View>
              <View style={styles.timeField}>
                <Text style={styles.timeLabel}>End</Text>
                <Pressable
                  style={[styles.timeButton, showEndPicker && styles.timeButtonActive]}
                  onPress={() => { setShowEndPicker(!showEndPicker); setShowStartPicker(false); }}
                >
                  <Feather name="clock" size={16} color="#a855f7" />
                  <Text style={styles.timeButtonText}>{formatTimeDisplay(adHocEndTime)}</Text>
                </Pressable>
              </View>
            </View>
            {showStartPicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={adHocStartTime}
                  mode="time"
                  display="spinner"
                  minuteInterval={5}
                  themeVariant="dark"
                  onChange={(_, date) => {
                    if (date) {
                      setAdHocStartTime(date);
                      if (date >= adHocEndTime) {
                        const newEnd = new Date(date);
                        newEnd.setHours(newEnd.getHours() + 1);
                        setAdHocEndTime(newEnd);
                      }
                    }
                  }}
                />
              </View>
            )}
            {showEndPicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={adHocEndTime}
                  mode="time"
                  display="spinner"
                  minuteInterval={5}
                  themeVariant="dark"
                  onChange={(_, date) => {
                    if (date) setAdHocEndTime(date);
                  }}
                />
              </View>
            )}

            <Text style={[styles.formLabel, { marginTop: 20 }]}>
              Reason <Text style={{ color: "rgba(255,255,255,0.3)" }}>(optional)</Text>
            </Text>
            <TextInput
              style={styles.noteInput}
              placeholder="e.g. Makeup practice"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={adHocNote}
              onChangeText={setAdHocNote}
              multiline
              maxLength={200}
            />

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                (!selectedTeamId || adHocSubmitting) && styles.submitButtonDisabled,
                pressed && { opacity: 0.8 },
              ]}
              onPress={submitAdHocCheckIn}
              disabled={!selectedTeamId || adHocSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {adHocSubmitting ? "Submitting..." : "Submit Check-In"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Action Buttons */}
        {scanState === "error" && (
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.8 }]}
            onPress={readTag}
          >
            <Feather name="refresh-cw" size={18} color="white" />
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        )}

        {scanState === "tooEarly" && (
          <Pressable
            style={({ pressed }) => [styles.doneButton, pressed && { opacity: 0.8 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.doneText}>Got It</Text>
          </Pressable>
        )}

        {(scanState === "success" || scanState === "adHocSuccess") && (
          <Pressable
            style={({ pressed }) => [styles.doneButton, pressed && { opacity: 0.8 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
    paddingTop: 100,
    paddingBottom: 40,
  },
  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
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
  scanIconWarning: {
    backgroundColor: "rgba(245,158,11,0.3)",
    borderColor: "rgba(245,158,11,0.5)",
  },
  scanIconPending: {
    backgroundColor: "rgba(168,85,247,0.3)",
    borderColor: "rgba(168,85,247,0.5)",
  },
  scanIconDefault: {
    backgroundColor: "rgba(108,92,231,0.3)",
    borderColor: "rgba(108,92,231,0.4)",
  },

  // Too early card
  earlyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 20,
    backgroundColor: "rgba(167,139,250,0.15)",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.2)",
  },
  earlyCardText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    fontWeight: "500",
  },

  // Ad-hoc form
  adHocForm: {
    width: "100%",
    marginTop: 32,
  },
  formLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  teamPicker: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  teamOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  teamOptionSelected: {
    backgroundColor: "rgba(168,85,247,0.12)",
  },
  teamOptionText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    fontWeight: "500",
  },
  teamOptionTextSelected: {
    color: "#a855f7",
  },
  timeRow: {
    flexDirection: "row",
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  timeLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 6,
    marginLeft: 4,
  },
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  timeButtonActive: {
    borderColor: "rgba(168,85,247,0.4)",
  },
  timeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  pickerContainer: {
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    overflow: "hidden",
  },
  noteInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    color: "white",
    fontSize: 15,
    paddingHorizontal: 18,
    paddingVertical: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitButton: {
    marginTop: 24,
    backgroundColor: "#6c5ce7",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  // Action buttons
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryText: {
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
  doneText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
