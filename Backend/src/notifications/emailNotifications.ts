import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const FROM_EMAIL = process.env.SES_FROM_EMAIL || "noreply@athletiq.app";

/**
 * Send an announcement email
 */
export async function sendAnnouncementEmail(
  email: string,
  title: string,
  message: string,
  orgName: string
): Promise<void> {
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
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;">${orgName}</h1>
              <p style="margin:0;font-size:14px;color:#9ca3af;">New Announcement</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#ffffff;">${title}</h2>
              <div style="background-color:#111827;border-radius:8px;padding:16px;border:1px solid #374151;">
                <p style="margin:0;font-size:15px;color:#d1d5db;line-height:1.6;white-space:pre-wrap;">${message}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0;font-size:12px;color:#6b7280;">
                You're receiving this because you're a member of ${orgName}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${orgName} - ${title}\n\n${message}`;

  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: `[${orgName}] ${title}` },
      Body: {
        Html: { Data: html },
        Text: { Data: text },
      },
    },
  });

  await ses.send(command);
}

/**
 * Send an event reminder email
 */
export async function sendEventReminderEmail(
  email: string,
  eventTitle: string,
  eventDate: string,
  startTime: string,
  location: string | null
): Promise<void> {
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
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;">Athletiq</h1>
              <p style="margin:0;font-size:14px;color:#9ca3af;">Event Reminder</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#ffffff;">${eventTitle}</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="padding:8px 0;font-size:13px;color:#9ca3af;width:80px;">Date</td>
                  <td style="padding:8px 0;font-size:15px;color:#d1d5db;">${eventDate}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:13px;color:#9ca3af;width:80px;">Time</td>
                  <td style="padding:8px 0;font-size:15px;color:#d1d5db;">${startTime}</td>
                </tr>
                ${location ? `
                <tr>
                  <td style="padding:8px 0;font-size:13px;color:#9ca3af;width:80px;">Location</td>
                  <td style="padding:8px 0;font-size:15px;color:#d1d5db;">${location}</td>
                </tr>
                ` : ""}
              </table>
              <p style="margin:0;font-size:15px;color:#d1d5db;">
                Don't forget to check in when you arrive!
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0;font-size:12px;color:#6b7280;">
                You can manage your notification preferences in the app.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Event Reminder: ${eventTitle}\n\nDate: ${eventDate}\nTime: ${startTime}${location ? `\nLocation: ${location}` : ""}\n\nDon't forget to check in when you arrive!`;

  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: `Reminder: ${eventTitle}` },
      Body: {
        Html: { Data: html },
        Text: { Data: text },
      },
    },
  });

  await ses.send(command);
}

/**
 * Send an excuse status update email
 */
export async function sendExcuseStatusEmail(
  email: string,
  status: "APPROVED" | "DENIED",
  eventTitle: string,
  reason?: string
): Promise<void> {
  const isApproved = status === "APPROVED";
  const statusColor = isApproved ? "#10b981" : "#ef4444";
  const statusText = isApproved ? "Approved" : "Denied";

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
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;">Athletiq</h1>
              <p style="margin:0;font-size:14px;color:#9ca3af;">Excuse Request Update</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;">
                Your excuse request for <strong style="color:#ffffff;">${eventTitle}</strong> has been <strong style="color:${statusColor};">${statusText}</strong>.
              </p>
              ${reason ? `
              <div style="background-color:#111827;border-radius:8px;padding:16px;border:1px solid #374151;">
                <p style="margin:0;font-size:13px;color:#9ca3af;margin-bottom:8px;">Reason:</p>
                <p style="margin:0;font-size:15px;color:#d1d5db;line-height:1.6;white-space:pre-wrap;">${reason}</p>
              </div>
              ` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0;font-size:12px;color:#6b7280;">
                You can view your attendance history in the app.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Your excuse request for ${eventTitle} has been ${statusText}.${reason ? `\n\nReason: ${reason}` : ""}`;

  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: `Excuse Request ${statusText}: ${eventTitle}` },
      Body: {
        Html: { Data: html },
        Text: { Data: text },
      },
    },
  });

  await ses.send(command);
}
