import {
  SNSClient,
  CreatePlatformEndpointCommand,
  PublishCommand,
  SetEndpointAttributesCommand,
  GetEndpointAttributesCommand,
} from "@aws-sdk/client-sns";

const sns = new SNSClient({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const SNS_IOS_PLATFORM_APP_ARN = process.env.SNS_IOS_PLATFORM_APP_ARN || "";
const SNS_ANDROID_PLATFORM_APP_ARN = process.env.SNS_ANDROID_PLATFORM_APP_ARN || "";
const SNS_SMS_SENDER_ID = process.env.SNS_SMS_SENDER_ID || "Athletiq";

export type PlatformType = "IOS" | "ANDROID";

/**
 * Register a push token with SNS and create/update platform endpoint
 * Returns the SNS endpoint ARN for future use
 */
export async function registerPushToken(
  token: string,
  platform: PlatformType
): Promise<string> {
  const platformAppArn = platform === "IOS"
    ? SNS_IOS_PLATFORM_APP_ARN
    : SNS_ANDROID_PLATFORM_APP_ARN;

  if (!platformAppArn) {
    throw new Error(`SNS Platform Application ARN not configured for ${platform}`);
  }

  try {
    // Create platform endpoint
    const command = new CreatePlatformEndpointCommand({
      PlatformApplicationArn: platformAppArn,
      Token: token,
    });

    const response = await sns.send(command);

    if (!response.EndpointArn) {
      throw new Error("Failed to create SNS endpoint");
    }

    // Enable the endpoint if it was previously disabled
    const setAttrsCommand = new SetEndpointAttributesCommand({
      EndpointArn: response.EndpointArn,
      Attributes: {
        Enabled: "true",
      },
    });

    await sns.send(setAttrsCommand);

    return response.EndpointArn;
  } catch (error: any) {
    // If endpoint already exists, extract and return its ARN
    if (error.message && error.message.includes("already exists")) {
      const arnMatch = error.message.match(/arn:aws:sns:[^:]+:[^:]+:endpoint\/[^\s]+/);
      if (arnMatch) {
        const existingArn = arnMatch[0];

        // Update the token and enable it
        const setAttrsCommand = new SetEndpointAttributesCommand({
          EndpointArn: existingArn,
          Attributes: {
            Token: token,
            Enabled: "true",
          },
        });

        await sns.send(setAttrsCommand);
        return existingArn;
      }
    }

    throw error;
  }
}

/**
 * Send a push notification to a specific SNS endpoint
 */
export async function sendPushToEndpoint(
  endpointArn: string,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    // Check if endpoint is enabled
    const getAttrsCommand = new GetEndpointAttributesCommand({
      EndpointArn: endpointArn,
    });

    const attrs = await sns.send(getAttrsCommand);

    if (attrs.Attributes?.Enabled !== "true") {
      console.log(`Endpoint ${endpointArn} is disabled, skipping`);
      return;
    }

    // Format message for both iOS (APNS) and Android (GCM/FCM)
    // Expo handles the actual delivery, so we send in Expo format
    const payload = {
      default: message,
      APNS: JSON.stringify({
        aps: {
          alert: {
            title,
            body: message,
          },
          sound: "default",
          badge: 1,
        },
        data: data || {},
      }),
      GCM: JSON.stringify({
        notification: {
          title,
          body: message,
          sound: "default",
        },
        data: data || {},
      }),
    };

    const command = new PublishCommand({
      TargetArn: endpointArn,
      Message: JSON.stringify(payload),
      MessageStructure: "json",
    });

    await sns.send(command);
  } catch (error: any) {
    // If endpoint is invalid or deleted, log but don't throw
    if (error.code === "EndpointDisabled" || error.code === "InvalidParameter") {
      console.warn(`Failed to send to endpoint ${endpointArn}:`, error.message);
      return;
    }

    throw error;
  }
}

/**
 * Send an SMS message via SNS
 */
export async function sendSMS(
  phoneNumber: string,
  message: string
): Promise<void> {
  // Ensure phone number is in E.164 format (+1234567890)
  const formattedPhone = phoneNumber.startsWith("+") ? phoneNumber : `+1${phoneNumber}`;

  const command = new PublishCommand({
    PhoneNumber: formattedPhone,
    Message: message,
    MessageAttributes: {
      "AWS.SNS.SMS.SenderID": {
        DataType: "String",
        StringValue: SNS_SMS_SENDER_ID,
      },
      "AWS.SNS.SMS.SMSType": {
        DataType: "String",
        StringValue: "Transactional",
      },
    },
  });

  await sns.send(command);
}
