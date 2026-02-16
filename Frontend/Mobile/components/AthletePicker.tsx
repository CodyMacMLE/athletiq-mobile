import { useAuth, type LinkedAthlete } from "@/contexts/AuthContext";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

const AVATAR_SIZE = 28;

export function AthletePicker() {
  const {
    hasGuardianLinks,
    isViewingAsGuardian,
    isPureGuardian,
    selectedAthlete,
    linkedAthletes,
    setSelectedAthlete,
    exitGuardianMode,
  } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);

  if (!hasGuardianLinks) return null;

  const handleSelect = (athlete: LinkedAthlete) => {
    setSelectedAthlete(athlete);
    setModalVisible(false);
  };

  const handleMyView = () => {
    exitGuardianMode();
    setModalVisible(false);
  };

  if (!isViewingAsGuardian) {
    return (
      <Pressable
        style={({ pressed }) => [styles.guardianBanner, pressed && { opacity: 0.8 }]}
        onPress={() => setModalVisible(true)}
      >
        <Feather name="eye" size={14} color="#a855f7" />
        <Text style={styles.guardianBannerText}>View as Guardian</Text>
        <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.4)" />

        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
            <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>View as Guardian</Text>
              <Text style={styles.modalSubtitle}>Select an athlete to view their data</Text>

              {linkedAthletes.map((athlete) => (
                <Pressable
                  key={athlete.id}
                  style={({ pressed }) => [styles.athleteOption, pressed && { opacity: 0.7 }]}
                  onPress={() => handleSelect(athlete)}
                >
                  {athlete.image ? (
                    <Image source={athlete.image} style={styles.athleteAvatar} />
                  ) : (
                    <View style={[styles.athleteAvatar, styles.athleteAvatarFallback]}>
                      <Text style={styles.athleteAvatarText}>
                        {athlete.firstName.charAt(0)}
                        {athlete.lastName.charAt(0)}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.athleteName}>
                    {athlete.firstName} {athlete.lastName}
                  </Text>
                  <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.3)" />
                </Pressable>
              ))}

              <Pressable
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeBtnText}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </Pressable>
    );
  }

  // Guardian mode active — show selected athlete with option to switch
  return (
    <Pressable
      style={({ pressed }) => [styles.activeBanner, pressed && { opacity: 0.8 }]}
      onPress={() => setModalVisible(true)}
    >
      {selectedAthlete?.image ? (
        <Image source={selectedAthlete.image} style={styles.activeAvatar} />
      ) : (
        <View style={[styles.activeAvatar, styles.activeAvatarFallback]}>
          <Text style={styles.activeAvatarText}>
            {selectedAthlete?.firstName.charAt(0)}
            {selectedAthlete?.lastName.charAt(0)}
          </Text>
        </View>
      )}
      <View style={styles.activeInfo}>
        <Text style={styles.activeLabel}>Viewing as Guardian</Text>
        <Text style={styles.activeName}>
          {selectedAthlete?.firstName} {selectedAthlete?.lastName}
        </Text>
      </View>
      <Feather name="chevron-down" size={16} color="rgba(255,255,255,0.5)" />

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Switch View</Text>

            {!isPureGuardian && (
              <Pressable
                style={({ pressed }) => [styles.athleteOption, styles.myViewOption, pressed && { opacity: 0.7 }]}
                onPress={handleMyView}
              >
                <View style={[styles.athleteAvatar, styles.myViewIcon]}>
                  <Feather name="user" size={16} color="#a855f7" />
                </View>
                <Text style={[styles.athleteName, { color: "#a855f7" }]}>My View</Text>
                {!isViewingAsGuardian && (
                  <Feather name="check" size={16} color="#a855f7" />
                )}
              </Pressable>
            )}

            {linkedAthletes.map((athlete) => (
              <Pressable
                key={athlete.id}
                style={({ pressed }) => [
                  styles.athleteOption,
                  pressed && { opacity: 0.7 },
                  selectedAthlete?.id === athlete.id && styles.athleteOptionSelected,
                ]}
                onPress={() => handleSelect(athlete)}
              >
                {athlete.image ? (
                  <Image source={athlete.image} style={styles.athleteAvatar} />
                ) : (
                  <View style={[styles.athleteAvatar, styles.athleteAvatarFallback]}>
                    <Text style={styles.athleteAvatarText}>
                      {athlete.firstName.charAt(0)}
                      {athlete.lastName.charAt(0)}
                    </Text>
                  </View>
                )}
                <Text style={styles.athleteName}>
                  {athlete.firstName} {athlete.lastName}
                </Text>
                {selectedAthlete?.id === athlete.id && (
                  <Feather name="check" size={16} color="#a855f7" />
                )}
              </Pressable>
            ))}

            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Inactive state — "View as Guardian" banner
  guardianBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 4,
    backgroundColor: "rgba(168,85,247,0.12)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
  },
  guardianBannerText: {
    flex: 1,
    color: "#a855f7",
    fontSize: 14,
    fontWeight: "600",
  },

  // Active state — selected athlete banner
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 4,
    backgroundColor: "rgba(168,85,247,0.15)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.25)",
  },
  activeAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
  },
  activeAvatarFallback: {
    backgroundColor: "#241e4a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#463e70",
  },
  activeAvatarText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
  },
  activeInfo: {
    flex: 1,
  },
  activeLabel: {
    color: "#a855f7",
    fontSize: 11,
    fontWeight: "600",
  },
  activeName: {
    color: "white",
    fontSize: 14,
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
    marginBottom: 4,
  },
  modalSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginBottom: 16,
  },
  athleteOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  athleteOptionSelected: {
    backgroundColor: "rgba(168,85,247,0.1)",
  },
  myViewOption: {
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
    borderRadius: 0,
    paddingBottom: 14,
  },
  athleteAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
  },
  athleteAvatarFallback: {
    backgroundColor: "#241e4a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#463e70",
  },
  athleteAvatarText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },
  myViewIcon: {
    backgroundColor: "rgba(168,85,247,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  athleteName: {
    flex: 1,
    color: "white",
    fontSize: 15,
    fontWeight: "500",
  },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  closeBtnText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    fontWeight: "600",
  },
});
