"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database";
import { format, subDays, startOfDay } from "date-fns";
import { Loader2, Send, CheckCircle2, AlertTriangle, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const STAGES = ["INTRO", "SHOWREELS", "CURTAIN_CALL"] as const;
const STAGE_LABELS: Record<string, string> = {
  INTRO: "Intro",
  SHOWREELS: "Showreels",
  CURTAIN_CALL: "Curtain Call",
};

// Fixed status hues — validated against both light/dark surfaces, never re-themed.
// Paired with icon + label everywhere they're used (color alone isn't CVD-safe for red/green).
const STATUS = {
  good: "#0ca30c",
  critical: "#d03b3b",
};

// Single-hue sequential ramp for the volume trend (light/dark step of the same hue).
const SEQUENTIAL = { light: "#2a78d6", dark: "#3987e5" };

function getStage(pitch: string | null): string {
  if (!pitch) return "INTRO";
  try {
    if (pitch.startsWith("{")) {
      const data = JSON.parse(pitch);
      if (data.stage) return data.stage;
    }
  } catch {}
  const match = pitch.match(/^\[(INTRO|SHOWREELS|CURTAIN_CALL)\]/);
  return match ? match[1] : "INTRO";
}

function outcome(lead: Lead): "delivered" | "bounced" | "pending" {
  if (lead.suppressed_reason === "bounce" || lead.suppressed_reason === "complaint") return "bounced";
  if (lead.delivered_at) return "delivered";
  return "pending";
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tone?: "good" | "critical";
}) {
  return (
    <div className="glass-panel py-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">{label}</span>
        <Icon
          className="h-4 w-4"
          style={{ color: tone === "good" ? STATUS.good : tone === "critical" ? STATUS.critical : "var(--muted)" }}
        />
      </div>
      <div className="text-3xl font-black text-[var(--foreground)]">{value}</div>
      {sub && <div className="text-xs text-[var(--muted)] mt-1">{sub}</div>}
    </div>
  );
}

function StageBreakdown({ leads }: { leads: Lead[] }) {
  const sent = leads.filter((l) => l.sent_at);
  const rows = STAGES.map((stage) => {
    const stageLeads = sent.filter((l) => getStage(l.ai_pitch) === stage);
    const delivered = stageLeads.filter((l) => outcome(l) === "delivered").length;
    const bounced = stageLeads.filter((l) => outcome(l) === "bounced").length;
    const pending = stageLeads.length - delivered - bounced;
    return { stage, total: stageLeads.length, delivered, bounced, pending };
  });

  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div className="glass-panel space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--foreground)]">Delivery by Stage</h3>
        <div className="flex items-center space-x-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
          <span className="flex items-center space-x-1.5">
            <span className="inline-block w-3 h-[2px] rounded" style={{ backgroundColor: STATUS.good }} />
            <span>Delivered</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="inline-block w-3 h-[2px] rounded" style={{ backgroundColor: STATUS.critical }} />
            <span>Bounced</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="inline-block w-3 h-[2px] rounded bg-[var(--border)]" />
            <span>Pending</span>
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.stage} className="flex items-center space-x-4">
            <span className="w-24 shrink-0 text-xs font-bold text-[var(--foreground)]">
              {STAGE_LABELS[row.stage]}
            </span>
            <div
              className="flex-1 flex h-[22px] gap-[2px]"
              style={{ width: `${Math.max(4, (row.total / maxTotal) * 100)}%` }}
            >
              {row.delivered > 0 && (
                <div
                  className="group relative h-full rounded-l-[4px]"
                  style={{
                    width: `${(row.delivered / row.total) * 100}%`,
                    backgroundColor: STATUS.good,
                    borderRadius: row.bounced === 0 && row.pending === 0 ? "4px" : undefined,
                  }}
                >
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap rounded-md bg-[var(--foreground)] text-[var(--background)] text-[10px] font-bold px-2 py-1 z-10">
                    Delivered: {row.delivered}
                  </div>
                </div>
              )}
              {row.bounced > 0 && (
                <div
                  className="group relative h-full"
                  style={{
                    width: `${(row.bounced / row.total) * 100}%`,
                    backgroundColor: STATUS.critical,
                    borderRadius: row.delivered === 0 && row.pending === 0 ? "4px" : undefined,
                  }}
                >
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap rounded-md bg-[var(--foreground)] text-[var(--background)] text-[10px] font-bold px-2 py-1 z-10">
                    Bounced: {row.bounced}
                  </div>
                </div>
              )}
              {row.pending > 0 && (
                <div
                  className="group relative h-full bg-[var(--border)] rounded-r-[4px]"
                  style={{ width: `${(row.pending / row.total) * 100}%` }}
                >
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap rounded-md bg-[var(--foreground)] text-[var(--background)] text-[10px] font-bold px-2 py-1 z-10">
                    Pending: {row.pending}
                  </div>
                </div>
              )}
              {row.total === 0 && <div className="h-full w-full rounded-[4px] bg-[var(--border)]/40" />}
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-bold text-[var(--muted)]">{row.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VolumeTrend({ leads, isDark }: { leads: Lead[]; isDark: boolean }) {
  const days = Array.from({ length: 14 }, (_, i) => startOfDay(subDays(new Date(), 13 - i)));
  const counts = days.map((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return {
      date: day,
      count: leads.filter((l) => l.sent_at && l.sent_at.startsWith(dayStr)).length,
    };
  });
  const max = Math.max(1, ...counts.map((c) => c.count));
  const peakIdx = counts.reduce((best, c, i) => (c.count > counts[best].count ? i : best), 0);
  const color = isDark ? SEQUENTIAL.dark : SEQUENTIAL.light;

  return (
    <div className="glass-panel space-y-5">
      <h3 className="text-sm font-bold text-[var(--foreground)]">Emails Sent — Last 14 Days</h3>
      <div className="flex items-end h-32 gap-2">
        {counts.map((c, i) => (
          <div key={i} className="group relative flex-1 flex flex-col items-center justify-end h-full">
            {(i === peakIdx || i === counts.length - 1) && c.count > 0 && (
              <span className="text-[10px] font-bold text-[var(--muted)] mb-1">{c.count}</span>
            )}
            <div
              className="w-full max-w-[24px] rounded-t-[4px] transition-opacity group-hover:opacity-80"
              style={{
                height: `${Math.max(2, (c.count / max) * 100)}%`,
                backgroundColor: c.count > 0 ? color : "var(--border)",
              }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap rounded-md bg-[var(--foreground)] text-[var(--background)] text-[10px] font-bold px-2 py-1 z-10">
              {format(c.date, "MMM d")}: {c.count}
            </div>
            <span className="text-[9px] text-[var(--muted)] mt-2">{format(c.date, "d")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("leads").select("*");
      if (!error) setLeads(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading || !mounted) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  const sent = leads.filter((l) => l.sent_at);
  const delivered = leads.filter((l) => l.delivered_at).length;
  const bounced = leads.filter((l) => l.suppressed_reason === "bounce").length;
  const complained = leads.filter((l) => l.suppressed_reason === "complaint").length;
  const unsubscribed = leads.filter((l) => l.suppressed_reason === "unsubscribe").length;
  const totalSent = sent.length;

  const pct = (n: number) => (totalSent === 0 ? "—" : `${Math.round((n / totalSent) * 100)}%`);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Analytics</h1>
        <p className="mt-2 text-[var(--muted)]">Delivery performance across your outreach campaigns.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatTile label="Total Sent" value={String(totalSent)} icon={Send} />
        <StatTile
          label="Delivered"
          value={String(delivered)}
          sub={pct(delivered)}
          icon={CheckCircle2}
          tone="good"
        />
        <StatTile label="Bounced" value={String(bounced)} sub={pct(bounced)} icon={AlertTriangle} tone="critical" />
        <StatTile
          label="Complained / Unsubscribed"
          value={String(complained + unsubscribed)}
          sub={`${complained} complained · ${unsubscribed} unsubscribed`}
          icon={Ban}
        />
      </div>

      <StageBreakdown leads={leads} />
      <VolumeTrend leads={leads} isDark={theme === "dark"} />

      <div className={cn("glass-panel", totalSent === 0 && "text-center text-[var(--muted)] text-sm py-12")}>
        {totalSent === 0 ? (
          <p>No emails sent yet — numbers will show up here once you start sending.</p>
        ) : (
          <>
            <h3 className="text-sm font-bold text-[var(--foreground)] mb-4">Stage Detail</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="py-2 pr-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Stage</th>
                    <th className="py-2 pr-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Sent</th>
                    <th className="py-2 pr-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Delivered</th>
                    <th className="py-2 pr-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Bounced</th>
                    <th className="py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {STAGES.map((stage) => {
                    const stageLeads = sent.filter((l) => getStage(l.ai_pitch) === stage);
                    const d = stageLeads.filter((l) => outcome(l) === "delivered").length;
                    const b = stageLeads.filter((l) => outcome(l) === "bounced").length;
                    return (
                      <tr key={stage}>
                        <td className="py-2 pr-4 font-bold">{STAGE_LABELS[stage]}</td>
                        <td className="py-2 pr-4">{stageLeads.length}</td>
                        <td className="py-2 pr-4">{d}</td>
                        <td className="py-2 pr-4">{b}</td>
                        <td className="py-2">{stageLeads.length - d - b}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
