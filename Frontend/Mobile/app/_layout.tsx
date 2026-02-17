import { ApolloProvider } from "@apollo/client";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { apolloClient } from "@/lib/apollo";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

function RootNavigator() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1a1640" }}>
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="login"
        options={{ animation: "none" }}
      />
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
      <Stack.Screen
        name="nfc-setup"
        options={{
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="request-absence"
        options={{
          animation: "slide_from_bottom",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="help-support"
        options={{
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="invite-guardian"
        options={{
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="accept-invite"
        options={{
          animation: "slide_from_bottom",
          presentation: "fullScreenModal",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ApolloProvider>
  );
}
