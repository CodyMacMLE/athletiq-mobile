import { prisma } from "../../db.js";
import { Platform, ReportFrequency } from "@prisma/client";
import { sendFeedbackEmail } from "../../email.js";
import { registerPushToken, sendPushToEndpoint } from "../../notifications/sns.js";
import { broadcastAnnouncement } from "../../notifications/announcements.js";
import { generateGuardianReport } from "../../notifications/emailReports.js";
import { toISO } from "../../utils/time.js";
import type { Loaders } from "../../utils/dataLoaders.js";

interface Context {
  userId?: string;
  loaders: Loaders;
}

export const communicationsResolvers = {
  Query: {
    myNotificationPreferences: async (
      _: unknown,
      __: unknown,
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Return existing preferences or create default ones
      let prefs = await prisma.notificationPreferences.findUnique({
        where: { userId: context.userId },
      });

      if (!prefs) {
        prefs = await prisma.notificationPreferences.create({
          data: { userId: context.userId },
        });
      }

      return prefs;
    },

    myDeviceTokens: async (
      _: unknown,
      __: unknown,
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      return prisma.deviceToken.findMany({
        where: { userId: context.userId },
        orderBy: { createdAt: "desc" },
      });
    },

    myEmailReportConfigs: async (
      _: unknown,
      __: unknown,
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      return prisma.emailReportConfig.findMany({
        where: { userId: context.userId },
        include: { organization: true },
        orderBy: { createdAt: "desc" },
      });
    },

    organizationAnnouncements: async (
      _: unknown,
      { organizationId, limit }: { organizationId: string; limit?: number },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify user is a member of the organization
      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: context.userId,
            organizationId,
          },
        },
      });

      if (!membership) {
        throw new Error("Not a member of this organization");
      }

      return prisma.announcement.findMany({
        where: { organizationId },
        include: { creator: true, organization: true },
        orderBy: { createdAt: "desc" },
        take: limit || 50,
      });
    },

    notificationHistory: async (
      _: unknown,
      { limit }: { limit?: number },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      return prisma.notificationDelivery.findMany({
        where: { userId: context.userId },
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: limit || 100,
      });
    },
  },

  Mutation: {
    submitFeedback: async (
      _: unknown,
      { input }: { input: { category: string; message: string } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const user = await prisma.user.findUnique({ where: { id: context.userId } });
      if (!user) throw new Error("User not found");

      await sendFeedbackEmail({
        userEmail: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        category: input.category,
        message: input.message,
      });

      return true;
    },

    markNotificationRead: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      return prisma.notificationDelivery.update({
        where: { id },
        data: { readAt: new Date() },
      });
    },

    markAllNotificationsRead: async (
      _: unknown,
      __: unknown,
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      const result = await prisma.notificationDelivery.updateMany({
        where: { userId: context.userId, readAt: null },
        data: { readAt: new Date() },
      });
      return result.count;
    },

    registerDeviceToken: async (
      _: unknown,
      { input }: { input: { token: string; platform: Platform } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Register with SNS
      const endpoint = await registerPushToken(input.token, input.platform as "IOS" | "ANDROID");

      // Upsert device token
      const deviceToken = await prisma.deviceToken.upsert({
        where: {
          userId_token: {
            userId: context.userId,
            token: input.token,
          },
        },
        update: {
          endpoint,
          platform: input.platform,
          isActive: true,
        },
        create: {
          userId: context.userId,
          token: input.token,
          platform: input.platform,
          endpoint,
          isActive: true,
        },
      });

      return deviceToken;
    },

    unregisterDeviceToken: async (
      _: unknown,
      { tokenId }: { tokenId: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      await prisma.deviceToken.update({
        where: { id: tokenId },
        data: { isActive: false },
      });

      return true;
    },

    updateNotificationPreferences: async (
      _: unknown,
      { input }: { input: any },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const prefs = await prisma.notificationPreferences.upsert({
        where: { userId: context.userId },
        update: input,
        create: {
          userId: context.userId,
          ...input,
        },
      });

      return prefs;
    },

    createAnnouncement: async (
      _: unknown,
      { input }: { input: any },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify user has permission (OWNER, ADMIN, MANAGER, or COACH)
      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: context.userId,
            organizationId: input.organizationId,
          },
        },
      });

      if (!membership || !["OWNER", "ADMIN", "MANAGER", "COACH"].includes(membership.role)) {
        throw new Error("Insufficient permissions to create announcements");
      }

      // Create announcement
      const announcement = await prisma.announcement.create({
        data: {
          title: input.title,
          message: input.message,
          organizationId: input.organizationId,
          createdBy: context.userId,
          targetType: input.targetType || "ALL_TEAMS",
          teamIds: input.teamIds || [],
          userIds: input.userIds || [],
          eventDate: input.eventDate ? new Date(input.eventDate) : null,
          scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        },
        include: {
          organization: true,
          creator: true,
        },
      });

      return announcement;
    },

    sendAnnouncement: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify user is the creator or has admin permission
      const announcement = await prisma.announcement.findUnique({
        where: { id },
        include: { organization: true },
      });

      if (!announcement) {
        throw new Error("Announcement not found");
      }

      if (announcement.createdBy !== context.userId) {
        const membership = await prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId: context.userId,
              organizationId: announcement.organizationId,
            },
          },
        });

        if (!membership || !["OWNER", "ADMIN", "MANAGER", "COACH"].includes(membership.role)) {
          throw new Error("Insufficient permissions");
        }
      }

      // If the announcement has a future scheduledFor, skip immediate broadcast — cron will handle it
      const now = new Date();
      if (announcement.scheduledFor && announcement.scheduledFor > now) {
        return true;
      }

      // Mark as sent immediately so the UI reflects the sent state right away
      await prisma.announcement.update({
        where: { id },
        data: { sentAt: now },
      });

      // Broadcast announcement in background (non-blocking)
      broadcastAnnouncement(id).catch((err) => {
        console.error(`Failed to broadcast announcement ${id}:`, err);
      });

      return true;
    },

    deleteAnnouncement: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify user is the creator or has admin permission
      const announcement = await prisma.announcement.findUnique({
        where: { id },
      });

      if (!announcement) {
        throw new Error("Announcement not found");
      }

      if (announcement.createdBy !== context.userId) {
        const membership = await prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId: context.userId,
              organizationId: announcement.organizationId,
            },
          },
        });

        if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
          throw new Error("Insufficient permissions");
        }
      }

      await prisma.announcement.delete({ where: { id } });
      return true;
    },

    createEmailReportConfig: async (
      _: unknown,
      { input }: { input: { organizationId: string; frequency: ReportFrequency } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify user is a GUARDIAN in the organization
      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: context.userId,
            organizationId: input.organizationId,
          },
        },
      });

      if (!membership || membership.role !== "GUARDIAN") {
        throw new Error("Only guardians can configure email reports");
      }

      // Verify guardian has linked athletes
      const guardianLinks = await prisma.guardianLink.findMany({
        where: {
          guardianId: context.userId,
          organizationId: input.organizationId,
        },
      });

      if (guardianLinks.length === 0) {
        throw new Error("No athletes linked to this guardian");
      }

      const config = await prisma.emailReportConfig.create({
        data: {
          userId: context.userId,
          organizationId: input.organizationId,
          frequency: input.frequency,
          enabled: true,
        },
        include: {
          user: true,
          organization: true,
        },
      });

      return config;
    },

    updateEmailReportConfig: async (
      _: unknown,
      { id, frequency, enabled }: { id: string; frequency?: ReportFrequency; enabled?: boolean },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify ownership
      const config = await prisma.emailReportConfig.findUnique({
        where: { id },
      });

      if (!config || config.userId !== context.userId) {
        throw new Error("Not found or unauthorized");
      }

      const updated = await prisma.emailReportConfig.update({
        where: { id },
        data: {
          ...(frequency && { frequency }),
          ...(enabled !== undefined && { enabled }),
        },
        include: {
          user: true,
          organization: true,
        },
      });

      return updated;
    },

    deleteEmailReportConfig: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify ownership
      const config = await prisma.emailReportConfig.findUnique({
        where: { id },
      });

      if (!config || config.userId !== context.userId) {
        throw new Error("Not found or unauthorized");
      }

      await prisma.emailReportConfig.delete({ where: { id } });
      return true;
    },

    sendTestReport: async (
      _: unknown,
      { configId }: { configId: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // Verify ownership
      const config = await prisma.emailReportConfig.findUnique({
        where: { id: configId },
      });

      if (!config || config.userId !== context.userId) {
        throw new Error("Not found or unauthorized");
      }

      // Generate and send report in background (non-blocking)
      generateGuardianReport(configId).catch((err) => {
        console.error(`Failed to generate test report for config ${configId}:`, err);
      });

      return true;
    },
  },

  DeviceToken: {
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  NotificationPreferences: {
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  Announcement: {
    organization: (parent: { organizationId: string }, _: unknown, context: Context) =>
      context.loaders.organization.load(parent.organizationId),
    creator: (parent: { createdBy: string }, _: unknown, context: Context) =>
      context.loaders.user.load(parent.createdBy),
    sentAt: (parent: any) => parent.sentAt ? toISO(parent.sentAt) : null,
    eventDate: (parent: any) => parent.eventDate ? toISO(parent.eventDate) : null,
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  EmailReportConfig: {
    user: (parent: { userId: string }, _: unknown, context: Context) =>
      context.loaders.user.load(parent.userId),
    organization: (parent: { organizationId: string }, _: unknown, context: Context) =>
      context.loaders.organization.load(parent.organizationId),
    lastSentAt: (parent: any) => parent.lastSentAt ? toISO(parent.lastSentAt) : null,
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  NotificationDelivery: {
    user: (parent: { userId: string }, _: unknown, context: Context) =>
      context.loaders.user.load(parent.userId),
    metadata: (parent: any) =>
      parent.metadata != null ? JSON.stringify(parent.metadata) : null,
    sentAt: (parent: any) => parent.sentAt ? toISO(parent.sentAt) : null,
    readAt: (parent: any) => parent.readAt ? toISO(parent.readAt) : null,
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },
};
