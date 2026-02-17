import { cognitoResetPassword, cognitoConfirmResetPassword } from "@/lib/cognito";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
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

export default function ForgotPassword() {
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const codeRef = useRef<TextInput>(null);
  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await cognitoResetPassword(email.trim());
      if (result.success) {
        setStep("reset");
      } else {
        setError(result.error || "Failed to send reset code.");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetCode.trim()) {
      setError("Please enter the reset code.");
      return;
    }
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
      const result = await cognitoConfirmResetPassword(email.trim(), resetCode.trim(), newPassword);
      if (result.success) {
        router.replace("/login");
      } else {
        setError(result.error || "Failed to reset password.");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "reset") {
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
            <View style={styles.branding}>
              <Image source={require("@/assets/logo/white_icon_transparent_background.png")} style={styles.logoImage} resizeMode="contain" />
            </View>

            <Text style={styles.heading}>Reset Password</Text>
            <Text style={styles.subheading}>
              Enter the code sent to your email and your new password.
            </Text>

            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color="#e74c3c" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Reset Code */}
            <View style={styles.inputContainer}>
              <Feather name="hash" size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
              <TextInput
                ref={codeRef}
                style={styles.input}
                placeholder="6-digit code"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="number-pad"
                value={resetCode}
                onChangeText={setResetCode}
                returnKeyType="next"
                onSubmitEditing={() => newPasswordRef.current?.focus()}
              />
            </View>

            {/* New Password */}
            <View style={styles.inputContainer}>
              <Feather name="lock" size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
              <TextInput
                ref={newPasswordRef}
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor="rgba(255,255,255,0.3)"
                secureTextEntry={!showPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
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
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={handleResetPassword}
              />
            </View>

            {/* Submit */}
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.submitButtonPressed,
                loading && styles.submitButtonDisabled,
              ]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              <LinearGradient
                colors={["#6c5ce7", "#a855f7"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitText}>Reset Password</Text>
                )}
              </LinearGradient>
            </Pressable>

            {/* Back to login */}
            <Pressable style={styles.backRow} onPress={() => router.back()}>
              <Text style={styles.backText}>
                Back to <Text style={styles.backLink}>Sign In</Text>
              </Text>
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
          <View style={styles.branding}>
            <Image source={require("@/assets/logo/white_icon_transparent_background.png")} style={styles.logoImage} resizeMode="contain" />
          </View>

          <Text style={styles.heading}>Forgot Password</Text>
          <Text style={styles.subheading}>
            Enter your email and we'll send you a reset code.
          </Text>

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
              returnKeyType="go"
              onSubmitEditing={handleSendCode}
            />
          </View>

          {/* Submit */}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
              loading && styles.submitButtonDisabled,
            ]}
            onPress={handleSendCode}
            disabled={loading}
          >
            <LinearGradient
              colors={["#6c5ce7", "#a855f7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitGradient}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitText}>Send Reset Code</Text>
              )}
            </LinearGradient>
          </Pressable>

          {/* Back to login */}
          <Pressable style={styles.backRow} onPress={() => router.back()}>
            <Text style={styles.backText}>
              Back to <Text style={styles.backLink}>Sign In</Text>
            </Text>
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
    letterSpacing: 0,
  },
  submitButton: {
    marginTop: 8,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    color: "white",
    fontSize: 17,
    fontWeight: "bold",
  },
  backRow: {
    marginTop: 20,
    alignItems: "center",
  },
  backText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
  },
  backLink: {
    color: "#a855f7",
    fontWeight: "600",
  },
});
