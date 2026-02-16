import { useMutation } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ACCEPT_INVITE } from "@/lib/graphql/mutations";
import { GET_ME, GET_MY_ORGANIZATIONS } from "@/lib/graphql/queries";
import { useAuth } from "@/contexts/AuthContext";

export default function AcceptInvite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [orgName, setOrgName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [acceptInvite] = useMutation(ACCEPT_INVITE, {
    refetchQueries: [{ query: GET_ME }, { query: GET_MY_ORGANIZATIONS }],
  });

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid invite link — no token provided.");
      return;
    }

    if (!user) {
      setStatus("error");
      setErrorMessage("Please log in first, then open the invite link again.");
      return;
    }

    acceptInvite({ variables: { token } })
      .then(({ data }) => {
        setOrgName(data?.acceptInvite?.organization?.name || "the organization");
        setStatus("success");
      })
      .catch((err) => {
        const msg = err?.message || "Something went wrong.";
        setErrorMessage(msg);
        setStatus("error");
      });
  }, [token, user]);

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <View style={styles.container}>
        {status === "loading" && (
          <>
            <ActivityIndicator size="large" color="#a855f7" />
            <Text style={styles.message}>Accepting invite...</Text>
          </>
        )}

        {status === "success" && (
          <>
            <View style={styles.iconCircle}>
              <Feather name="check" size={40} color="#22c55e" />
            </View>
            <Text style={styles.heading}>You're in!</Text>
            <Text style={styles.message}>
              You've joined {orgName}.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={() => router.replace("/")}
            >
              <LinearGradient
                colors={["#6c5ce7", "#a855f7"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Go to Dashboard</Text>
              </LinearGradient>
            </Pressable>
          </>
        )}

        {status === "error" && (
          <>
            <View style={[styles.iconCircle, styles.errorCircle]}>
              <Feather name="x" size={40} color="#ef4444" />
            </View>
            <Text style={styles.heading}>Invite Failed</Text>
            <Text style={styles.message}>{errorMessage}</Text>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={() => router.replace("/")}
            >
              <LinearGradient
                colors={["#6c5ce7", "#a855f7"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Go to Dashboard</Text>
              </LinearGradient>
            </Pressable>
          </>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(34,197,94,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  errorCircle: {
    backgroundColor: "rgba(239,68,68,0.15)",
  },
  heading: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },
  button: {
    marginTop: 32,
    borderRadius: 14,
    overflow: "hidden",
    width: "100%",
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 17,
    fontWeight: "bold",
  },
});
