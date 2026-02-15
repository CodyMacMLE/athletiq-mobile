import { useAuth } from "@/contexts/AuthContext";
import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";

type OrgTeamSubtitleProps = {
  onPress: () => void;
};

export function OrgTeamSubtitle({ onPress }: OrgTeamSubtitleProps) {
  const { selectedOrganization, selectedTeam } = useAuth();

  if (!selectedOrganization) return null;

  const label = selectedTeam
    ? `${selectedOrganization.name} \u203A ${selectedTeam.name}`
    : selectedOrganization.name;

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
      <Feather name="chevron-down" size={16} color="white" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginLeft: -8,
    borderRadius: 8,
  },
  pressed: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  text: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
    flexShrink: 1,
  },
});
