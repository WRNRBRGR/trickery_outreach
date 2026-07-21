"use server";

import { sendOutreachEmail } from "@/lib/ses";

export async function sendViaSes(
  to: string,
  subject: string,
  body: string,
  assignedColor: string | null
) {
  try {
    const messageId = await sendOutreachEmail({ to, subject, body, assignedColor });
    return { success: true, messageId };
  } catch (error) {
    console.error("SES send error:", error);
    const err = error as { name?: string; message?: string };
    const msg = err?.message || "Unknown error";
    if (err?.name === "MessageRejected" || msg.includes("Email address is not verified")) {
      return {
        success: false,
        error: "SES sandbox: this address isn't verified. Production access is pending — use 'Open in Gmail' for now.",
      };
    }
    if (err?.name === "AccessDenied" || msg.includes("not authorized")) {
      return { success: false, error: "AWS credentials missing or invalid. Check AWS_SES_* env vars." };
    }
    return { success: false, error: `Send failed: ${msg.substring(0, 150)}` };
  }
}
