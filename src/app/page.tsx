"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { format, addDays, startOfDay, startOfWeek } from "date-fns";
import { Loader2, Calendar as CalendarIcon, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSchedulingConfig } from "@/lib/scheduling";


export default function Dashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCounts();
  }, []);

  async function fetchCounts() {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const dateStr = format(start, "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("leads")
      .select("scheduled_date")
      .gte("scheduled_date", dateStr);

    if (error) {
      console.error("Error fetching lead counts:", error);
      return;
    }

    const map: Record<string, number> = {};
    data.forEach((lead) => {
      map[lead.scheduled_date] = (map[lead.scheduled_date] || 0) + 1;
    });
    setCounts(map);
    setLoading(false);
  }

  // Align to Monday of current week and show 35 days (5 full weeks)
  const startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 35 }, (_, i) => addDays(startOfDay(startDate), i));
  const config = useSchedulingConfig();
  const limit = config.dailyLimit;
  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Outreach Calendar</h1>
          <p className="mt-2 text-[var(--muted)]">Next 30 days of studio outreach pacing.</p>
        </div>
        <div className="flex items-center space-x-4 bg-[var(--surface)] px-4 py-2 rounded-md border border-[var(--border)]">
          <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[var(--border)]"></span>
            <span className="text-[var(--muted)]">Empty</span>
          </div>
          <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] opacity-40"></span>
            <span className="text-[var(--muted)]">Partial</span>
          </div>
          <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]"></span>
            <span className="text-[var(--muted)]">Full ({limit})</span>
          </div>
          <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[var(--muted)]/20"></span>
            <span className="text-[var(--muted)]">Off Day</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Headers for 7-column layout */}
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="hidden lg:flex items-center justify-center pb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]/50">{d}</span>
            </div>
          ))}

          {days.map((day) => {
            const dateStr = day.toISOString().split("T")[0];
            const count = counts[dateStr] || 0;
            const isToday = dateStr === today;
            const isPast = dateStr < today;
            const isFull = count >= limit;
            const dayOfWeek = day.getDay(); // 0 = Sun, 6 = Sat
            const isActiveDay = config.activeDays.includes(dayOfWeek);

            const canClick = !isPast && count > 0;
            const Component = canClick ? Link : "div" as any;

            return (
              <Component
                href={canClick ? `/dashboard/${dateStr}` : undefined}
                key={dateStr}
                className={cn(
                  "glass-panel group relative flex flex-col items-center justify-center h-28 transition-all",
                  // Clickable vs Non-clickable
                  canClick ? "hover:border-[var(--accent)]/40 cursor-pointer shadow-lg hover:shadow-[var(--accent)]/5" : "cursor-default",
                  // Past days
                  isPast && "opacity-30 grayscale",
                  // Inactive / off days
                  !isPast && !isActiveDay && "opacity-40 border-dashed",
                  // Active days with leads
                  !isPast && isActiveDay && count > 0 && "border-[var(--muted)]/30",
                  // Active days without leads
                  !isPast && isActiveDay && count === 0 && "border-[var(--border)]",
                  // Full days
                  !isPast && isFull && "border-[var(--accent)]/50 bg-[var(--accent)]/[0.03]",
                  // Today
                  isToday && "ring-1 ring-[var(--accent)]/40"
                )}
              >
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest mb-1",
                  isToday ? "text-[var(--accent)]" : "text-[var(--muted)]"
                )}>
                  {format(day, "EEE")}
                </span>
                <span className="text-xl font-black">{format(day, "d")}</span>
                
                {!isActiveDay && !isPast ? (
                  <span className="text-[8px] font-bold text-[var(--muted)]/50 mt-2 uppercase tracking-widest">Off</span>
                ) : (
                  <div className="mt-3 flex items-center space-x-1.5">
                    <div className="h-1 w-10 bg-[var(--border)] rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all duration-1000",
                          isFull ? "bg-[var(--accent)]" : "bg-[var(--accent)]/40"
                        )}
                        style={{ width: `${Math.min(100, (count / limit) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-bold text-[var(--muted)]">{count}/{limit}</span>
                  </div>
                )}

                {isToday && (
                  <div className="absolute top-2 right-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                  </div>
                )}
                </Component>
            );
          })}
        </div>
      )}
    </div>
  );

}
