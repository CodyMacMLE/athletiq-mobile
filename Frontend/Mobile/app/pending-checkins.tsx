import { useAuth } from "@/contexts/AuthContext";
import {
  GET_PENDING_AD_HOC_CHECK_INS,
  APPROVE_AD_HOC_CHECK_IN,
  DENY_AD_HOC_CHECK_IN,
} from "@/lib/graphql";
import { useQuery, useMutation } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type PendingCheckIn = {
  id: string;
  status: string;
  checkInTime: string;
  note: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    image?: string;
  };
  event: {
    id: string;
    title: string;
    type: string;
    date: string;
    team: { id: string; name: string } | null;
  };
};

export default function PendingCheckIns() {
  const router = useRouter();
  const { selectedOrganization } = useAuth();

  const { data, loading, refetch } = useQuery(GET_PENDING_AD_HOC_CHECK_INS, {
    variables: { organizationId: selectedOrganization?.id },
    skip: !selectedOrganization?.id,
  });

  const [approveCheckIn] = useMutation(APPROVE_AD_HOC_CHECK_IN);
  const [denyCheckIn] = useMutation(DENY_AD_HOC_CHECK_IN);

  const pendingList: PendingCheckIn[] = data?.pendingAdHocCheckIns || [];

  async function handleApprove(checkInId: string) {
    try {
      await approveCheckIn({ variables: { checkInId } });
      refetch();
    } catch (err: any) {
      Alert.alert("Error", err?.graphQLErrors?.[0]?.message || "Could not approve check-in");
    }
  }

  function handleDeny(checkInId: string, userName: string) {
    Alert.alert(
      "Deny Check-In",
      `Are you sure you want to deny ${userName}'s ad-hoc check-in? This will remove the record.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deny",
          style: "destructive",
          onPress: async () => {
            try {
              await denyCheckIn({ variables: { checkInId } });
              refetch();
            } catch (err: any) {
              Alert.alert("Error", err?.graphQLErrors?.[0]?.message || "Could not deny check-in");
            }
          },
        },
      ]
    );
  }

  function parseDate(value: string): Date {
    const num = Number(value);
    return isNaN(num) ? new Date(value) : new Date(num);
  }

  function formatDate(value: string) {
    const date = parseDate(value);
    const now = new Date();
    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((today.getTime() - dateDay.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatTime(value: string) {
    return parseDate(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.container}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="white" />
        </Pressable>
        <Text style={styles.title}>Pending Check-Ins</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#a855f7" size="large" />
        </View>
      ) : pendingList.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="check-circle" size={40} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyText}>No pending check-ins</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.countText}>
            {pendingList.length} pending approval{pendingList.length !== 1 ? "s" : ""}
          </Text>

          {pendingList.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.user.firstName.charAt(0)}
                      {item.user.lastName.charAt(0)}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.userName}>
                      {item.user.firstName} {item.user.lastName}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {item.event.team?.name || "No team"} {"\u2022"}{" "}
                      {formatDate(item.createdAt)} at {formatTime(item.checkInTime)}
                    </Text>
                  </View>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Ad-Hoc</Text>
                </View>
              </View>

              {item.note && (
                <View style={styles.noteRow}>
                  <Feather name="message-circle" size={14} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.noteText}>{item.note}</Text>
                </View>
              )}

              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.denyButton,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() =>
                    handleDeny(item.id, `${item.user.firstName} ${item.user.lastName}`)
                  }
                >
                  <Feather name="x" size={16} color="#ef4444" />
                  <Text style={styles.denyText}>Deny</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.approveButton,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => handleApprove(item.id)}
                >
                  <Feather name="check" size={16} color="white" />
                  <Text style={styles.approveText}>Approve</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
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
    fontSize: 18,
    fontWeight: "bold",
  },
  placeholder: {
    width: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 16,
    marginTop: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  countText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(168,85,247,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#a855f7",
    fontSize: 14,
    fontWeight: "600",
  },
  userName: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  cardMeta: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    marginTop: 2,
  },
  badge: {
    backgroundColor: "rgba(245,158,11,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "600",
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  noteText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  denyButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.15)",
  },
  denyText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "600",
  },
  approveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#6c5ce7",
  },
  approveText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});
