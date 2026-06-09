import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const partner = searchParams.get("partner"); // 'indigo' (Werner) or 'rose' (Louis)

  // Basic security check
  if (key !== "trickery-outreach-secret") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Get date range (30 days ago to 60 days from now)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 60);

  const { data, error } = await supabase
    .from("leads")
    .select("scheduled_date, sent_at, ai_pitch")
    .gte("scheduled_date", startDate.toISOString().split('T')[0])
    .lte("scheduled_date", endDate.toISOString().split('T')[0]);

  if (error) {
    return new NextResponse("Error fetching leads", { status: 500 });
  }

  // Helper to parse pitch and get partner color
  const getPartnerColor = (raw: string | null) => {
    if (!raw) return null;
    try {
      if (raw.startsWith("{")) {
        const parsed = JSON.parse(raw);
        return parsed.assigned_color || null;
      }
    } catch {}
    return null;
  };

  // Group by date and count unsent
  const counts: Record<string, { total: number; sent: number }> = {};
  
  data?.forEach((lead) => {
    const leadPartner = getPartnerColor(lead.ai_pitch);
    
    // Filter by partner if specified
    if (partner && leadPartner !== partner) {
      return;
    }

    if (!counts[lead.scheduled_date]) {
      counts[lead.scheduled_date] = { total: 0, sent: 0 };
    }
    counts[lead.scheduled_date].total++;
    if (lead.sent_at) {
      counts[lead.scheduled_date].sent++;
    }
  });

  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  
  const partnerName = partner === 'rose' ? 'Louis' : partner === 'indigo' ? 'Werner' : 'Total';

  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trickery Outreach//NONSGML v1.0//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Trickery Outreach (${partnerName})`,
    "X-WR-TIMEZONE:Africa/Johannesburg",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  Object.entries(counts).forEach(([date, stats]) => {
    const dateStr = date.replace(/-/g, ""); // YYYYMMDD
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split('T')[0].replace(/-/g, "");

    const remaining = stats.total - stats.sent;
    
    if (stats.total > 0) {
      ics.push("BEGIN:VEVENT");
      ics.push(`UID:trickery-${partner || 'all'}-${date}@outreach.console`);
      ics.push(`DTSTAMP:${now}`);
      ics.push(`DTSTART;VALUE=DATE:${dateStr}`);
      ics.push(`DTEND;VALUE=DATE:${nextDateStr}`);
      
      if (remaining > 0) {
        ics.push(`SUMMARY:📧 ${remaining} mails to send (${partnerName})`);
        ics.push(`DESCRIPTION:You (${partnerName}) have ${remaining} emails pending out of ${stats.total} scheduled for today.`);
      } else {
        ics.push(`SUMMARY:✅ Done for today (${partnerName})`);
        ics.push(`DESCRIPTION:Great job! All ${stats.total} emails for today have been sent.`);
      }
      
      ics.push("STATUS:CONFIRMED");
      ics.push("TRANSP:TRANSPARENT");
      ics.push("END:VEVENT");
    }
  });

  ics.push("END:VCALENDAR");

  return new NextResponse(ics.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="outreach.ics"',
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
    },
  });
}
