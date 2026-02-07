import { ApolloProvider } from "@apollo/client";
import { Stack } from "expo-router";
import { apolloClient } from "@/lib/apollo";
import { AuthProvider } from "@/contexts/AuthContext";

export default function RootLayout() {
  return (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
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
      </AuthProvider>
    </ApolloProvider>
  );
}
