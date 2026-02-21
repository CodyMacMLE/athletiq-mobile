import { GET_NOTIFICATION_HISTORY } from "@/lib/graphql/queries";
import { useQuery } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function NotificationBell() {
  const router = useRouter();
  const { data } = useQuery(GET_NOTIFICATION_HISTORY, {
    variables: { limit: 100 },
    pollInterval: 60000,
    fetchPolicy: "cache-and-network",
  });

  const unreadCount = useMemo(
    () => (data?.notificationHistory ?? []).filter((n: { readAt: string | null }) => !n.readAt).length,
    [data]
  );

  return (
    <Pressable
      style={({ pressed }) => [styles.bellBtn, pressed && { opacity: 0.6 }]}
      onPress={() => router.push("/notifications")}
    >
      <Feather
        name="bell"
        size={22}
        color={unreadCount > 0 ? "#a855f7" : "rgba(255,255,255,0.55)"}
      />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    padding: 4,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "white",
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 11,
  },
});
