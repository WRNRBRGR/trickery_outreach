import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { sendOutreachEmail } from "@/lib/ses";
import { DEFAULT_TEMPLATES } from "@/lib/constants";
import { replaceVariables } from "@/lib/utils";
import { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Stage = "INTRO" | "SHOWREELS" | "CURTAIN_CALL";

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

interface ParsedPitch {
  stage: Stage;
  subject: string | null;
  body: string | null;
  assigned_color: string | null;
}

// Mirrors the client-side parser in dashboard/[date]/page.tsx — keep in sync.
function parsePitch(raw: string | null): ParsedPitch {
  const defaults: ParsedPitch = { stage: "INTRO", subject: null, body: null, assigned_color: null };
  if (!raw) return defaults;
  try {
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw);
      let stage: Stage = parsed.stage || "INTRO";
      let body = parsed.body || null;
      const subject = parsed.subject || null;
      if (parsed.pitch) {
        const stageMatch = parsed.pitch.match(/^\[(INTRO|SHOWREELS|CURTAIN_CALL)\]/);
        stage = (stageMatch ? stageMatch[1] : "INTRO") as Stage;
        body = body || parsed.pitch.replace(/^\[.*?\]\s*/, "");
      }
      return { stage, subject, body, assigned_color: parsed.assigned_color || null };
    }
  } catch {}
  const stageMatch = raw.match(/^\[(INTRO|SHOWREELS|CURTAIN_CALL)\]/);
  return { ...defaults, stage: (stageMatch ? stageMatch[1] : "INTRO") as Stage };
}

// The advertised "ideal window" throughout the app: 9am-12pm recipient-local.
function isInIdealWindow(timezone: string): boolean {
  try {
    const hour = parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(new Date())
    );
    return hour >= 9 && hour < 12;
  } catch {
    return false;
  }
}

async function sendLead(supabase: ReturnType<typeof getSupabase>, lead: Lead) {
  const { stage, subject: savedSubject, body: savedBody, assigned_color } = parsePitch(lead.ai_pitch);
  const firstName = lead.name.split(" ")[0];
  const companyName = lead.agency || "Independent";

  const template = DEFAULT_TEMPLATES[stage][0];
  const subject = savedSubject || template.subject;
  const body = savedBody || template.body;
  const signature = DEFAULT_TEMPLATES.SIGNATURES[(assigned_color as "indigo" | "rose") || "indigo"] || "";

  const vars = { name: firstName, company: companyName };
  const finalSubject = replaceVariables(subject, vars);
  const finalBody = `Hi ${firstName},\n\n${replaceVariables(body, vars)}\n${signature}`;

  const messageId = await sendOutreachEmail({
    to: lead.email,
    subject: finalSubject,
    body: finalBody,
    assignedColor: assigned_color,
  });

  await supabase
    .from("leads")
    .update({ sent_at: new Date().toISOString(), sent_via: "ses", ses_message_id: messageId || null })
    .eq("id", lead.id);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("key") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const { data: dueLeads, error } = await supabase
    .from("leads")
    .select("*")
    .is("sent_at", null)
    .eq("suppressed", false)
    .lte("scheduled_date", todayStr);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const inWindow = (dueLeads || []).filter((lead) => isInIdealWindow(lead.timezone));
  const results: { id: string; email: string; status: string }[] = [];

  for (const lead of inWindow) {
    try {
      await sendLead(supabase, lead);
      results.push({ id: lead.id, email: lead.email, status: "sent" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      results.push({ id: lead.id, email: lead.email, status: `error: ${message}` });
    }
  }

  return NextResponse.json({
    due: (dueLeads || []).length,
    inWindow: inWindow.length,
    sent: results.filter((r) => r.status === "sent").length,
    results,
  });
}
