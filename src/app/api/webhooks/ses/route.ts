import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const EXPECTED_TOPIC_ARNS = [
  "arn:aws:sns:eu-west-1:202264955360:trickery-ses-bounces",
  "arn:aws:sns:eu-west-1:202264955360:trickery-ses-complaints",
];

const SNS_FIELDS_BY_TYPE: Record<string, string[]> = {
  Notification: ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"],
  SubscriptionConfirmation: ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"],
  UnsubscribeConfirmation: ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"],
};

interface SnsMessage {
  Type: string;
  TopicArn: string;
  Message: string;
  Signature: string;
  SignatureVersion?: string;
  SigningCertURL?: string;
  SubscribeURL?: string;
  MessageId?: string;
  Subject?: string;
  Timestamp?: string;
  Token?: string;
  [field: string]: string | undefined;
}

interface SesRecipient {
  emailAddress: string;
}

interface SesEvent {
  eventType?: string;
  notificationType?: string;
  bounce?: { bounceType?: string; bouncedRecipients?: SesRecipient[] };
  complaint?: { complainedRecipients?: SesRecipient[] };
}

// Verifies the message actually came from AWS SNS (not a forged POST), per
// https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
async function verifySnsSignature(msg: SnsMessage): Promise<boolean> {
  const certUrl = msg.SigningCertURL as string | undefined;
  if (!certUrl) return false;

  let parsed: URL;
  try {
    parsed = new URL(certUrl);
  } catch {
    return false;
  }
  // Only ever fetch the signing cert from AWS-owned SNS hosts — prevents SSRF / spoofed certs.
  if (parsed.protocol !== "https:" || !/^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(parsed.hostname)) {
    return false;
  }

  const certRes = await fetch(certUrl);
  if (!certRes.ok) return false;
  const cert = await certRes.text();

  const fields = SNS_FIELDS_BY_TYPE[msg.Type] || SNS_FIELDS_BY_TYPE.Notification;
  let stringToSign = "";
  for (const field of fields) {
    if (msg[field] === undefined) continue;
    stringToSign += `${field}\n${msg[field]}\n`;
  }

  const algo = msg.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";
  try {
    return crypto.createVerify(algo).update(stringToSign, "utf8").verify(cert, msg.Signature, "base64");
  } catch {
    return false;
  }
}

async function suppressPermanently(email: string, reason: "bounce" | "complaint") {
  const supabase = getSupabase();
  await supabase
    .from("leads")
    .update({
      suppressed: true,
      suppressed_reason: reason,
      ...(reason === "bounce" ? { bounced_at: new Date().toISOString() } : {}),
    })
    .eq("email", email.toLowerCase());
}

async function recordTransientBounce(email: string) {
  const supabase = getSupabase();
  const { data: rows } = await supabase
    .from("leads")
    .select("bounce_count")
    .eq("email", email.toLowerCase())
    .limit(1);
  if (!rows || rows.length === 0) return;

  const nextCount = (rows[0].bounce_count || 0) + 1;
  const shouldSuppress = nextCount >= 3;

  await supabase
    .from("leads")
    .update({
      bounce_count: nextCount,
      bounced_at: new Date().toISOString(),
      ...(shouldSuppress ? { suppressed: true, suppressed_reason: "bounce" as const } : {}),
    })
    .eq("email", email.toLowerCase());
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let msg: SnsMessage;
  try {
    msg = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validSignature = await verifySnsSignature(msg);
  if (!validSignature) {
    return NextResponse.json({ error: "Invalid SNS signature" }, { status: 403 });
  }

  if (!EXPECTED_TOPIC_ARNS.includes(msg.TopicArn)) {
    return NextResponse.json({ error: "Unexpected topic" }, { status: 403 });
  }

  if (msg.Type === "SubscriptionConfirmation") {
    if (!msg.SubscribeURL) {
      return NextResponse.json({ error: "Missing SubscribeURL" }, { status: 400 });
    }
    await fetch(msg.SubscribeURL);
    return NextResponse.json({ ok: true });
  }

  if (msg.Type !== "Notification") {
    return NextResponse.json({ ok: true });
  }

  let event: SesEvent;
  try {
    event = JSON.parse(msg.Message);
  } catch {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
  }

  const type = event.eventType || event.notificationType;

  if (type === "Bounce") {
    const bounceType = event.bounce?.bounceType;
    const recipients = (event.bounce?.bouncedRecipients || []).map((r) => r.emailAddress);
    await Promise.all(
      recipients.map((email) =>
        bounceType === "Permanent" ? suppressPermanently(email, "bounce") : recordTransientBounce(email)
      )
    );
  } else if (type === "Complaint") {
    const recipients = (event.complaint?.complainedRecipients || []).map((r) => r.emailAddress);
    await Promise.all(recipients.map((email) => suppressPermanently(email, "complaint")));
  }

  return NextResponse.json({ ok: true });
}
