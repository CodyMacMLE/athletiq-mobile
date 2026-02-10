import { Feather } from "@expo/vector-icons";
import { useMutation } from "@apollo/client";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NFC_CHECK_IN } from "@/lib/graphql";

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

type ScanState = "scanning" | "success" | "error";
type CheckAction = "CHECKED_IN" | "CHECKED_OUT" | null;

function extractNdefText(tag: any): string | null {
  if (!tag?.ndefMessage?.length || !Ndef) return null;
  for (const record of tag.ndefMessage) {
    if (record.tnf === 1 && record.type?.length === 1 && record.type[0] === 0x54) {
      // TNF_WELL_KNOWN + RTD_TEXT
      const payload = record.payload;
      if (!payload || payload.length < 2) continue;
      const langCodeLen = payload[0] & 0x3f;
      const text = Ndef.text.decodePayload(Uint8Array.from(payload));
      if (text) return text;
      // Fallback manual decode
      const textBytes = payload.slice(1 + langCodeLen);
      return String.fromCharCode(...textBytes);
    }
  }
  return null;
}

export default function CheckIn() {
  const router = useRouter();
  const [scanState, setScanState] = useState<ScanState>("scanning");
  const [nfcSupported, setNfcSupported] = useState(true);
  const [resultMessage, setResultMessage] = useState("");
  const [resultDetails, setResultDetails] = useState("");
  const [checkAction, setCheckAction] = useState<CheckAction>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  const [nfcCheckIn] = useMutation(NFC_CHECK_IN);

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

      // Call the nfcCheckIn mutation
      const { data } = await nfcCheckIn({ variables: { token } });
      const result = data.nfcCheckIn;
      const action = result.action;
      const event = result.event;
      const checkIn = result.checkIn;

      setCheckAction(action);
      setScanState("success");

      if (action === "CHECKED_IN") {
        setResultMessage("Checked In!");
        const statusLabel = checkIn.status === "ON_TIME" ? "On Time" : "Late";
        setResultDetails(`${event.title} \u2022 ${statusLabel}`);
      } else {
        setResultMessage("Checked Out!");
        const hours = checkIn.hoursLogged
          ? `${checkIn.hoursLogged.toFixed(1)}h logged`
          : "";
        setResultDetails(`${event.title}${hours ? ` \u2022 ${hours}` : ""}`);
      }
    } catch (err: any) {
      setScanState("error");
      const message = err?.message || "";
      const gqlError = err?.graphQLErrors?.[0]?.message || message;

      if (gqlError.includes("Unrecognized tag")) {
        setResultMessage("Unrecognized Tag");
        setResultDetails("This tag is not registered with Athletiq");
      } else if (gqlError.includes("Tag deactivated")) {
        setResultMessage("Tag Deactivated");
        setResultDetails("This tag has been deactivated by an admin");
      } else if (gqlError.includes("No events today")) {
        setResultMessage("No Events Today");
        setResultDetails("There are no events scheduled for today");
      } else if (gqlError.includes("Already checked out")) {
        setResultMessage("Already Checked Out");
        setResultDetails("You have already checked in and out of this event");
      } else if (gqlError.includes("not a member")) {
        setResultMessage("Not a Member");
        setResultDetails("You are not a member of this organization");
      } else {
        setResultMessage("Scan Failed");
        setResultDetails("Could not read the NFC tag");
      }
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  }

  const getIconName = (): keyof typeof Feather.glyphMap => {
    if (scanState === "scanning") return "smartphone";
    if (scanState === "error") return "alert-triangle";
    if (checkAction === "CHECKED_OUT") return "log-out";
    return "check";
  };

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.container}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />

      {/* Close button */}
      <Pressable style={styles.closeButton} onPress={() => router.back()}>
        <Feather name="x" size={24} color="white" />
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.title}>
          {scanState === "scanning" && "Ready to Scan"}
          {scanState !== "scanning" && resultMessage}
        </Text>
        <Text style={styles.subtitle}>
          {scanState === "scanning" &&
            (nfcSupported
              ? "Hold your device near the NFC tag"
              : Platform.OS === "ios"
                ? "NFC is not available on this device"
                : "NFC is not supported on this device")}
          {scanState !== "scanning" && resultDetails}
        </Text>

        {/* NFC scan indicator */}
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
          <View
            style={[
              styles.scanIcon,
              scanState === "success" && styles.scanIconSuccess,
              scanState === "error" && styles.scanIconError,
            ]}
          >
            <Feather
              name={getIconName()}
              size={48}
              color="white"
            />
          </View>
        </View>

        {scanState === "error" && (
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && { opacity: 0.8 },
            ]}
            onPress={readTag}
          >
            <Feather name="refresh-cw" size={18} color="white" />
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        )}

        {scanState === "success" && (
          <Pressable
            style={({ pressed }) => [
              styles.doneButton,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        )}
      </View>
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
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
  },
  scanArea: {
    marginTop: 60,
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
