import { useAuth } from "@/contexts/AuthContext";
import {
  GET_TEAM_ATTENDANCE_INSIGHTS,
  GET_TEAM_ATTENDANCE_RECORDS,
} from "@/lib/graphql/queries";
import { useQuery } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type TimeRange = "week" | "month" | "all";

const TIME_RANGE_MAP: Record<TimeRange, string> = {
  week: "WEEK",
  month: "MONTH",
  all: "ALL",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ON_TIME: { label: "On Time", color: "#27ae60", bg: "rgba(39,174,96,0.15)" },
  LATE: { label: "Late", color: "#f39c12", bg: "rgba(243,156,18,0.15)" },
  ABSENT: { label: "Absent", color: "#e74c3c", bg: "rgba(231,76,60,0.15)" },
  EXCUSED: { label: "Excused", color: "#a855f7", bg: "rgba(168,85,247,0.15)" },
};

export function AttendanceSubTab() {
  const { selectedOrganization, selectedTeamId } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>("week");

  const apiTimeRange = TIME_RANGE_MAP[timeRange];

  const { data: insightsData, loading: insightsLoading } = useQuery(GET_TEAM_ATTENDANCE_INSIGHTS, {
    variables: {
      organizationId: selectedOrganization?.id,
      teamId: selectedTeamId,
      timeRange: apiTimeRange,
    },
    skip: !selectedOrganization?.id || !selectedTeamId,
  });

  const { data: recordsData, loading: recordsLoading } = useQuery(GET_TEAM_ATTENDANCE_RECORDS, {
    variables: {
      teamId: selectedTeamId,
      limit: 20,
    },
    skip: !selectedTeamId,
  });

  const insights = insightsData?.attendanceInsights;
  const records = recordsData?.teamAttendanceRecords || [];

  const attendancePercent = insights
    ? Math.round(insights.attendanceRate * 100)
    : 0;

  const getPercentColor = (percent: number) => {
    if (percent >= 90) return "#27ae60";
    if (percent >= 75) return "#f39c12";
    return "#e74c3c";
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Time Range Selector */}
      <View style={styles.timeRangeTabs}>
        {(["week", "month", "all"] as TimeRange[]).map((range) => (
          <Pressable
            key={range}
            style={[styles.timeRangeTab, timeRange === range && styles.timeRangeTabActive]}
            onPress={() => setTimeRange(range)}
          >
            <Text style={[styles.timeRangeText, timeRange === range && styles.timeRangeTextActive]}>
              {range === "all" ? "All Time" : range.charAt(0).toUpperCase() + range.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Insights Summary */}
      {insightsLoading ? (
        <View style={[styles.insightsCard, { alignItems: "center", paddingVertical: 40 }]}>
          <ActivityIndicator color="#a855f7" />
        </View>
      ) : insights ? (
        <View style={styles.insightsCard}>
          <View style={styles.insightsHeader}>
            <View style={styles.percentCircle}>
              <Text style={[styles.percentValue, { color: getPercentColor(attendancePercent) }]}>
                {attendancePercent}%
              </Text>
              <Text style={styles.percentLabel}>Rate</Text>
            </View>
            <View style={styles.insightsStats}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Events</Text>
                <Text style={styles.statValue}>{insights.eventCount}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Records</Text>
                <Text style={styles.statValue}>{insights.totalExpected}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statusGrid}>
            {[
              { key: "onTimeCount", ...STATUS_CONFIG.ON_TIME },
              { key: "lateCount", ...STATUS_CONFIG.LATE },
              { key: "absentCount", ...STATUS_CONFIG.ABSENT },
              { key: "excusedCount", ...STATUS_CONFIG.EXCUSED },
            ].map((s) => (
              <View key={s.key} style={[styles.statusCard, { backgroundColor: s.bg }]}>
                <Text style={[styles.statusCount, { color: s.color }]}>
                  {(insights as any)[s.key]}
                </Text>
                <Text style={styles.statusLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Recent Records */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Records</Text>
      </View>

      {recordsLoading ? (
        <View style={[styles.listContainer, { paddingVertical: 40, alignItems: "center" }]}>
          <ActivityIndicator color="#a855f7" />
        </View>
      ) : records.length === 0 ? (
        <View style={[styles.listContainer, { paddingVertical: 40, alignItems: "center" }]}>
          <Feather name="clipboard" size={32} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyText}>No attendance records yet</Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {records.map((record: any, index: number) => {
            const status = STATUS_CONFIG[record.status] || STATUS_CONFIG.ON_TIME;
            return (
              <View
                key={record.id}
                style={[
                  styles.recordItem,
                  index < records.length - 1 && styles.recordItemBorder,
                ]}
              >
                <View style={styles.recordInfo}>
                  <Text style={styles.recordName}>
                    {record.user.firstName} {record.user.lastName}
                  </Text>
                  <Text style={styles.recordMeta}>
                    {record.event.title} {"\u00B7"} {formatDate(record.event.date)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: status.color }]}>
                    {status.label}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },

  // Time Range
  timeRangeTabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 3,
  },
  timeRangeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  timeRangeTabActive: {
    backgroundColor: "#6c5ce7",
  },
  timeRangeText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "500",
  },
  timeRangeTextActive: {
    color: "white",
  },

  // Insights Card
  insightsCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  insightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  percentCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(108,92,231,0.2)",
    borderWidth: 3,
    borderColor: "#6c5ce7",
    justifyContent: "center",
    alignItems: "center",
  },
  percentValue: {
    fontSize: 22,
    fontWeight: "bold",
  },
  percentLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    marginTop: 1,
  },
  insightsStats: {
    flex: 1,
    gap: 8,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },
  statValue: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  statusGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  statusCard: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  statusCount: {
    fontSize: 18,
    fontWeight: "bold",
  },
  statusLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    marginTop: 2,
  },

  // Section
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "600",
  },

  // Records List
  listContainer: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  recordItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  recordItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  recordInfo: {
    flex: 1,
  },
  recordName: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  recordMeta: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  emptyText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    marginTop: 8,
  },
});
