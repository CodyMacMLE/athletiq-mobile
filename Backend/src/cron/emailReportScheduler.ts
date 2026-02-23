import cron, { type ScheduledTask } from "node-cron";
import { prisma } from "../db.js";
import { generateGuardianReport, sendOrgFrequencyReports } from "../notifications/emailReports.js";

let task: ScheduledTask | null = null;
let isRunning = false;

/**
 * Check if a report config is due for sending based on frequency and lastSentAt
 */
function isDueForSending(
  frequency: string,
  lastSentAt: Date | null
): boolean {
  if (!lastSentAt) return true;

  const now = new Date();
  const daysSinceLastSent = Math.floor(
    (now.getTime() - lastSentAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  switch (frequency) {
    case "WEEKLY":
      return daysSinceLastSent >= 7;
    case "MONTHLY":
      return daysSinceLastSent >= 30;
    case "QUARTERLY":
      return daysSinceLastSent >= 90;
    case "BIANNUALLY":
      return daysSinceLastSent >= 180;
    case "ANNUALLY":
      return daysSinceLastSent >= 365;
    default:
      return false;
  }
}

async function sendScheduledReports(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    // Find all enabled report configs
    const configs = await prisma.emailReportConfig.findMany({
      where: {
        enabled: true,
      },
    });

    if (configs.length === 0) {
      return;
    }

    let reportsSent = 0;

    // Check each config to see if it's due
    for (const config of configs) {
      if (isDueForSending(config.frequency, config.lastSentAt)) {
        try {
          await generateGuardianReport(config.id);
          reportsSent++;
        } catch (err) {
          console.error(`Failed to generate report for config ${config.id}:`, err);
        }
      }
    }

    // --- Org-level frequency reports ---
    const orgs = await prisma.organization.findMany({
      select: { id: true, reportFrequencies: true },
    });

    for (const org of orgs) {
      if (!org.reportFrequencies.length) continue;

      for (const frequency of org.reportFrequencies) {
        const record = await prisma.orgReportSendRecord.findUnique({
          where: { organizationId_frequency: { organizationId: org.id, frequency } },
        });

        if (isDueForSending(frequency, record?.lastSentAt ?? null)) {
          try {
            const count = await sendOrgFrequencyReports(org.id, frequency);
            if (count > 0) {
              await prisma.orgReportSendRecord.upsert({
                where: { organizationId_frequency: { organizationId: org.id, frequency } },
                create: { organizationId: org.id, frequency, lastSentAt: new Date() },
                update: { lastSentAt: new Date() },
              });
              reportsSent += count;
            }
          } catch (err) {
            console.error(`[email-reports] Failed org-level ${frequency} for org ${org.id}:`, err);
          }
        }
      }
    }

    if (reportsSent > 0) {
      console.log(`[email-reports] Sent ${reportsSent} report(s)`);
    }
  } catch (err) {
    console.error("[email-reports] Error:", err);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the email report scheduler cron job.
 * Runs daily at 8 AM to check which reports are due.
 */
export function startEmailReportCron(): void {
  // Run immediately on startup to catch any missed reports
  sendScheduledReports();

  // Schedule to run daily at 8 AM
  task = cron.schedule("0 8 * * *", () => {
    sendScheduledReports();
  });

  console.log("[email-reports] Cron scheduled (daily at 8 AM)");
}

/** Stop the cron task (for graceful shutdown). */
export function stopEmailReportCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
