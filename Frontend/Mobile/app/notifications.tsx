import { useAuth } from "@/contexts/AuthContext";
import { NoOrgScreen } from "@/components/NoOrgScreen";
import { GET_NOTIFICATION_HISTORY } from "@/lib/graphql/queries";
import { MARK_NOTIFICATION_READ, MARK_ALL_NOTIFICATIONS_READ } from "@/lib/graphql/mutations";
import { useQuery, useMutation } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
} from "react-native";

const AVATAR_SIZE = 45;

type NotificationDelivery = {
  id: string;
  type: string;
  title: string;
  message: string;
  status: string;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  ANNOUNCEMENT: { icon: "volume-2", color: "#a855f7", label: "Announcement" },
  EVENT_REMINDER: { icon: "clock", color: "#3b82f6", label: "Event Reminder" },
  EXCUSE_STATUS: { icon: "file-text", color: "#f59e0b", label: "Excuse Update" },
  ATTENDANCE_MILESTONE: { icon: "award", color: "#10b981", label: "Milestone" },
  EMAIL_REPORT: { icon: "mail", color: "#6c5ce7", label: "Report" },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(isNaN(Number(dateStr)) ? dateStr : Number(dateStr));
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Notifications() {
  const { user, selectedOrganization } = useAuth();
  const [selectedNotif, setSelectedNotif] = useState<NotificationDelivery | null>(null);

  const { data, loading, refetch } = useQuery(GET_NOTIFICATION_HISTORY, {
    variables: { limit: 100 },
    skip: !user,
    fetchPolicy: "cache-and-network",
  });

  const [markRead] = useMutation(MARK_NOTIFICATION_READ, {
    refetchQueries: ["GetNotificationHistory"],
  });

  const [markAllRead] = useMutation(MARK_ALL_NOTIFICATIONS_READ, {
    refetchQueries: ["GetNotificationHistory"],
  });

  const notifications: NotificationDelivery[] = useMemo(
    () => data?.notificationHistory ?? [],
    [data]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications]
  );

  const handleOpen = async (notif: NotificationDelivery) => {
    setSelectedNotif(notif);
    if (!notif.readAt) {
      try {
        await markRead({ variables: { id: notif.id } });
      } catch {}
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
    } catch {}
  };

  if (!user) return null;
  if (!selectedOrganization) return <NoOrgScreen title="Notifications" />;

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount} unread</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <Pressable
              style={({ pressed }) => [styles.markAllBtn, pressed && { opacity: 0.7 }]}
              onPress={handleMarkAllRead}
            >
              <Text style={styles.markAllBtnText}>Mark all read</Text>
            </Pressable>
          )}
          {user.image ? (
            <Image source={user.image} style={[styles.avatar, styles.avatarImage]} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator color="#a855f7" />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="bell-off" size={40} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              Announcements and updates will appear here
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {notifications.map((notif) => {
              const config = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.ANNOUNCEMENT;
              const isUnread = !notif.readAt;
              return (
                <Pressable
                  key={notif.id}
                  style={({ pressed }) => [
                    styles.card,
                    isUnread && styles.cardUnread,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => handleOpen(notif)}
                >
                  {/* Unread indicator */}
                  {isUnread && <View style={styles.unreadDot} />}

                  {/* Icon */}
                  <View style={[styles.iconContainer, { backgroundColor: `${config.color}22` }]}>
                    <Feather name={config.icon as any} size={18} color={config.color} />
                  </View>

                  {/* Content */}
                  <View style={styles.cardContent}>
                    <View style={styles.cardTopRow}>
                      <View style={[styles.typeBadge, { backgroundColor: `${config.color}22` }]}>
                        <Text style={[styles.typeBadgeText, { color: config.color }]}>
                          {config.label}
                        </Text>
                      </View>
                      <Text style={styles.timeText}>
                        {formatRelativeTime(notif.createdAt)}
                      </Text>
                    </View>
                    <Text
                      style={[styles.cardTitle, isUnread && styles.cardTitleUnread]}
                      numberOfLines={1}
                    >
                      {notif.title}
                    </Text>
                    <Text style={styles.cardMessage} numberOfLines={2}>
                      {notif.message}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={!!selectedNotif}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedNotif(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedNotif(null)}>
          <Pressable style={styles.detailModal} onPress={(e) => e.stopPropagation()}>
            {selectedNotif && (() => {
              const config = TYPE_CONFIG[selectedNotif.type] ?? TYPE_CONFIG.ANNOUNCEMENT;
              return (
                <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                  {/* Modal Header */}
                  <View style={[styles.detailHeader, { backgroundColor: `${config.color}33` }]}>
                    <Feather name={config.icon as any} size={22} color={config.color} />
                    <Text style={[styles.detailHeaderLabel, { color: config.color }]}>
                      {config.label}
                    </Text>
                  </View>

                  <View style={styles.detailContent}>
                    <Text style={styles.detailTitle}>{selectedNotif.title}</Text>
                    <Text style={styles.detailTime}>
                      {formatRelativeTime(selectedNotif.createdAt)}
                    </Text>
                    <View style={styles.detailDivider} />
                    <Text style={styles.detailMessage}>{selectedNotif.message}</Text>

                    <Pressable
                      style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
                      onPress={() => setSelectedNotif(null)}
                    >
                      <Text style={styles.closeBtnText}>Close</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: "column",
    gap: 4,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },
  headerBadge: {
    backgroundColor: "rgba(168,85,247,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  headerBadgeText: {
    color: "#a855f7",
    fontSize: 12,
    fontWeight: "600",
  },
  markAllBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  markAllBtnText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: "500",
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "#241e4a",
    borderWidth: 0.5,
    borderColor: "#463e70",
  },
  avatarImage: {
    backgroundColor: "transparent",
  },
  avatarText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    fontWeight: "600",
  },
  emptySubtitle: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 12,
    position: "relative",
  },
  cardUnread: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: "rgba(168,85,247,0.25)",
  },
  unreadDot: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#a855f7",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  timeText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    marginRight: 16,
  },
  cardTitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "500",
  },
  cardTitleUnread: {
    color: "white",
    fontWeight: "700",
  },
  cardMessage: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    lineHeight: 18,
  },

  // Detail Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  detailModal: {
    backgroundColor: "#2a2550",
    borderRadius: 16,
    width: "100%",
    maxWidth: 360,
    maxHeight: "80%",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  detailHeaderLabel: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailContent: {
    padding: 20,
  },
  detailTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  detailTime: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    marginBottom: 16,
  },
  detailDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 16,
  },
  detailMessage: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  closeBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  closeBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontWeight: "600",
  },
});
