import { useAuth } from "@/contexts/AuthContext";
import type { TeamInfo } from "@/contexts/AuthContext";
import { Feather } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type OrgTeamPickerProps = {
  visible: boolean;
  onClose: () => void;
};

export function OrgTeamPicker({ visible, onClose }: OrgTeamPickerProps) {
  const {
    organizations,
    selectedOrganization,
    setSelectedOrganization,
    teamsForCurrentOrg,
    selectedTeam,
    setSelectedTeam,
  } = useAuth();

  const hasMultipleOrgs = organizations.length > 1;
  const [step, setStep] = useState<"org" | "team">(hasMultipleOrgs ? "org" : "team");

  // Reset step when modal opens
  useEffect(() => {
    if (visible) {
      setStep(hasMultipleOrgs ? "org" : "team");
    }
  }, [visible, hasMultipleOrgs]);

  const handleOrgSelect = (org: typeof organizations[0]) => {
    setSelectedOrganization(org);
    setStep("team");
  };

  const handleTeamSelect = (team: TeamInfo) => {
    setSelectedTeam(team);
    onClose();
  };

  const getRoleBadgeStyle = (role: string) => {
    if (role === "COACH" || role === "ADMIN") {
      return { bg: "rgba(168,85,247,0.15)", text: "#a855f7" };
    }
    return { bg: "rgba(255,255,255,0.1)", text: "rgba(255,255,255,0.6)" };
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "COACH": return "Coach";
      case "ADMIN": return "Admin";
      case "CAPTAIN": return "Captain";
      default: return "Athlete";
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          {step === "org" ? (
            <>
              <Text style={styles.title}>Select Organization</Text>
              {organizations.map((org) => {
                const isSelected = selectedOrganization?.id === org.id;
                return (
                  <Pressable
                    key={org.id}
                    style={({ pressed }) => [
                      styles.item,
                      pressed && styles.itemPressed,
                      isSelected && styles.itemSelected,
                    ]}
                    onPress={() => handleOrgSelect(org)}
                  >
                    <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                      {org.name}
                    </Text>
                    {isSelected && <Feather name="chevron-right" size={18} color="#a855f7" />}
                  </Pressable>
                );
              })}
            </>
          ) : (
            <>
              <View style={styles.titleRow}>
                {hasMultipleOrgs && (
                  <Pressable onPress={() => setStep("org")} style={styles.backButton}>
                    <Feather name="arrow-left" size={18} color="rgba(255,255,255,0.6)" />
                  </Pressable>
                )}
                <View>
                  <Text style={styles.title}>Select Team</Text>
                  {selectedOrganization && (
                    <Text style={styles.orgLabel}>{selectedOrganization.name}</Text>
                  )}
                </View>
              </View>
              {teamsForCurrentOrg.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No teams in this organization</Text>
                </View>
              ) : (
                teamsForCurrentOrg.map((team) => {
                  const isSelected = selectedTeam?.id === team.id;
                  const badge = getRoleBadgeStyle(team.role);
                  return (
                    <Pressable
                      key={team.id}
                      style={({ pressed }) => [
                        styles.item,
                        pressed && styles.itemPressed,
                        isSelected && styles.itemSelected,
                      ]}
                      onPress={() => handleTeamSelect(team)}
                    >
                      <View style={styles.teamItemContent}>
                        <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                          {team.name}
                        </Text>
                        <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.roleBadgeText, { color: badge.text }]}>
                            {getRoleLabel(team.role)}
                          </Text>
                        </View>
                      </View>
                      {isSelected && <Feather name="check" size={18} color="#a855f7" />}
                    </Pressable>
                  );
                })
              )}
            </>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "#2a2550",
    borderRadius: 16,
    width: "100%",
    maxWidth: 320,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backButton: {
    padding: 4,
  },
  title: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  orgLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  itemPressed: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  itemSelected: {
    backgroundColor: "rgba(168,85,247,0.15)",
  },
  itemText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  itemTextSelected: {
    color: "#a855f7",
  },
  teamItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
});
