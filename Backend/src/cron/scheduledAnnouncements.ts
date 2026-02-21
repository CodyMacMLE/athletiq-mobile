import cron, { type ScheduledTask } from "node-cron";
import { prisma } from "../db.js";
import { broadcastAnnouncement } from "../notifications/announcements.js";

let task: ScheduledTask | null = null;
let isRunning = false;

async function sendScheduledAnnouncements(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    const now = new Date();

    // Find announcements whose scheduled time has arrived and haven't been sent yet
    const due = await prisma.announcement.findMany({
      where: {
        scheduledFor: { lte: now },
        sentAt: null,
      },
      select: { id: true },
    });

    if (due.length === 0) return;

    console.log(`[scheduled-announcements] Sending ${due.length} scheduled announcement(s)`);

    for (const announcement of due) {
      broadcastAnnouncement(announcement.id).catch((err) => {
        console.error(`[scheduled-announcements] Failed to broadcast ${announcement.id}:`, err);
      });
    }
  } catch (err) {
    console.error("[scheduled-announcements] Error:", err);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scheduled announcements cron job.
 * Runs every minute to check for announcements due to be sent.
 */
export function startScheduledAnnouncementCron(): void {
  task = cron.schedule("* * * * *", () => {
    sendScheduledAnnouncements();
  });

  console.log("[scheduled-announcements] Cron scheduled (every minute)");
}

/** Stop the cron task (for graceful shutdown). */
export function stopScheduledAnnouncementCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
