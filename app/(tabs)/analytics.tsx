import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from 'expo-status-bar';
import { Text, View } from "react-native";

export default function Analytics() {
  return (
    <LinearGradient colors={["#302b6f","#4d2a69", "#302b6f"]} style={{ flex: 1 }} locations={[0.1, 0.6, 1]}>
      <StatusBar style="light" />
      <View style={{ flex: 1, paddingTop: 80, justifyContent: "flex-start", alignItems: "center" }}>
        <Text style={{ color: "white", fontSize: 20, fontWeight: "bold" }}>Analytics</Text>
      </View>
    </LinearGradient>
  );
}