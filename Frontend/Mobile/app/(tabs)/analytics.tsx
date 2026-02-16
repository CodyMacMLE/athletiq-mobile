import { useAuth } from "@/contexts/AuthContext";
import { OrgTeamPicker } from "@/components/OrgTeamPicker";
import { OrgTeamSubtitle } from "@/components/OrgTeamSubtitle";
import { AthletePicker } from "@/components/AthletePicker";
import { AthleteView } from "@/components/team/AthleteView";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

const AVATAR_SIZE = 45;

export default function Analytics() {
  const { user, selectedOrganization, isViewingAsGuardian, selectedAthlete } = useAuth();
  const [pickerVisible, setPickerVisible] = useState(false);

  if (!user || !selectedOrganization) return null;

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />

      <OrgTeamPicker visible={pickerVisible} onClose={() => setPickerVisible(false)} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>
            {isViewingAsGuardian ? `${selectedAthlete?.firstName}'s Analytics` : "Analytics"}
          </Text>
          {!isViewingAsGuardian && (
            <OrgTeamSubtitle onPress={() => setPickerVisible(true)} />
          )}
        </View>

        {user.image ? (
          <Image
            source={user.image}
            style={[styles.avatar, styles.avatarImage]}
          />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.firstName.charAt(0)}
              {user.lastName.charAt(0)}
            </Text>
          </View>
        )}
      </View>

      <AthletePicker />
      <AthleteView />
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
    width: "100%",
    paddingTop: 80,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    gap: 4,
    flex: 1,
  },
  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
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
});
