import cron, { type ScheduledTask } from "node-cron";
import { prisma } from "../index.js";
import { sendPushNotification } from "../notifications/pushNotifications.js";
import { sendEventReminderEmail } from "../notifications/emailNotifications.js";

let task: ScheduledTask | null = null;
let isRunning = false;

async function sendEventReminders(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    const now = new Date();
    const threeHoursFromNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    // Find events in the next 3 hours
    const upcomingEvents = await prisma.event.findMany({
      where: {
        date: {
          gte: now,
          lte: threeHoursFromNow,
        },
      },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: {
                  include: {
                    notificationPreferences: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (upcomingEvents.length === 0) {
      return;
    }

    let remindersSent = 0;

    // Process each event
    for (const event of upcomingEvents) {
      if (!event.team) continue;

      const eventTime = new Date(event.date);
      const minutesUntilEvent = Math.floor((eventTime.getTime() - now.getTime()) / (1000 * 60));

      // Process each team member
      for (const member of event.team.members) {
        const user = member.user;
        const prefs = user.notificationPreferences;

        // Skip if event reminders disabled
        if (prefs && !prefs.eventRemindersEnabled) {
          continue;
        }

        // Get user's preferred reminder time (default 120 minutes)
        const reminderMinutes = prefs?.eventReminderMinutes || 120;

        // Check if we should send reminder now (within 5-minute window)
        const shouldSendReminder =
          minutesUntilEvent <= reminderMinutes &&
          minutesUntilEvent > reminderMinutes - 5;

        if (!shouldSendReminder) {
          continue;
        }

        // Check if we already sent a reminder for this event to this user
        const existingReminder = await prisma.notificationDelivery.findFirst({
          where: {
            userId: user.id,
            type: "EVENT_REMINDER",
            metadata: {
              path: ["eventId"],
              equals: event.id,
            },
            createdAt: {
              gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        });

        if (existingReminder) {
          continue;
        }

        // Send reminder via enabled channels
        const eventDateStr = eventTime.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

        // Send push notification
        if (!prefs || prefs.pushEnabled) {
          sendPushNotification(
            user.id,
            `Reminder: ${event.title}`,
            `${event.title} starts at ${event.startTime}`,
            {
              type: "EVENT_REMINDER",
              eventId: event.id,
              eventTitle: event.title,
              eventTime: event.startTime,
            }
          ).catch((err) => {
            console.error(`Failed to send push reminder to user ${user.id}:`, err);
          });
        }

        // Send email
        if (!prefs || prefs.emailEnabled) {
          (async () => {
            try {
              await sendEventReminderEmail(
                user.email,
                event.title,
                eventDateStr,
                event.startTime,
                event.location
              );

              // Log email delivery
              await prisma.notificationDelivery.create({
                data: {
                  userId: user.id,
                  type: "EVENT_REMINDER",
                  channel: "EMAIL",
                  title: `Reminder: ${event.title}`,
                  message: `${event.title} starts at ${event.startTime}`,
                  status: "SENT",
                  sentAt: new Date(),
                  metadata: {
                    eventId: event.id,
                    eventTitle: event.title,
                    eventTime: event.startTime,
                  },
                },
              });
            } catch (err: any) {
              console.error(`Failed to send email reminder to user ${user.id}:`, err);

              // Log failed delivery
              await prisma.notificationDelivery.create({
                data: {
                  userId: user.id,
                  type: "EVENT_REMINDER",
                  channel: "EMAIL",
                  title: `Reminder: ${event.title}`,
                  message: `${event.title} starts at ${event.startTime}`,
                  status: "FAILED",
                  errorMessage: err.message,
                  metadata: {
                    eventId: event.id,
                    eventTitle: event.title,
                    eventTime: event.startTime,
                  },
                },
              });
            }
          })();
        }

        remindersSent++;
      }
    }

    if (remindersSent > 0) {
      console.log(`[event-reminders] Sent ${remindersSent} reminder(s)`);
    }
  } catch (err) {
    console.error("[event-reminders] Error:", err);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the event reminder cron job.
 * Runs every 5 minutes to check for upcoming events and send reminders.
 */
export function startEventReminderCron(): void {
  // Run immediately on startup
  sendEventReminders();

  task = cron.schedule("*/5 * * * *", () => {
    sendEventReminders();
  });

  console.log("[event-reminders] Cron scheduled (every 5 minutes)");
}

/** Stop the cron task (for graceful shutdown). */
export function stopEventReminderCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
