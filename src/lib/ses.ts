import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import crypto from "crypto";

const client = new SESv2Client({
  region: process.env.AWS_SES_REGION,
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY!,
  },
});

const CONFIGURATION_SET = "trickery-outreach";

const SENDERS: Record<string, { email: string; name: string }> = {
  indigo: { email: "werner@contact.trickery.co.za", name: "Werner" },
  rose: { email: "louis@contact.trickery.co.za", name: "Louis" },
};

export function getSenderForColor(assignedColor: string | null) {
  return SENDERS[assignedColor || "indigo"] || SENDERS.indigo;
}

export function getUnsubscribeToken(email: string) {
  return crypto
    .createHmac("sha256", process.env.UNSUB_SECRET!)
    .update(email.toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string) {
  const expected = getUnsubscribeToken(email);
  const a = Buffer.from(expected);
  const b = Buffer.from(token || "");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function sendOutreachEmail({
  to,
  subject,
  body,
  assignedColor,
}: {
  to: string;
  subject: string;
  body: string;
  assignedColor: string | null;
}) {
  const sender = getSenderForColor(assignedColor);
  const token = getUnsubscribeToken(to);
  const unsubUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/unsubscribe?email=${encodeURIComponent(to)}&token=${token}`;

  const command = new SendEmailCommand({
    FromEmailAddress: `${sender.name} at Trickery <${sender.email}>`,
    Destination: { ToAddresses: [to] },
    ConfigurationSetName: CONFIGURATION_SET,
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Text: {
            Data: `${body}\n\n---\nDon't want these emails? Unsubscribe: ${unsubUrl}`,
            Charset: "UTF-8",
          },
        },
        Headers: [
          {
            Name: "List-Unsubscribe",
            Value: `<mailto:${sender.email}?subject=unsubscribe>, <${unsubUrl}>`,
          },
          { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
        ],
      },
    },
  });

  const result = await client.send(command);
  return result.MessageId;
}
