import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="checkin"
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="activity"
        options={{
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="checkin-history"
        options={{
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="leaderboard"
        options={{
          animation: "slide_from_right",
        }}
      />
    </Stack>
  );
}
