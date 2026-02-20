import { useState, useEffect, useRef } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useMutation } from "@apollo/client";
import { gql } from "@apollo/client";

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const REGISTER_DEVICE_TOKEN = gql(`
  mutation RegisterDeviceToken($input: RegisterDeviceTokenInput!) {
    registerDeviceToken(input: $input) {
      id
      token
      platform
      isActive
    }
  }
`);

/**
 * Register device for push notifications
 * Returns the Expo push token or null if registration fails
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Check if running on a physical device
  if (!Device.isDevice) {
    console.log("Push notifications only work on physical devices");
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not already granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Permission to receive push notifications was denied");
    return null;
  }

  try {
    // Configure notification channel for Android
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#a855f7",
      });
    }

    // Get native device token (APNS on iOS, FCM on Android) required by AWS SNS
    const tokenData = await Notifications.getDevicePushTokenAsync();

    return tokenData.data as string;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
}

/**
 * Hook to register device token with backend on app launch
 */
export function useNotificationRegistration() {
  const [registered, setRegistered] = useState(false);
  const [registerDeviceToken] = useMutation(REGISTER_DEVICE_TOKEN);

  const register = async () => {
    if (registered) return;

    try {
      const token = await registerForPushNotifications();
      if (!token) {
        console.log("Failed to get push token");
        return;
      }

      const platform = Platform.OS === "ios" ? "IOS" : "ANDROID";

      await registerDeviceToken({
        variables: {
          input: {
            token,
            platform,
          },
        },
      });

      setRegistered(true);
      console.log("Device registered for push notifications");
    } catch (error) {
      console.error("Failed to register device token:", error);
    }
  };

  return { register, registered };
}

/**
 * Hook to listen for notification events
 * @param onReceived - Callback when notification is received while app is open
 * @param onTapped - Callback when user taps a notification
 */
export function useNotificationListener(
  onReceived?: (notification: Notifications.Notification) => void,
  onTapped?: (response: Notifications.NotificationResponse) => void
) {
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    // Listen for notifications received while app is in foreground
    if (onReceived) {
      notificationListener.current =
        Notifications.addNotificationReceivedListener(onReceived);
    }

    // Listen for user tapping notification
    if (onTapped) {
      responseListener.current =
        Notifications.addNotificationResponseReceivedListener(onTapped);
    }

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [onReceived, onTapped]);
}
