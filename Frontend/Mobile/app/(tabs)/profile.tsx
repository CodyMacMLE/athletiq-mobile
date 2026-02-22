import { useAuth } from "@/contexts/AuthContext";
import { UPDATE_USER, GENERATE_UPLOAD_URL, REMOVE_GUARDIAN, DELETE_MY_ACCOUNT, CREATE_EMERGENCY_CONTACT, UPDATE_EMERGENCY_CONTACT, DELETE_EMERGENCY_CONTACT, UPSERT_MEDICAL_INFO } from "@/lib/graphql/mutations";
import { GET_MY_GUARDIANS, GET_MY_LINKED_ATHLETES, GET_MY_HEALTH_DATA } from "@/lib/graphql/queries";
import { useMutation, useQuery } from "@apollo/client";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
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
const GUARDIAN_AVATAR_SIZE = 40;

type EmergencyContact = {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  isPrimary: boolean;
};

type MedicalInfo = {
  id: string;
  conditions?: string;
  allergies?: string;
  medications?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceGroupNumber?: string;
  notes?: string;
};

type ModalMode =
  | { type: "single"; key: string; label: string; placeholder: string; keyboardType?: "default" | "email-address" | "phone-pad" }
  | { type: "name" }
  | { type: "location" }
  | { type: "dob" }
  | { type: "emergencyContact"; contact?: EmergencyContact }
  | { type: "medicalInfo" };

export default function Profile() {
  const router = useRouter();
  const { user, logout, isOrgAdmin, refetchUser, selectedOrganization, selectedAthlete, setSelectedAthlete } = useAuth();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);

  // Single-field edit state
  const [editValue, setEditValue] = useState("");

  // Multi-field edit state (name)
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");

  // Multi-field edit state (location)
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");

  // DOB edit state
  const [editDob, setEditDob] = useState<Date>(new Date());
  const [showAndroidDobPicker, setShowAndroidDobPicker] = useState(false);

  const [uploadingImage, setUploadingImage] = useState(false);

  // Health state
  const [healthContactName, setHealthContactName] = useState("");
  const [healthContactRelationship, setHealthContactRelationship] = useState("");
  const [healthContactPhone, setHealthContactPhone] = useState("");
  const [healthContactEmail, setHealthContactEmail] = useState("");
  const [healthContactIsPrimary, setHealthContactIsPrimary] = useState(false);
  const [medConditions, setMedConditions] = useState("");
  const [medAllergies, setMedAllergies] = useState("");
  const [medMedications, setMedMedications] = useState("");
  const [medInsuranceProvider, setMedInsuranceProvider] = useState("");
  const [medInsurancePolicyNumber, setMedInsurancePolicyNumber] = useState("");
  const [medInsuranceGroupNumber, setMedInsuranceGroupNumber] = useState("");
  const [medNotes, setMedNotes] = useState("");

  const [updateUser, { loading: saving }] = useMutation(UPDATE_USER);
  const [generateUploadUrl] = useMutation(GENERATE_UPLOAD_URL);
  const [removeGuardian] = useMutation(REMOVE_GUARDIAN);
  const [deleteMyAccount] = useMutation(DELETE_MY_ACCOUNT);
  const [createEmergencyContact] = useMutation(CREATE_EMERGENCY_CONTACT);
  const [updateEmergencyContact] = useMutation(UPDATE_EMERGENCY_CONTACT);
  const [deleteEmergencyContact] = useMutation(DELETE_EMERGENCY_CONTACT);
  const [upsertMedicalInfo] = useMutation(UPSERT_MEDICAL_INFO);

  const { data: guardiansData, refetch: refetchGuardians } = useQuery(GET_MY_GUARDIANS, {
    variables: { organizationId: selectedOrganization?.id },
    skip: !selectedOrganization?.id,
  });

  const { data: linkedAthletesData, refetch: refetchLinkedAthletes } = useQuery(GET_MY_LINKED_ATHLETES, {
    variables: { organizationId: selectedOrganization?.id },
    skip: !selectedOrganization?.id,
  });

  const { data: healthData, refetch: refetchHealth } = useQuery(GET_MY_HEALTH_DATA, {
    variables: { userId: user?.id, organizationId: selectedOrganization?.id },
    skip: !user?.id || !selectedOrganization?.id,
  });

  const guardians = guardiansData?.myGuardians || [];
  const linkedAthletes = linkedAthletesData?.myLinkedAthletes || [];
  const emergencyContacts: EmergencyContact[] = healthData?.user?.emergencyContacts || [];
  const medicalInfo: MedicalInfo | null = healthData?.user?.medicalInfo || null;

  const openContactModal = (contact?: EmergencyContact) => {
    setHealthContactName(contact?.name || "");
    setHealthContactRelationship(contact?.relationship || "");
    setHealthContactPhone(contact?.phone || "");
    setHealthContactEmail(contact?.email || "");
    setHealthContactIsPrimary(contact?.isPrimary || false);
    setModalMode({ type: "emergencyContact", contact });
    setEditModalVisible(true);
  };

  const openMedicalModal = () => {
    setMedConditions(medicalInfo?.conditions || "");
    setMedAllergies(medicalInfo?.allergies || "");
    setMedMedications(medicalInfo?.medications || "");
    setMedInsuranceProvider(medicalInfo?.insuranceProvider || "");
    setMedInsurancePolicyNumber(medicalInfo?.insurancePolicyNumber || "");
    setMedInsuranceGroupNumber(medicalInfo?.insuranceGroupNumber || "");
    setMedNotes(medicalInfo?.notes || "");
    setModalMode({ type: "medicalInfo" });
    setEditModalVisible(true);
  };

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

  const openNameModal = () => {
    setModalMode({ type: "name" });
    setEditFirstName(user.firstName || "");
    setEditLastName(user.lastName || "");
    setEditModalVisible(true);
  };

  const openLocationModal = () => {
    setModalMode({ type: "location" });
    setEditAddress(user.address || "");
    setEditCity(user.city || "");
    setEditCountry(user.country || "");
    setEditModalVisible(true);
  };

  const openDobModal = () => {
    const existing = user.dateOfBirth
      ? new Date(isNaN(Number(user.dateOfBirth)) ? user.dateOfBirth : Number(user.dateOfBirth))
      : new Date(2000, 0, 1);
    setEditDob(existing);
    if (Platform.OS === "android") {
      setShowAndroidDobPicker(true);
    } else {
      setModalMode({ type: "dob" });
      setEditModalVisible(true);
    }
  };

  const openSingleModal = (key: string, label: string, placeholder: string, keyboardType?: "default" | "email-address" | "phone-pad") => {
    setModalMode({ type: "single", key, label, placeholder, keyboardType });
    setEditValue((user as Record<string, any>)[key] || "");
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!modalMode || !user) return;
    try {
      if (modalMode.type === "emergencyContact") {
        const contactInput = {
          name: healthContactName.trim(),
          relationship: healthContactRelationship.trim(),
          phone: healthContactPhone.trim(),
          email: healthContactEmail.trim() || undefined,
          isPrimary: healthContactIsPrimary,
        };
        if (modalMode.contact) {
          await updateEmergencyContact({ variables: { id: modalMode.contact.id, input: contactInput } });
        } else {
          await createEmergencyContact({ variables: { input: { userId: user.id, organizationId: selectedOrganization!.id, ...contactInput } } });
        }
        refetchHealth();
      } else if (modalMode.type === "medicalInfo") {
        await upsertMedicalInfo({
          variables: {
            input: {
              userId: user.id,
              organizationId: selectedOrganization!.id,
              conditions: medConditions || undefined,
              allergies: medAllergies || undefined,
              medications: medMedications || undefined,
              insuranceProvider: medInsuranceProvider || undefined,
              insurancePolicyNumber: medInsurancePolicyNumber || undefined,
              insuranceGroupNumber: medInsuranceGroupNumber || undefined,
              notes: medNotes || undefined,
            },
          },
        });
        refetchHealth();
      } else {
        let input: Record<string, string> = {};
        if (modalMode.type === "single") {
          input = { [modalMode.key]: editValue };
        } else if (modalMode.type === "name") {
          input = { firstName: editFirstName, lastName: editLastName };
        } else if (modalMode.type === "location") {
          input = { address: editAddress, city: editCity, country: editCountry };
        } else if (modalMode.type === "dob") {
          input = { dateOfBirth: editDob.toISOString() };
        }
        await updateUser({ variables: { id: user.id, input } });
        refetchUser();
      }
      setEditModalVisible(false);
      setModalMode(null);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save changes");
    }
  };

  const handleRemoveGuardian = (linkId: string, name: string, asSelf = false) => {
    const title = asSelf ? "Remove Yourself" : "Remove Guardian";
    const message = asSelf
      ? `Remove yourself as guardian for ${name}?`
      : `Remove ${name} as your guardian?`;
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeGuardian({ variables: { guardianLinkId: linkId } });
              refetchGuardians();
              refetchLinkedAthletes();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to remove guardian");
            }
          },
        },
      ]
    );
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

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account, remove you from all teams and organizations, and erase all your data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              "Type DELETE to confirm account deletion.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete My Account",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await deleteMyAccount();
                      await logout();
                    } catch (err: any) {
                      Alert.alert("Error", err.message || "Failed to delete account");
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const locationDisplay = [user.address, user.city, user.country].filter(Boolean).join(", ") || null;

  const renderModalContent = () => {
    if (!modalMode) return null;

    if (modalMode.type === "single") {
      return (
        <>
          <Text style={styles.editModalTitle}>Edit {modalMode.label}</Text>
          <TextInput
            style={styles.editInput}
            value={editValue}
            onChangeText={setEditValue}
            placeholder={modalMode.placeholder}
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType={modalMode.keyboardType || "default"}
            autoFocus
            autoCapitalize={modalMode.key === "email" ? "none" : "words"}
          />
        </>
      );
    }

    if (modalMode.type === "name") {
      return (
        <>
          <Text style={styles.editModalTitle}>Edit Name</Text>
          <TextInput
            style={styles.editInput}
            value={editFirstName}
            onChangeText={setEditFirstName}
            placeholder="First name"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoFocus
            autoCapitalize="words"
          />
          <TextInput
            style={[styles.editInput, { marginTop: 12 }]}
            value={editLastName}
            onChangeText={setEditLastName}
            placeholder="Last name"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="words"
          />
        </>
      );
    }

    if (modalMode.type === "location") {
      return (
        <>
          <Text style={styles.editModalTitle}>Edit Location</Text>
          <TextInput
            style={styles.editInput}
            value={editAddress}
            onChangeText={setEditAddress}
            placeholder="Address"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoFocus
            autoCapitalize="words"
          />
          <TextInput
            style={[styles.editInput, { marginTop: 12 }]}
            value={editCity}
            onChangeText={setEditCity}
            placeholder="City"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="words"
          />
          <TextInput
            style={[styles.editInput, { marginTop: 12 }]}
            value={editCountry}
            onChangeText={setEditCountry}
            placeholder="Country"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="words"
          />
        </>
      );
    }

    if (modalMode.type === "emergencyContact") {
      return (
        <>
          <Text style={styles.editModalTitle}>{modalMode.contact ? "Edit Contact" : "Add Emergency Contact"}</Text>
          <TextInput style={styles.editInput} value={healthContactName} onChangeText={setHealthContactName} placeholder="Full name" placeholderTextColor="rgba(255,255,255,0.3)" autoFocus autoCapitalize="words" />
          <TextInput style={[styles.editInput, { marginTop: 12 }]} value={healthContactRelationship} onChangeText={setHealthContactRelationship} placeholder="Relationship (e.g. Mother)" placeholderTextColor="rgba(255,255,255,0.3)" autoCapitalize="words" />
          <TextInput style={[styles.editInput, { marginTop: 12 }]} value={healthContactPhone} onChangeText={setHealthContactPhone} placeholder="Phone number" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="phone-pad" />
          <TextInput style={[styles.editInput, { marginTop: 12 }]} value={healthContactEmail} onChangeText={setHealthContactEmail} placeholder="Email (optional)" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="email-address" autoCapitalize="none" />
          <Pressable style={styles.checkboxRow} onPress={() => setHealthContactIsPrimary(!healthContactIsPrimary)}>
            <View style={[styles.checkbox, healthContactIsPrimary && styles.checkboxChecked]}>
              {healthContactIsPrimary && <Text style={styles.checkboxCheck}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Primary contact</Text>
          </Pressable>
        </>
      );
    }

    if (modalMode.type === "dob") {
      return (
        <>
          <Text style={styles.editModalTitle}>Date of Birth</Text>
          <View style={{ alignItems: "center", paddingVertical: 8 }}>
            <DateTimePicker
              value={editDob}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={(_, date) => { if (date) setEditDob(date); }}
              textColor="white"
              themeVariant="dark"
              style={{ width: "100%" }}
            />
          </View>
        </>
      );
    }

    if (modalMode.type === "medicalInfo") {
      return (
        <>
          <Text style={styles.editModalTitle}>Medical Information</Text>
          <Text style={styles.medFieldLabel}>Allergies</Text>
          <TextInput style={[styles.editInput, styles.textArea]} value={medAllergies} onChangeText={setMedAllergies} placeholder="e.g. Peanuts, Penicillin" placeholderTextColor="rgba(255,255,255,0.3)" multiline numberOfLines={2} autoFocus />
          <Text style={[styles.medFieldLabel, { marginTop: 12 }]}>Conditions</Text>
          <TextInput style={[styles.editInput, styles.textArea]} value={medConditions} onChangeText={setMedConditions} placeholder="e.g. Asthma, Diabetes" placeholderTextColor="rgba(255,255,255,0.3)" multiline numberOfLines={2} />
          <Text style={[styles.medFieldLabel, { marginTop: 12 }]}>Medications</Text>
          <TextInput style={[styles.editInput, styles.textArea]} value={medMedications} onChangeText={setMedMedications} placeholder="Current medications" placeholderTextColor="rgba(255,255,255,0.3)" multiline numberOfLines={2} />
          <Text style={[styles.medFieldLabel, { marginTop: 12 }]}>Insurance Provider</Text>
          <TextInput style={styles.editInput} value={medInsuranceProvider} onChangeText={setMedInsuranceProvider} placeholder="Provider name" placeholderTextColor="rgba(255,255,255,0.3)" />
          <Text style={[styles.medFieldLabel, { marginTop: 12 }]}>Policy Number</Text>
          <TextInput style={styles.editInput} value={medInsurancePolicyNumber} onChangeText={setMedInsurancePolicyNumber} placeholder="Policy #" placeholderTextColor="rgba(255,255,255,0.3)" />
          <Text style={[styles.medFieldLabel, { marginTop: 12 }]}>Group Number</Text>
          <TextInput style={styles.editInput} value={medInsuranceGroupNumber} onChangeText={setMedInsuranceGroupNumber} placeholder="Group #" placeholderTextColor="rgba(255,255,255,0.3)" />
          <Text style={[styles.medFieldLabel, { marginTop: 12 }]}>Notes</Text>
          <TextInput style={[styles.editInput, styles.textArea]} value={medNotes} onChangeText={setMedNotes} placeholder="Additional notes" placeholderTextColor="rgba(255,255,255,0.3)" multiline numberOfLines={2} />
        </>
      );
    }

    return null;
  };

  return (
    <LinearGradient
      colors={["#302b6f", "#4d2a69", "#302b6f"]}
      style={styles.gradient}
      locations={[0.1, 0.6, 1]}
    >
      <StatusBar style="light" />

      {/* Android DOB Picker (renders inline outside modal) */}
      {showAndroidDobPicker && (
        <DateTimePicker
          value={editDob}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={async (_, date) => {
            setShowAndroidDobPicker(false);
            if (date) {
              try {
                await updateUser({ variables: { id: user.id, input: { dateOfBirth: date.toISOString() } } });
                refetchUser();
              } catch (err: any) {
                Alert.alert("Error", err.message || "Failed to save date of birth");
              }
            }
          }}
        />
      )}

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
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {renderModalContent()}
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
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Profile</Text>
        </View>
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

        {/* No org banner */}
        {!selectedOrganization && (
          <View style={styles.noOrgBanner}>
            <View style={styles.noOrgIcon}>
              <Feather name="mail" size={24} color="#a855f7" />
            </View>
            <Text style={styles.noOrgTitle}>No Organization Yet</Text>
            <Text style={styles.noOrgMessage}>
              Ask your coach or administrator to send you an invite. Once you accept, your dashboard and teams will appear here.
            </Text>
          </View>
        )}

        {/* Personal Information — condensed */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.fieldList}>
            {/* Name row */}
            <Pressable
              style={({ pressed }) => [
                styles.fieldItem,
                styles.fieldItemBorder,
                pressed && styles.fieldItemPressed,
              ]}
              onPress={openNameModal}
            >
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Name</Text>
                <Text style={styles.fieldValue}>
                  {user.firstName} {user.lastName}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
            </Pressable>

            {/* Email row */}
            <Pressable
              style={({ pressed }) => [
                styles.fieldItem,
                styles.fieldItemBorder,
                pressed && styles.fieldItemPressed,
              ]}
              onPress={() => openSingleModal("email", "Email", "Enter email", "email-address")}
            >
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Email</Text>
                <Text style={styles.fieldValue}>{user.email}</Text>
              </View>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
            </Pressable>

            {/* Phone row */}
            <Pressable
              style={({ pressed }) => [
                styles.fieldItem,
                styles.fieldItemBorder,
                pressed && styles.fieldItemPressed,
              ]}
              onPress={() => openSingleModal("phone", "Phone", "Enter phone number", "phone-pad")}
            >
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Phone</Text>
                <Text
                  style={[styles.fieldValue, !user.phone && styles.fieldValueEmpty]}
                >
                  {user.phone || "Not set"}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
            </Pressable>

            {/* Date of Birth row */}
            <Pressable
              style={({ pressed }) => [
                styles.fieldItem,
                styles.fieldItemBorder,
                pressed && styles.fieldItemPressed,
              ]}
              onPress={openDobModal}
            >
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Date of Birth</Text>
                <Text style={[styles.fieldValue, !user.dateOfBirth && styles.fieldValueEmpty]}>
                  {user.dateOfBirth
                    ? (() => {
                        const dob = new Date(isNaN(Number(user.dateOfBirth)) ? user.dateOfBirth : Number(user.dateOfBirth));
                        const today = new Date();
                        const age = today.getFullYear() - dob.getFullYear() - (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
                        return `${dob.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · ${age} yrs`;
                      })()
                    : "Not set"}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
            </Pressable>

            {/* Location row */}
            <Pressable
              style={({ pressed }) => [
                styles.fieldItem,
                pressed && styles.fieldItemPressed,
              ]}
              onPress={openLocationModal}
            >
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Location</Text>
                <Text
                  style={[styles.fieldValue, !locationDisplay && styles.fieldValueEmpty]}
                >
                  {locationDisplay || "Not set"}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
            </Pressable>
          </View>
        </View>

        {/* Family — only show when in an org */}
        {selectedOrganization && (linkedAthletes.length > 0 || guardians.length > 0 || true) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Family</Text>
            <View style={styles.fieldList}>

              {/* My Athletes — people I am a guardian for */}
              {linkedAthletes.length > 0 && (
                <>
                  <Text style={styles.familySubLabel}>My Athletes</Text>
                  {linkedAthletes.map((link: any) => {
                    const isActive = selectedAthlete?.id === link.athlete.id;
                    return (
                      <Pressable
                        key={link.id}
                        style={({ pressed }) => [
                          styles.guardianItem,
                          styles.fieldItemBorder,
                          isActive && styles.guardianItemActive,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => setSelectedAthlete({ id: link.athlete.id, firstName: link.athlete.firstName, lastName: link.athlete.lastName, image: link.athlete.image })}
                      >
                        <View style={styles.guardianAvatar}>
                          {link.athlete.image ? (
                            <Image
                              source={{ uri: link.athlete.image }}
                              style={styles.guardianAvatarImage}
                              contentFit="cover"
                            />
                          ) : (
                            <Text style={styles.guardianAvatarText}>
                              {link.athlete.firstName.charAt(0)}
                              {link.athlete.lastName.charAt(0)}
                            </Text>
                          )}
                        </View>
                        <View style={styles.fieldContent}>
                          <Text style={styles.fieldLabel}>
                            {link.athlete.firstName} {link.athlete.lastName}
                          </Text>
                          {isActive && (
                            <Text style={styles.viewingBadge}>Viewing as this athlete</Text>
                          )}
                        </View>
                        <View style={styles.familyAthleteActions}>
                          <Feather name="log-in" size={16} color={isActive ? "#a855f7" : "rgba(255,255,255,0.35)"} />
                          <Pressable
                            onPress={() => handleRemoveGuardian(link.id, `${link.athlete.firstName} ${link.athlete.lastName}`, true)}
                            hitSlop={8}
                            style={{ marginLeft: 14 }}
                          >
                            <Feather name="x" size={18} color="rgba(255,255,255,0.4)" />
                          </Pressable>
                        </View>
                      </Pressable>
                    );
                  })}
                </>
              )}

              {/* My Guardians — people watching over me (read-only for athlete) */}
              {guardians.length > 0 && (
                <>
                  <Text style={[styles.familySubLabel, linkedAthletes.length > 0 && { marginTop: 12 }]}>My Guardians</Text>
                  {guardians.map((link: any) => (
                    <View
                      key={link.id}
                      style={[styles.guardianItem, styles.fieldItemBorder]}
                    >
                      <View style={styles.guardianAvatar}>
                        {link.guardian.image ? (
                          <Image
                            source={{ uri: link.guardian.image }}
                            style={styles.guardianAvatarImage}
                            contentFit="cover"
                          />
                        ) : (
                          <Text style={styles.guardianAvatarText}>
                            {link.guardian.firstName.charAt(0)}
                            {link.guardian.lastName.charAt(0)}
                          </Text>
                        )}
                      </View>
                      <View style={styles.fieldContent}>
                        <Text style={styles.fieldLabel}>
                          {link.guardian.firstName} {link.guardian.lastName}
                        </Text>
                        <Text style={styles.fieldValue}>{link.guardian.email}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.fieldItem,
                  pressed && styles.fieldItemPressed,
                ]}
                onPress={() => router.push("/invite-guardian")}
              >
                <View style={styles.fieldIconContainer}>
                  <Feather name="user-plus" size={18} color="#a855f7" />
                </View>
                <View style={styles.fieldContent}>
                  <Text style={styles.fieldLabel}>Invite Guardian</Text>
                </View>
                <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
              </Pressable>
            </View>
          </View>
        )}

        {/* Health & Safety — only show when in an org */}
        {selectedOrganization && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Health &amp; Safety</Text>
            <View style={styles.fieldList}>
              {/* Emergency Contacts */}
              <View style={styles.healthSubSection}>
                <View style={styles.healthSubHeader}>
                  <Text style={styles.healthSubTitle}>Emergency Contacts</Text>
                  <Pressable onPress={() => openContactModal()} hitSlop={8}>
                    <Text style={styles.healthAddBtn}>+ Add</Text>
                  </Pressable>
                </View>
                {emergencyContacts.length > 0 ? (
                  emergencyContacts.map((contact, index) => (
                    <View key={contact.id} style={[styles.healthContactItem, index < emergencyContacts.length - 1 && styles.fieldItemBorder]}>
                      <View style={styles.fieldContent}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={styles.fieldLabel}>{contact.name}</Text>
                          {contact.isPrimary && <Text style={styles.primaryBadge}>PRIMARY</Text>}
                        </View>
                        <Text style={styles.fieldValue}>{contact.relationship} · {contact.phone}</Text>
                        {contact.email ? <Text style={styles.fieldValue}>{contact.email}</Text> : null}
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable onPress={() => openContactModal(contact)} hitSlop={8}>
                          <Feather name="edit-2" size={16} color="rgba(255,255,255,0.4)" />
                        </Pressable>
                        <Pressable
                          onPress={() => Alert.alert("Delete Contact", `Delete ${contact.name}?`, [
                            { text: "Cancel", style: "cancel" },
                            { text: "Delete", style: "destructive", onPress: async () => {
                              await deleteEmergencyContact({ variables: { id: contact.id } });
                              refetchHealth();
                            }},
                          ])}
                          hitSlop={8}
                        >
                          <Feather name="trash-2" size={16} color="rgba(255,255,255,0.4)" />
                        </Pressable>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.healthEmpty}>No emergency contacts added</Text>
                )}
              </View>

              {/* Medical Information */}
              <View style={[styles.healthSubSection, styles.healthSubSectionTop]}>
                <View style={styles.healthSubHeader}>
                  <Text style={styles.healthSubTitle}>Medical Information</Text>
                  <Pressable onPress={openMedicalModal} hitSlop={8}>
                    <Text style={styles.healthAddBtn}>{medicalInfo ? "Edit" : "+ Add"}</Text>
                  </Pressable>
                </View>
                {medicalInfo ? (
                  <View style={styles.medInfoGrid}>
                    {medicalInfo.allergies ? <View style={styles.medInfoItem}><Text style={styles.medInfoLabel}>Allergies</Text><Text style={styles.medInfoValue}>{medicalInfo.allergies}</Text></View> : null}
                    {medicalInfo.conditions ? <View style={styles.medInfoItem}><Text style={styles.medInfoLabel}>Conditions</Text><Text style={styles.medInfoValue}>{medicalInfo.conditions}</Text></View> : null}
                    {medicalInfo.medications ? <View style={styles.medInfoItem}><Text style={styles.medInfoLabel}>Medications</Text><Text style={styles.medInfoValue}>{medicalInfo.medications}</Text></View> : null}
                    {medicalInfo.insuranceProvider ? <View style={styles.medInfoItem}><Text style={styles.medInfoLabel}>Insurance</Text><Text style={styles.medInfoValue}>{medicalInfo.insuranceProvider}</Text></View> : null}
                    {!medicalInfo.allergies && !medicalInfo.conditions && !medicalInfo.medications && !medicalInfo.insuranceProvider && (
                      <Text style={styles.healthEmpty}>Tap Edit to add medical information</Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.healthEmpty}>No medical information added</Text>
                )}
              </View>
            </View>
          </View>
        )}

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
              onPress={() => router.push("/notification-settings")}
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

          <Pressable
            style={({ pressed }) => [
              styles.deleteAccountButton,
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleDeleteAccount}
          >
            <Feather name="trash-2" size={18} color="#e74c3c" />
            <Text style={styles.logoutText}>Delete Account</Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 80,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    flex: 1,
    minHeight: 58,
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

  // No org banner
  noOrgBanner: {
    backgroundColor: "rgba(168,85,247,0.1)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
    padding: 24,
    alignItems: "center",
    marginBottom: 8,
  },
  noOrgIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(168,85,247,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  noOrgTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 8,
  },
  noOrgMessage: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
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

  // Guardian / Family items
  guardianItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  guardianItemActive: {
    backgroundColor: "rgba(168,85,247,0.08)",
  },
  familySubLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  familyAthleteActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewingBadge: {
    color: "#a855f7",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  guardianAvatar: {
    width: GUARDIAN_AVATAR_SIZE,
    height: GUARDIAN_AVATAR_SIZE,
    borderRadius: GUARDIAN_AVATAR_SIZE / 2,
    backgroundColor: "#241e4a",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  guardianAvatarImage: {
    width: "100%",
    height: "100%",
  },
  guardianAvatarText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
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
  deleteAccountButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(231,76,60,0.3)",
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

  // Health & Safety
  healthSubSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  healthSubSectionTop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  healthSubHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  healthSubTitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
  },
  healthAddBtn: {
    color: "#a855f7",
    fontSize: 13,
    fontWeight: "600",
  },
  healthContactItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    gap: 8,
  },
  healthEmpty: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: 4,
  },
  primaryBadge: {
    color: "#a855f7",
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: "rgba(168,85,247,0.15)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  medInfoGrid: {
    gap: 6,
  },
  medInfoItem: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  medInfoLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    width: 80,
    paddingTop: 1,
  },
  medInfoValue: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    flex: 1,
  },

  // Checkbox
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#6c5ce7",
    borderColor: "#6c5ce7",
  },
  checkboxCheck: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  checkboxLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },

  // Medical modal fields
  medFieldLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: "top",
  },
});
