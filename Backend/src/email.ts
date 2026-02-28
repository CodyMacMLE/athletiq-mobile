import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { createCircuitBreaker } from "./utils/circuitBreaker.js";

const ses = new SESClient({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// Circuit breaker for SES — open after repeated failures, recover after 30s
const sesBreaker = createCircuitBreaker(
  (command: SendEmailCommand) => ses.send(command),
  "SES"
);

const FROM_EMAIL = process.env.SES_FROM_EMAIL || "noreply@athletiq.app";
const APP_URL = process.env.APP_URL || "https://athletiq.fitness";
const APP_SCHEME = process.env.APP_SCHEME || "athletiq";

export async function sendInviteEmail({
  to,
  organizationName,
  role,
  token,
}: {
  to: string;
  organizationName: string;
  role: string;
  token: string;
}) {
  const inviteUrl = `${APP_URL}/invite?token=${token}`;
  const roleName = role.charAt(0) + role.slice(1).toLowerCase();
  const isMobileRole = role === "ATHLETE" || role === "GUARDIAN";

  let html: string;
  let text: string;

  if (isMobileRole) {
    // Athletes and guardians use the mobile app
    html = `
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
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#1f2937;border-radius:12px;border:1px solid #374151;">
          <tr>
            <td style="padding:32px 32px 24px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;">Athletiq</h1>
              <p style="margin:0;font-size:14px;color:#9ca3af;">You've been invited to join an organization</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;">
                You've been invited to join <strong style="color:#ffffff;">${organizationName}</strong> as a <strong style="color:#a78bfa;">${roleName}</strong>.
              </p>
              <p style="margin:0 0 8px;font-size:15px;color:#d1d5db;font-weight:600;">
                To get started:
              </p>
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:6px 0;font-size:15px;color:#d1d5db;">
                    1. Download the <strong style="color:#ffffff;">Athletiq</strong> app
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:15px;color:#d1d5db;">
                    2. Create your account using this email address
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:15px;color:#d1d5db;">
                    3. Sign in — your invitation will be accepted automatically
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <span style="display:inline-block;padding:12px 32px;background-color:#374151;color:#9ca3af;font-size:15px;font-weight:600;border-radius:8px;">
                      App Store &mdash; Coming Soon
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <span style="display:inline-block;padding:12px 32px;background-color:#374151;color:#9ca3af;font-size:15px;font-weight:600;border-radius:8px;">
                      Google Play &mdash; Coming Soon
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0;font-size:12px;color:#6b7280;">
                This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    text = `You've been invited to join ${organizationName} as a ${roleName}.\n\nTo get started:\n1. Download the Athletiq app\n2. Create your account using this email address\n3. Sign in — your invitation will be accepted automatically\n\nThis invitation expires in 7 days.`;
  } else {
    // Coaches, managers, owners use the web
    html = `
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
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#1f2937;border-radius:12px;border:1px solid #374151;">
          <tr>
            <td style="padding:32px 32px 24px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;">Athletiq</h1>
              <p style="margin:0;font-size:14px;color:#9ca3af;">You've been invited to join an organization</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;">
                You've been invited to join <strong style="color:#ffffff;">${organizationName}</strong> as a <strong style="color:#a78bfa;">${roleName}</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#d1d5db;">
                Click the button below to accept the invitation and get started.
              </p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}" style="display:inline-block;padding:12px 32px;background-color:#7c3aed;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0;font-size:12px;color:#6b7280;">
                This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#6b7280;word-break:break-all;">
                ${inviteUrl}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    text = `You've been invited to join ${organizationName} as a ${roleName}.\n\nAccept your invitation: ${inviteUrl}\n\nThis invitation expires in 7 days.`;
  }

  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: `You're invited to join ${organizationName} on Athletiq` },
      Body: {
        Html: { Data: html },
        Text: { Data: text },
      },
    },
  });

  await sesBreaker.fire(command);
}

export async function sendFeedbackEmail({
  userEmail,
  userName,
  category,
  message,
}: {
  userEmail: string;
  userName: string;
  category: string;
  message: string;
}) {
  const categoryLabel = category.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

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
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#1f2937;border-radius:12px;border:1px solid #374151;">
          <tr>
            <td style="padding:32px 32px 24px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;">Athletiq Feedback</h1>
              <p style="margin:0;font-size:14px;color:#9ca3af;">New ${categoryLabel} submission</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="padding:8px 0;font-size:13px;color:#9ca3af;width:80px;">From</td>
                  <td style="padding:8px 0;font-size:15px;color:#d1d5db;">${userName} &lt;${userEmail}&gt;</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:13px;color:#9ca3af;width:80px;">Category</td>
                  <td style="padding:8px 0;font-size:15px;color:#a78bfa;font-weight:600;">${categoryLabel}</td>
                </tr>
              </table>
              <div style="background-color:#111827;border-radius:8px;padding:16px;border:1px solid #374151;">
                <p style="margin:0;font-size:15px;color:#d1d5db;line-height:1.6;white-space:pre-wrap;">${message}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0;font-size:12px;color:#6b7280;">
                Reply directly to this email to respond to the user at ${userEmail}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `New ${categoryLabel} from ${userName} (${userEmail}):\n\n${message}`;

  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [FROM_EMAIL] },
    ReplyToAddresses: [userEmail],
    Message: {
      Subject: { Data: `[Athletiq ${categoryLabel}] from ${userName}` },
      Body: {
        Html: { Data: html },
        Text: { Data: text },
      },
    },
  });

  await sesBreaker.fire(command);
}
