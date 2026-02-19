import { prisma } from "../index.js";
import { sendPushNotification } from "./pushNotifications.js";
import { sendAnnouncementEmail } from "./emailNotifications.js";

/**
 * Broadcast an announcement to targeted users
 * Determines recipients based on targetType and sends via enabled channels
 */
export async function broadcastAnnouncement(announcementId: string): Promise<void> {
  try {
    // Get announcement details
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      include: {
        organization: true,
      },
    });

    if (!announcement) {
      throw new Error(`Announcement ${announcementId} not found`);
    }

    if (announcement.sentAt) {
      console.log(`Announcement ${announcementId} already sent at ${announcement.sentAt}`);
      return;
    }

    // Determine target users based on targetType
    let targetUserIds: string[] = [];

    if (announcement.targetType === "ALL_TEAMS") {
      // Get all members of the organization
      const members = await prisma.organizationMember.findMany({
        where: {
          organizationId: announcement.organizationId,
        },
        select: { userId: true },
      });

      targetUserIds = members.map((m) => m.userId);
    } else if (announcement.targetType === "SPECIFIC_TEAMS") {
      // Get members of specific teams
      if (announcement.teamIds.length === 0) {
        throw new Error("No teams specified for SPECIFIC_TEAMS announcement");
      }

      const teamMembers = await prisma.teamMember.findMany({
        where: {
          teamId: { in: announcement.teamIds },
        },
        select: { userId: true },
        distinct: ["userId"],
      });

      targetUserIds = teamMembers.map((m) => m.userId);
    } else if (announcement.targetType === "EVENT_DAY") {
      // Get members of teams with events on the specified date
      if (!announcement.eventDate) {
        throw new Error("No event date specified for EVENT_DAY announcement");
      }

      const startOfDay = new Date(announcement.eventDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(announcement.eventDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Find events on that day
      const events = await prisma.event.findMany({
        where: {
          organizationId: announcement.organizationId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        select: { teamId: true },
      });

      const teamIds = events
        .filter((e) => e.teamId)
        .map((e) => e.teamId as string);

      if (teamIds.length === 0) {
        console.log(`No events found on ${announcement.eventDate}`);
        targetUserIds = [];
      } else {
        const teamMembers = await prisma.teamMember.findMany({
          where: {
            teamId: { in: teamIds },
          },
          select: { userId: true },
          distinct: ["userId"],
        });

        targetUserIds = teamMembers.map((m) => m.userId);
      }
    }

    // Remove duplicates
    targetUserIds = [...new Set(targetUserIds)];

    console.log(`Broadcasting announcement to ${targetUserIds.length} users`);

    if (targetUserIds.length === 0) {
      console.log("No target users found, skipping broadcast");

      // Mark as sent even though no one received it
      await prisma.announcement.update({
        where: { id: announcementId },
        data: { sentAt: new Date() },
      });

      return;
    }

    // Get users with their preferences and emails
    const users = await prisma.user.findMany({
      where: { id: { in: targetUserIds } },
      include: {
        notificationPreferences: true,
      },
    });

    // Send to each user via their enabled channels
    const sendPromises = users.map(async (user) => {
      const prefs = user.notificationPreferences;

      // Skip if announcements are disabled
      if (prefs && !prefs.announcementsEnabled) {
        await prisma.notificationDelivery.create({
          data: {
            userId: user.id,
            type: "ANNOUNCEMENT",
            channel: "PUSH",
            title: announcement.title,
            message: announcement.message,
            status: "SKIPPED",
            announcementId: announcement.id,
            metadata: { reason: "announcements_disabled" },
          },
        });
        return;
      }

      const promises: Promise<any>[] = [];

      // Send push notification if enabled
      if (!prefs || prefs.pushEnabled) {
        promises.push(
          sendPushNotification(
            user.id,
            announcement.title,
            announcement.message,
            {
              type: "ANNOUNCEMENT",
              announcementId: announcement.id,
              organizationId: announcement.organizationId,
            }
          ).catch((err) => {
            console.error(`Failed to send push to user ${user.id}:`, err);
          })
        );
      }

      // Send email if enabled
      if (!prefs || prefs.emailEnabled) {
        promises.push(
          (async () => {
            try {
              await sendAnnouncementEmail(
                user.email,
                announcement.title,
                announcement.message,
                announcement.organization.name
              );

              // Log email delivery
              await prisma.notificationDelivery.create({
                data: {
                  userId: user.id,
                  type: "ANNOUNCEMENT",
                  channel: "EMAIL",
                  title: announcement.title,
                  message: announcement.message,
                  status: "SENT",
                  sentAt: new Date(),
                  announcementId: announcement.id,
                },
              });
            } catch (err: any) {
              console.error(`Failed to send email to user ${user.id}:`, err);

              // Log failed delivery
              await prisma.notificationDelivery.create({
                data: {
                  userId: user.id,
                  type: "ANNOUNCEMENT",
                  channel: "EMAIL",
                  title: announcement.title,
                  message: announcement.message,
                  status: "FAILED",
                  errorMessage: err.message,
                  announcementId: announcement.id,
                },
              });
            }
          })()
        );
      }

      return Promise.allSettled(promises);
    });

    // Wait for all sends to complete
    await Promise.allSettled(sendPromises);

    // Mark announcement as sent
    await prisma.announcement.update({
      where: { id: announcementId },
      data: { sentAt: new Date() },
    });

    console.log(`Announcement ${announcementId} broadcast complete`);
  } catch (error) {
    console.error(`Error broadcasting announcement ${announcementId}:`, error);
    throw error;
  }
}
