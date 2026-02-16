import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export function NoOrgScreen({ title }: { title: string }) {
  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Feather name="mail" size={32} color="#a855f7" />
        </View>
        <Text style={styles.heading}>No Organization Yet</Text>
        <Text style={styles.message}>
          Ask your coach or administrator to send you an invite. Once you accept, your dashboard and teams will appear here.
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  header: {
    paddingTop: 80,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: -80,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(168,85,247,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  heading: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  message: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
