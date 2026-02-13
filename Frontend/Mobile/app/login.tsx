import { useAuth } from "@/contexts/AuthContext";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function Login() {
  const { login, confirmNewPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // New password flow
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await login(email.trim(), password);

      if (result.requiresNewPassword) {
        setNeedsNewPassword(true);
        setLoading(false);
        return;
      }

      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async () => {
    if (!newPassword.trim()) {
      setError("Please enter a new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await confirmNewPassword(newPassword);
      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (needsNewPassword) {
    return (
      <LinearGradient
        colors={["#302b6f", "#4d2a69", "#302b6f"]}
        style={styles.gradient}
        locations={[0.1, 0.6, 1]}
      >
        <StatusBar style="light" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Branding */}
            <View style={styles.branding}>
              <Image source={require("@/assets/logo/white_icon_transparent_background.png")} style={styles.logoImage} resizeMode="contain" />
            </View>

            <Text style={styles.heading}>Set New Password</Text>
            <Text style={styles.subheading}>
              You need to set a new password before continuing.
            </Text>

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color="#e74c3c" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* New Password */}
            <View style={styles.inputContainer}>
              <Feather name="lock" size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor="rgba(255,255,255,0.3)"
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              />
              <Pressable onPress={() => setShowNewPassword(!showNewPassword)} hitSlop={8}>
                <Feather
                  name={showNewPassword ? "eye-off" : "eye"}
                  size={18}
                  color="rgba(255,255,255,0.4)"
                />
              </Pressable>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <Feather name="lock" size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
              <TextInput
                ref={confirmPasswordRef}
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="rgba(255,255,255,0.3)"
                secureTextEntry={!showNewPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={handleSetNewPassword}
              />
            </View>

            {/* Submit */}
            <Pressable
              style={({ pressed }) => [
                styles.signInButton,
                pressed && styles.signInButtonPressed,
                loading && styles.signInButtonDisabled,
              ]}
              onPress={handleSetNewPassword}
              disabled={loading}
            >
              <LinearGradient
                colors={["#6c5ce7", "#a855f7"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.signInGradient}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.signInText}>Set Password</Text>
                )}
              </LinearGradient>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Branding */}
          <View style={styles.branding}>
            <View style={styles.iconContainer}>
              <Feather name="activity" size={40} color="#a855f7" />
            </View>
            <Text style={styles.appName}>Athletiq</Text>
          </View>

          <Text style={styles.heading}>Welcome Back</Text>
          <Text style={styles.subheading}>Sign in to your account</Text>

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={16} color="#e74c3c" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={styles.inputContainer}>
            <Feather name="mail" size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          {/* Password */}
          <View style={styles.inputContainer}>
            <Feather name="lock" size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.3)"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={handleSignIn}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
              <Feather
                name={showPassword ? "eye-off" : "eye"}
                size={18}
                color="rgba(255,255,255,0.4)"
              />
            </Pressable>
          </View>

          {/* Sign In Button */}
          <Pressable
            style={({ pressed }) => [
              styles.signInButton,
              pressed && styles.signInButtonPressed,
              loading && styles.signInButtonDisabled,
            ]}
            onPress={handleSignIn}
            disabled={loading}
          >
            <LinearGradient
              colors={["#6c5ce7", "#a855f7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.signInGradient}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.signInText}>Sign In</Text>
              )}
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  branding: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoImage: {
    width: 160,
    height: 160,
  },
  heading: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subheading: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 32,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(231,76,60,0.15)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(231,76,60,0.3)",
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 14,
    flex: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: "white",
    fontSize: 16,
    paddingVertical: 16,
  },
  signInButton: {
    marginTop: 8,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  signInButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  signInText: {
    color: "white",
    fontSize: 17,
    fontWeight: "bold",
  },
});
