import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { prisma } from "../db.js";

const ses = new SESClient({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const FROM_EMAIL = process.env.SES_FROM_EMAIL || "noreply@athletiq.app";

/**
 * Calculate date range based on report frequency
 */
function getDateRange(frequency: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();

  switch (frequency) {
    case "WEEKLY":
      startDate.setDate(endDate.getDate() - 7);
      break;
    case "MONTHLY":
      startDate.setMonth(endDate.getMonth() - 1);
      break;
    case "QUARTERLY":
      startDate.setMonth(endDate.getMonth() - 3);
      break;
    case "BIANNUALLY":
      startDate.setMonth(endDate.getMonth() - 6);
      break;
    case "ANNUALLY":
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(endDate.getDate() - 7);
  }

  return { startDate, endDate };
}

/**
 * Format date range for display
 */
function formatDateRange(startDate: Date, endDate: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", options)}`;
}

/**
 * Calculate attendance statistics for an athlete
 */
async function calculateAthleteStats(
  athleteId: string,
  organizationId: string,
  startDate: Date,
  endDate: Date
) {
  // Get all check-ins in the date range
  const checkIns = await prisma.checkIn.findMany({
    where: {
      userId: athleteId,
      event: {
        organizationId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    },
    include: {
      event: true,
    },
  });

  // Calculate stats — EXCUSED events are void: excluded from rate but shown in summary
  const onTimeCount = checkIns.filter((c) => c.status === "ON_TIME").length;
  const lateCount = checkIns.filter((c) => c.status === "LATE").length;
  const absentCount = checkIns.filter((c) => c.status === "ABSENT").length;
  const excusedCount = checkIns.filter((c) => c.status === "EXCUSED").length;
  const scheduledEvents = checkIns.filter((c) => c.status !== "EXCUSED");
  const totalEvents = scheduledEvents.length;

  const attendedCount = onTimeCount + lateCount;
  const attendanceRate = totalEvents > 0 ? (attendedCount / totalEvents) * 100 : 0;

  const totalHours = checkIns
    .filter((c) => c.hoursLogged !== null)
    .reduce((sum, c) => sum + (c.hoursLogged || 0), 0);

  return {
    totalEvents,
    onTimeCount,
    lateCount,
    absentCount,
    excusedCount,
    attendanceRate,
    totalHours,
  };
}

/**
 * Get upcoming events for an athlete
 */
async function getUpcomingEvents(athleteId: string, organizationId: string) {
  // Get athlete's teams
  const teamMemberships = await prisma.teamMember.findMany({
    where: { userId: athleteId },
    select: { teamId: true },
  });

  const teamIds = teamMemberships.map((m) => m.teamId);

  if (teamIds.length === 0) {
    return [];
  }

  // Get upcoming events (next 7 days)
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);

  const events = await prisma.event.findMany({
    where: {
      organizationId,
      teamId: { in: teamIds },
      date: {
        gte: now,
        lte: sevenDaysFromNow,
      },
    },
    orderBy: { date: "asc" },
    take: 5,
  });

  return events;
}

/**
 * Generate and send guardian email report
 */
export async function generateGuardianReport(configId: string): Promise<void> {
  try {
    // Get report config
    const config = await prisma.emailReportConfig.findUnique({
      where: { id: configId },
      include: {
        user: true,
        organization: true,
      },
    });

    if (!config) {
      throw new Error(`Email report config ${configId} not found`);
    }

    if (!config.enabled) {
      console.log(`Report config ${configId} is disabled, skipping`);
      return;
    }

    // Get guardian's linked athletes in this organization
    const guardianLinks = await prisma.guardianLink.findMany({
      where: {
        guardianId: config.userId,
        organizationId: config.organizationId,
      },
      include: {
        athlete: true,
      },
    });

    if (guardianLinks.length === 0) {
      console.log(`No athletes linked for guardian ${config.userId} in org ${config.organizationId}`);
      return;
    }

    // Calculate date range
    const { startDate, endDate } = getDateRange(config.frequency);
    const dateRangeText = formatDateRange(startDate, endDate);

    // Generate stats for each athlete
    const athleteReports = await Promise.all(
      guardianLinks.map(async (link) => {
        const stats = await calculateAthleteStats(
          link.athleteId,
          config.organizationId,
          startDate,
          endDate
        );

        const upcomingEvents = await getUpcomingEvents(
          link.athleteId,
          config.organizationId
        );

        return {
          athlete: link.athlete,
          stats,
          upcomingEvents,
        };
      })
    );

    // Generate HTML email
    const athleteReportsHTML = athleteReports
      .map(
        (report) => `
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #374151;">
              <h3 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#ffffff;">
                ${report.athlete.firstName} ${report.athlete.lastName}
              </h3>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="padding:4px 0;font-size:14px;color:#9ca3af;width:140px;">Attendance Rate</td>
                  <td style="padding:4px 0;font-size:14px;color:#d1d5db;font-weight:600;">
                    ${report.stats.attendanceRate.toFixed(1)}%
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:14px;color:#9ca3af;">Total Events</td>
                  <td style="padding:4px 0;font-size:14px;color:#d1d5db;">${report.stats.totalEvents}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:14px;color:#9ca3af;">On Time</td>
                  <td style="padding:4px 0;font-size:14px;color:#10b981;">${report.stats.onTimeCount}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:14px;color:#9ca3af;">Late</td>
                  <td style="padding:4px 0;font-size:14px;color:#f59e0b;">${report.stats.lateCount}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:14px;color:#9ca3af;">Absent</td>
                  <td style="padding:4px 0;font-size:14px;color:#ef4444;">${report.stats.absentCount}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:14px;color:#9ca3af;">Excused</td>
                  <td style="padding:4px 0;font-size:14px;color:#6b7280;">${report.stats.excusedCount}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:14px;color:#9ca3af;">Hours Logged</td>
                  <td style="padding:4px 0;font-size:14px;color:#a78bfa;font-weight:600;">
                    ${report.stats.totalHours.toFixed(1)} hrs
                  </td>
                </tr>
              </table>

              ${report.upcomingEvents.length > 0 ? `
              <div style="background-color:#111827;border-radius:8px;padding:12px;border:1px solid #374151;">
                <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;font-weight:600;">Upcoming Events</p>
                ${report.upcomingEvents.map((event) => {
                  const eventDate = new Date(event.date);
                  const dateStr = eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  return `
                  <div style="margin-bottom:6px;">
                    <p style="margin:0;font-size:13px;color:#d1d5db;">
                      <strong>${dateStr}</strong> - ${event.title} @ ${event.startTime}
                    </p>
                  </div>
                  `;
                }).join("")}
              </div>
              ` : ""}
            </td>
          </tr>
        `
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111827;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#1f2937;border-radius:12px;border:1px solid #374151;">
          <tr>
            <td style="padding:32px 32px 24px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;">${config.organization.name}</h1>
              <p style="margin:0;font-size:14px;color:#9ca3af;">Attendance Report</p>
              <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">${dateRangeText}</p>
            </td>
          </tr>
          ${athleteReportsHTML}
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #374151;">
              <p style="margin:0;font-size:12px;color:#6b7280;">
                You're receiving this ${config.frequency.toLowerCase()} report because you're a guardian in ${config.organization.name}.
                You can manage your email preferences in the web app.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = `${config.organization.name} - Attendance Report (${dateRangeText})\n\n${athleteReports.map((report) => `${report.athlete.firstName} ${report.athlete.lastName}:\n- Attendance Rate: ${report.stats.attendanceRate.toFixed(1)}%\n- Total Events: ${report.stats.totalEvents}\n- On Time: ${report.stats.onTimeCount} | Late: ${report.stats.lateCount} | Absent: ${report.stats.absentCount} | Excused: ${report.stats.excusedCount}\n- Hours Logged: ${report.stats.totalHours.toFixed(1)} hrs`).join("\n\n")}`;

    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [config.user.email] },
      Message: {
        Subject: {
          Data: `${config.organization.name} - ${config.frequency.charAt(0) + config.frequency.slice(1).toLowerCase()} Attendance Report`,
        },
        Body: {
          Html: { Data: html },
          Text: { Data: text },
        },
      },
    });

    await ses.send(command);

    // Log delivery
    await prisma.notificationDelivery.create({
      data: {
        userId: config.userId,
        type: "EMAIL_REPORT",
        channel: "EMAIL",
        title: `${config.frequency} Attendance Report`,
        message: `Report for ${athleteReports.length} athlete(s) in ${config.organization.name}`,
        status: "SENT",
        sentAt: new Date(),
        metadata: {
          configId: config.id,
          athleteCount: athleteReports.length,
          dateRange: { startDate, endDate },
        },
      },
    });

    // Update lastSentAt
    await prisma.emailReportConfig.update({
      where: { id: configId },
      data: { lastSentAt: new Date() },
    });

    console.log(`Guardian report sent to ${config.user.email} for config ${configId}`);
  } catch (error) {
    console.error(`Error generating guardian report for config ${configId}:`, error);
    throw error;
  }
}

/**
 * Generate and send an org-level frequency report to a single guardian.
 * Used when an org admin enables report frequencies org-wide.
 */
async function generateOrgReportForGuardian(
  guardian: { id: string; email: string; firstName: string; lastName: string },
  org: { id: string; name: string },
  frequency: string
): Promise<void> {
  // Get guardian's linked athletes in this organization
  const guardianLinks = await prisma.guardianLink.findMany({
    where: { guardianId: guardian.id, organizationId: org.id },
    include: { athlete: true },
  });

  if (guardianLinks.length === 0) return;

  const { startDate, endDate } = getDateRange(frequency);
  const dateRangeText = formatDateRange(startDate, endDate);
  const frequencyLabel = frequency.charAt(0) + frequency.slice(1).toLowerCase().replace("_", "-");

  const athleteReports = await Promise.all(
    guardianLinks.map(async (link) => {
      const stats = await calculateAthleteStats(link.athleteId, org.id, startDate, endDate);
      const upcomingEvents = await getUpcomingEvents(link.athleteId, org.id);
      return { athlete: link.athlete, stats, upcomingEvents };
    })
  );

  const athleteReportsHTML = athleteReports
    .map(
      (report) => `
        <tr>
          <td style="padding:24px 32px;border-top:1px solid #374151;">
            <h3 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#ffffff;">
              ${report.athlete.firstName} ${report.athlete.lastName}
            </h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr>
                <td style="padding:4px 0;font-size:14px;color:#9ca3af;width:140px;">Attendance Rate</td>
                <td style="padding:4px 0;font-size:14px;color:#d1d5db;font-weight:600;">${report.stats.attendanceRate.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:14px;color:#9ca3af;">Total Events</td>
                <td style="padding:4px 0;font-size:14px;color:#d1d5db;">${report.stats.totalEvents}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:14px;color:#9ca3af;">On Time</td>
                <td style="padding:4px 0;font-size:14px;color:#10b981;">${report.stats.onTimeCount}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:14px;color:#9ca3af;">Late</td>
                <td style="padding:4px 0;font-size:14px;color:#f59e0b;">${report.stats.lateCount}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:14px;color:#9ca3af;">Absent</td>
                <td style="padding:4px 0;font-size:14px;color:#ef4444;">${report.stats.absentCount}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:14px;color:#9ca3af;">Excused</td>
                <td style="padding:4px 0;font-size:14px;color:#6b7280;">${report.stats.excusedCount}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:14px;color:#9ca3af;">Hours Logged</td>
                <td style="padding:4px 0;font-size:14px;color:#a78bfa;font-weight:600;">${report.stats.totalHours.toFixed(1)} hrs</td>
              </tr>
            </table>
            ${report.upcomingEvents.length > 0 ? `
            <div style="background-color:#111827;border-radius:8px;padding:12px;border:1px solid #374151;">
              <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;font-weight:600;">Upcoming Events</p>
              ${report.upcomingEvents.map((event) => {
                const dateStr = new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                return `<div style="margin-bottom:6px;"><p style="margin:0;font-size:13px;color:#d1d5db;"><strong>${dateStr}</strong> - ${event.title} @ ${event.startTime}</p></div>`;
              }).join("")}
            </div>` : ""}
          </td>
        </tr>
      `
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111827;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#1f2937;border-radius:12px;border:1px solid #374151;">
        <tr>
          <td style="padding:32px 32px 24px;">
            <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;">${org.name}</h1>
            <p style="margin:0;font-size:14px;color:#9ca3af;">Attendance Report</p>
            <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">${dateRangeText}</p>
          </td>
        </tr>
        ${athleteReportsHTML}
        <tr>
          <td style="padding:24px 32px;border-top:1px solid #374151;">
            <p style="margin:0;font-size:12px;color:#6b7280;">
              You're receiving this ${frequencyLabel.toLowerCase()} report because you're a guardian in ${org.name}.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${org.name} - Attendance Report (${dateRangeText})\n\n${athleteReports.map((r) => `${r.athlete.firstName} ${r.athlete.lastName}:\n- Attendance Rate: ${r.stats.attendanceRate.toFixed(1)}%\n- Total Events: ${r.stats.totalEvents}\n- On Time: ${r.stats.onTimeCount} | Late: ${r.stats.lateCount} | Absent: ${r.stats.absentCount} | Excused: ${r.stats.excusedCount}\n- Hours Logged: ${r.stats.totalHours.toFixed(1)} hrs`).join("\n\n")}`;

  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [guardian.email] },
    Message: {
      Subject: { Data: `${org.name} - ${frequencyLabel} Attendance Report` },
      Body: {
        Html: { Data: html },
        Text: { Data: text },
      },
    },
  });

  await ses.send(command);

  await prisma.notificationDelivery.create({
    data: {
      userId: guardian.id,
      type: "EMAIL_REPORT",
      channel: "EMAIL",
      title: `${frequencyLabel} Attendance Report`,
      message: `Report for ${athleteReports.length} athlete(s) in ${org.name}`,
      status: "SENT",
      sentAt: new Date(),
      metadata: {
        organizationId: org.id,
        frequency,
        athleteCount: athleteReports.length,
        dateRange: { startDate, endDate },
      },
    },
  });

  console.log(`Org-level ${frequency} report sent to ${guardian.email} (org: ${org.id})`);
}

/**
 * Send org-level frequency reports to all guardians with linked athletes.
 * Called by the scheduler for each enabled org frequency.
 * Returns the number of reports sent.
 */
export async function sendOrgFrequencyReports(
  organizationId: string,
  frequency: string
): Promise<number> {
  // Find all guardians in the org
  const guardianMembers = await prisma.organizationMember.findMany({
    where: { organizationId, role: "GUARDIAN" },
    include: { user: true, organization: true },
  });

  if (guardianMembers.length === 0) return 0;

  const org = guardianMembers[0].organization;
  let sent = 0;

  for (const member of guardianMembers) {
    try {
      await generateOrgReportForGuardian(member.user, { id: org.id, name: org.name }, frequency);
      sent++;
    } catch (err) {
      console.error(`Failed to send org report to guardian ${member.userId}:`, err);
    }
  }

  return sent;
}
