import { prisma } from "../index.js";
import { sendPushToEndpoint } from "./sns.js";

/**
 * Send a push notification to all of a user's active devices
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    // Get user's notification preferences
    const preferences = await prisma.notificationPreferences.findUnique({
      where: { userId },
    });

    // If push is disabled, skip
    if (preferences && !preferences.pushEnabled) {
      console.log(`Push notifications disabled for user ${userId}`);
      return;
    }

    // Get all active device tokens for the user
    const deviceTokens = await prisma.deviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    if (deviceTokens.length === 0) {
      console.log(`No active device tokens found for user ${userId}`);
      return;
    }

    // Send to all devices in parallel (non-blocking)
    const sendPromises = deviceTokens.map(async (deviceToken) => {
      try {
        if (!deviceToken.endpoint) {
          console.warn(`Device token ${deviceToken.id} has no SNS endpoint`);
          return { success: false, tokenId: deviceToken.id };
        }

        await sendPushToEndpoint(deviceToken.endpoint, title, message, data);

        // Log successful delivery
        await prisma.notificationDelivery.create({
          data: {
            userId,
            type: data?.type || "ANNOUNCEMENT",
            channel: "PUSH",
            title,
            message,
            metadata: data,
            status: "SENT",
            sentAt: new Date(),
          },
        });

        return { success: true, tokenId: deviceToken.id };
      } catch (error: any) {
        console.error(`Failed to send push to device ${deviceToken.id}:`, error);

        // Log failed delivery
        await prisma.notificationDelivery.create({
          data: {
            userId,
            type: data?.type || "ANNOUNCEMENT",
            channel: "PUSH",
            title,
            message,
            metadata: data,
            status: "FAILED",
            errorMessage: error.message,
          },
        });

        // If endpoint is invalid, mark device token as inactive
        if (error.code === "EndpointDisabled" || error.code === "InvalidParameter") {
          await prisma.deviceToken.update({
            where: { id: deviceToken.id },
            data: { isActive: false },
          });
        }

        return { success: false, tokenId: deviceToken.id, error };
      }
    });

    // Wait for all sends to complete
    const results = await Promise.allSettled(sendPromises);

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    console.log(
      `Sent push notification to ${successCount}/${deviceTokens.length} devices for user ${userId}`
    );
  } catch (error) {
    console.error(`Error sending push notification to user ${userId}:`, error);
    throw error;
  }
}
