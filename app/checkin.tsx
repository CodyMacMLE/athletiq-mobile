import { Feather } from "@expo/vector-icons";
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
let NfcManager: any = null;
let NfcTech: any = null;
try {
  const nfc = require("react-native-nfc-manager");
  NfcManager = nfc.default;
  NfcTech = nfc.NfcTech;
} catch {
  // Native module not available (e.g. running in Expo Go)
}

type ScanState = "scanning" | "success" | "error";

export default function CheckIn() {
  const router = useRouter();
  const [scanState, setScanState] = useState<ScanState>("scanning");
  const [nfcSupported, setNfcSupported] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

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
      return;
    }
    setScanState("scanning");
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      if (tag) {
        setScanState("success");
      }
    } catch {
      setScanState("error");
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  }

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
          {scanState === "success" && "Checked In!"}
          {scanState === "error" && "Scan Failed"}
        </Text>
        <Text style={styles.subtitle}>
          {scanState === "scanning" &&
            (nfcSupported
              ? "Hold your device near the NFC tag"
              : Platform.OS === "ios"
                ? "NFC is not available on this device"
                : "NFC is not supported on this device")}
          {scanState === "success" && "Your attendance has been recorded"}
          {scanState === "error" && "Could not read the NFC tag"}
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
              name={
                scanState === "scanning"
                  ? "smartphone"
                  : scanState === "success"
                    ? "check"
                    : "alert-triangle"
              }
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
