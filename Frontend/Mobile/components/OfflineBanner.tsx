import { Feather } from "@expo/vector-icons";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef, useState } from "react";
import { useOffline } from "@/contexts/OfflineContext";

export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, syncNow } = useOffline();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(false);

  const visible = !isOnline || pendingCount > 0;

  useEffect(() => {
    if (visible && !rendered) setRendered(true);

    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setRendered(false);
    });
  }, [visible]);

  if (!rendered) return null;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-48, 0],
  });

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
      {!isOnline ? (
        <View style={styles.row}>
          <Feather name="wifi-off" size={14} color="rgba(255,255,255,0.9)" />
          <Text style={styles.text}>No internet connection</Text>
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount} pending</Text>
            </View>
          )}
        </View>
      ) : (
        <Pressable style={styles.row} onPress={syncNow} disabled={isSyncing}>
          <Feather
            name={isSyncing ? "loader" : "upload-cloud"}
            size={14}
            color="rgba(255,255,255,0.9)"
          />
          <Text style={styles.text}>
            {isSyncing
              ? "Syncing check-ins..."
              : `${pendingCount} check-in${pendingCount !== 1 ? "s" : ""} pending sync`}
          </Text>
          {!isSyncing && <Text style={styles.tapToSync}>Tap to sync</Text>}
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "rgba(30, 20, 60, 0.95)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(168, 85, 247, 0.3)",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  badge: {
    backgroundColor: "rgba(168, 85, 247, 0.3)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: "#c084fc",
    fontSize: 11,
    fontWeight: "600",
  },
  tapToSync: {
    color: "#a855f7",
    fontSize: 12,
    fontWeight: "600",
  },
});
