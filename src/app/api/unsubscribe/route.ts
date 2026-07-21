import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyUnsubscribeToken } from "@/lib/ses";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function doUnsubscribe(email: string, token: string) {
  if (!email || !token || !verifyUnsubscribeToken(email, token)) return false;
  await supabase
    .from("leads")
    .update({ suppressed: true, suppressed_reason: "unsubscribe" })
    .eq("email", email.toLowerCase());
  return true;
}

function confirmationPage(ok: boolean, email: string) {
  const heading = ok ? "You've been unsubscribed" : "Link invalid or expired";
  const body = ok
    ? `${email} won't receive further emails from Trickery.`
    : "We couldn't process this unsubscribe request.";
  return `<html><body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#333;">
    <h2>${heading}</h2><p>${body}</p>
  </body></html>`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";
  const ok = await doUnsubscribe(email, token);

  return new NextResponse(confirmationPage(ok, email), {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// One-click unsubscribe per RFC 8058 (List-Unsubscribe-Post) — mail clients
// POST here directly instead of rendering the link.
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";
  const ok = await doUnsubscribe(email, token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
