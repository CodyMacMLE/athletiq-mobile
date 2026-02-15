import { useAuth } from "@/contexts/AuthContext";
import { UPDATE_USER, GENERATE_UPLOAD_URL } from "@/lib/graphql/mutations";
import { useMutation } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const AVATAR_SIZE = 90;

type EditableKey = "firstName" | "lastName" | "email" | "phone" | "address" | "city" | "country";

type EditField = {
  key: EditableKey;
  label: string;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
};

const EDITABLE_FIELDS: EditField[] = [
  { key: "firstName", label: "First Name", placeholder: "Enter first name" },
  { key: "lastName", label: "Last Name", placeholder: "Enter last name" },
  { key: "email", label: "Email", placeholder: "Enter email", keyboardType: "email-address" },
  { key: "phone", label: "Phone", placeholder: "Enter phone number", keyboardType: "phone-pad" },
  { key: "address", label: "Address", placeholder: "Enter address" },
  { key: "city", label: "City", placeholder: "Enter city" },
  { key: "country", label: "Country", placeholder: "Enter country" },
];

export default function Profile() {
  const router = useRouter();
  const { user, logout, isOrgAdmin, refetchUser } = useAuth();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingField, setEditingField] = useState<EditField | null>(null);
  const [editValue, setEditValue] = useState("");

  const [uploadingImage, setUploadingImage] = useState(false);

  const [updateUser, { loading: saving }] = useMutation(UPDATE_USER);
  const [generateUploadUrl] = useMutation(GENERATE_UPLOAD_URL);

  if (!user) return null;

  const handlePickImage = async () => {
    let ImagePicker: typeof import("expo-image-picker");
    try {
      ImagePicker = await import("expo-image-picker");
    } catch {
      Alert.alert("Rebuild Required", "Profile picture uploads require a native rebuild. Run 'npx expo run:ios' or 'npx expo run:android'.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow access to your photo library to upload a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType || "image/jpeg";

    setUploadingImage(true);
    try {
      const { data } = await generateUploadUrl({
        variables: { fileType: mimeType },
      });

      const { uploadUrl, publicUrl } = data.generateUploadUrl;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": mimeType },
      });

      await updateUser({
        variables: {
          id: user.id,
          input: { image: `${publicUrl}?t=${Date.now()}` },
        },
      });

      await refetchUser();
    } catch (err: any) {
      Alert.alert("Upload Failed", err.message || "Could not upload profile picture.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleEditPress = (field: EditField) => {
    setEditingField(field);
    setEditValue((user as Record<string, any>)[field.key] || "");
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!editingField || !user) return;
    try {
      await updateUser({
        variables: {
          id: user.id,
          input: { [editingField.key]: editValue },
        },
      });
      refetchUser();
      setEditModalVisible(false);
      setEditingField(null);
      setEditValue("");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save changes");
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: () => logout() },
      ]
    );
  };

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setEditModalVisible(false)}
          />
          <View style={styles.editModalContainer}>
            <Text style={styles.editModalTitle}>
              Edit {editingField?.label}
            </Text>
            <TextInput
              style={styles.editInput}
              value={editValue}
              onChangeText={setEditValue}
              placeholder={editingField?.placeholder}
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType={editingField?.keyboardType || "default"}
              autoFocus
              autoCapitalize={editingField?.key === "email" ? "none" : "words"}
            />
            <View style={styles.editModalButtons}>
              <Pressable
                style={[styles.editButton, styles.editButtonCancel]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.editButtonCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.editButton, styles.editButtonSave, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.editButtonSaveText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Pressable style={styles.avatarContainer} onPress={handlePickImage}>
            <View style={styles.avatar}>
              {user.image ? (
                <Image
                  source={{ uri: user.image }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.avatarText}>
                  {user.firstName.charAt(0)}
                  {user.lastName.charAt(0)}
                </Text>
              )}
            </View>
            {uploadingImage && (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator color="white" size="small" />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Feather name="camera" size={14} color="white" />
            </View>
          </Pressable>
          <Text style={styles.profileName}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={styles.profileEmail}>{user.email}</Text>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.fieldList}>
            {EDITABLE_FIELDS.map((field, index) => (
              <Pressable
                key={field.key}
                style={({ pressed }) => [
                  styles.fieldItem,
                  index < EDITABLE_FIELDS.length - 1 && styles.fieldItemBorder,
                  pressed && styles.fieldItemPressed,
                ]}
                onPress={() => handleEditPress(field)}
              >
                <View style={styles.fieldContent}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text
                    style={[
                      styles.fieldValue,
                      !(user as Record<string, any>)[field.key] && styles.fieldValueEmpty,
                    ]}
                  >
                    {(user as Record<string, any>)[field.key] || "Not set"}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.fieldList}>
            {isOrgAdmin && (
              <Pressable
                style={({ pressed }) => [
                  styles.fieldItem,
                  styles.fieldItemBorder,
                  pressed && styles.fieldItemPressed,
                ]}
                onPress={() => router.push("/nfc-setup")}
              >
                <View style={styles.fieldIconContainer}>
                  <Feather name="smartphone" size={18} color="#a855f7" />
                </View>
                <View style={styles.fieldContent}>
                  <Text style={styles.fieldLabel}>NFC Tags</Text>
                </View>
                <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.fieldItem,
                styles.fieldItemBorder,
                pressed && styles.fieldItemPressed,
              ]}
            >
              <View style={styles.fieldIconContainer}>
                <Feather name="bell" size={18} color="#a855f7" />
              </View>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Notifications</Text>
              </View>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.fieldItem,
                styles.fieldItemBorder,
                pressed && styles.fieldItemPressed,
              ]}
            >
              <View style={styles.fieldIconContainer}>
                <Feather name="lock" size={18} color="#a855f7" />
              </View>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Privacy</Text>
              </View>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.fieldItem,
                pressed && styles.fieldItemPressed,
              ]}
              onPress={() => router.push("/help-support")}
            >
              <View style={styles.fieldIconContainer}>
                <Feather name="help-circle" size={18} color="#a855f7" />
              </View>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Help & Support</Text>
              </View>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
            </Pressable>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleLogout}
          >
            <Feather name="log-out" size={18} color="#e74c3c" />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </View>

        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
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

  // Profile Header
  profileHeader: {
    alignItems: "center",
    paddingVertical: 24,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "#241e4a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#6c5ce7",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "white",
    fontSize: 32,
    fontWeight: "600",
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#6c5ce7",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#302b6f",
  },
  profileName: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 16,
  },
  profileEmail: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    marginTop: 4,
  },

  // Sections
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  fieldList: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  fieldItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  fieldItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  fieldItemPressed: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  fieldIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(168,85,247,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    color: "white",
    fontSize: 15,
    fontWeight: "500",
  },
  fieldValue: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 2,
  },
  fieldValueEmpty: {
    fontStyle: "italic",
  },

  // Logout
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(231,76,60,0.15)",
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(231,76,60,0.3)",
  },
  logoutText: {
    color: "#e74c3c",
    fontSize: 16,
    fontWeight: "600",
  },

  versionText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  editModalContainer: {
    backgroundColor: "#2a2550",
    borderRadius: 16,
    width: "100%",
    maxWidth: 340,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  editModalTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  editInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 14,
    color: "white",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  editModalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  editButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  editButtonCancel: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  editButtonCancelText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontWeight: "600",
  },
  editButtonSave: {
    backgroundColor: "#6c5ce7",
  },
  editButtonSaveText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
});
