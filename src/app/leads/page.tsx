"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database";
import { format, parseISO } from "date-fns";
import { ScheduleTracker, useSchedulingConfig } from "@/lib/scheduling";
import { RefreshCw, Loader2, Search, Trash2, Mail, MapPin, Calendar, Clock, AlertTriangle, Copy, Check } from "lucide-react";
import { cn, getLinkedInUrl } from "@/lib/utils";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

// Helper to parse stage from ai_pitch
function getStage(pitch: string | null): string {
  if (!pitch) return "INTRO";
  try {
    const data = JSON.parse(pitch);
    if (data.stage) return data.stage;
    const match = data.pitch?.match(/^\[(INTRO|SHOWREELS|CURTAIN_CALL)\]/);
    return match ? match[1] : "INTRO";
  } catch {
    const match = pitch.match(/^\[(INTRO|SHOWREELS|CURTAIN_CALL)\]/);
    return match ? match[1] : "INTRO";
  }
}

export default function LeadListPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [clearing, setClearing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "sent">("all");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmOptimize, setConfirmOptimize] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const config = useSchedulingConfig();

  function showStatus(type: "success" | "error", message: string) {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus({ type, message });
    statusTimer.current = setTimeout(() => setStatus(null), 4000);
  }

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("scheduled_date", { ascending: true });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLoading(false);
    }
  }

  async function rebalanceSchedule() {
    setConfirmOptimize(false);
    setOptimizing(true);
    try {
      // 1. Get all leads
      const { data: allLeads, error: fetchError } = await supabase.from("leads").select("*");
      if (fetchError) throw fetchError;

      // 2. Setup Tracker and identify today
      const today = new Date();
      // If it's past 3 PM, start scheduling from tomorrow to be safe
      if (today.getHours() >= 15) {
        today.setDate(today.getDate() + 1);
      }
      today.setHours(0,0,0,0);
      const todayStr = format(today, "yyyy-MM-dd");

      const tracker = new ScheduleTracker(config);
      tracker.setStartDate(today);
      
      // Populate tracker with sent leads (slots that are already "gone")
      allLeads.filter(l => l.sent_at).forEach(l => {
        if (l.scheduled_date >= todayStr) {
          tracker.addCount(l.scheduled_date);
        }
      });

      // 3. Group ALL leads by person (email) to maintain sequence history
      const groups: Record<string, Lead[]> = {};
      allLeads.forEach(l => {
        if (!groups[l.email]) groups[l.email] = [];
        groups[l.email].push(l);
      });

      const updates: { id: string, scheduled_date: string }[] = [];
      const stageOrder = ["INTRO", "SHOWREELS", "CURTAIN_CALL"];

      // 4. Reschedule each group
      Object.values(groups).forEach(personLeads => {
        // Sort by stage order to maintain sequence integrity
        personLeads.sort((a, b) => stageOrder.indexOf(getStage(a.ai_pitch)) - stageOrder.indexOf(getStage(b.ai_pitch)));
        
        let lastDate: Date | null = null;
        
        personLeads.forEach((l) => {
          if (l.sent_at) {
            // Already sent, use this as the anchor for the next one
            lastDate = new Date(l.scheduled_date);
          } else {
            // Unsent, reschedule it starting from today (or last sent date + gap)
            const anchor = lastDate || today;
            const minGap = lastDate ? config.daysBetween : 0;
            
            // Ensure we never schedule in the past
            const searchStart = anchor < today ? today : anchor;
            
            const newDate = tracker.getNextAvailableDate(searchStart, minGap);
            const newDateStr = format(newDate, "yyyy-MM-dd");

            // Only add to updates if the date actually changed
            if (l.scheduled_date !== newDateStr) {
              updates.push({ id: l.id, scheduled_date: newDateStr });
            }
            lastDate = newDate;
          }
        });
      });

      // 5. Batch update
      if (updates.length > 0) {
        // Perform updates in smaller chunks if needed, but for 100-200 leads a single call is fine
        // We use a loop for now to be safe with RLS and specific column updates
        const updatePromises = updates.map(u => 
          supabase.from("leads").update({ scheduled_date: u.scheduled_date }).eq("id", u.id)
        );
        
        const results = await Promise.all(updatePromises);
        const error = results.find(r => r.error)?.error;
        if (error) throw error;
      }

      showStatus("success", `Optimized ${updates.length} scheduled emails.`);
      fetchLeads();
    } catch (error: any) {
      console.error("Rebalance failed:", error);
      showStatus("error", "Failed to optimize schedule.");
    } finally {
      setOptimizing(false);
    }
  }

  async function clearSchedule() {
    setConfirmClear(false);
    setClearing(true);
    try {
      const { error } = await supabase.from("leads").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      setLeads([]);
      showStatus("success", "Outreach schedule cleared successfully.");
    } catch (error: any) {
      console.error("Error clearing schedule:", error);
      showStatus("error", error.message || "Failed to clear schedule.");
    } finally {
      setTimeout(() => setClearing(false), 1000);
    }
  }

  const pendingCount = leads.filter(l => !l.sent_at).length;

  const filteredLeads = leads.filter(l => {
    const matchesSearch =
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.agency?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filter === "all" ? true :
      filter === "pending" ? !l.sent_at :
      !!l.sent_at;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Leads</h1>
          <p className="mt-2 text-[var(--muted)]">{leads.length} total &mdash; <span className="text-[var(--accent)] font-bold">{pendingCount} pending</span></p>
        </div>
        <div className="flex flex-col items-end space-y-3">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5">
              <div className="w-2 h-2 rounded-full bg-indigo-500 dark:shadow-[0_0_5px_rgba(99,102,241,0.5)]"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Werner</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2 h-2 rounded-full bg-rose-500 dark:shadow-[0_0_5px_rgba(244,63,94,0.5)]"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Louis</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {/* Filter Tabs */}
            <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-lg p-0.5 text-[10px] font-black uppercase tracking-widest">
              {(["all", "pending", "sent"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-md transition-all",
                    filter === f
                      ? "bg-[var(--accent)] text-[var(--btn-text)] shadow-sm"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >{f}</button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted)]" />
              <input 
                placeholder="Search leads..."
                className="input-field pl-9 w-56 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <button 
              onClick={() => setConfirmOptimize(true)}
              disabled={optimizing || pendingCount === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/20 rounded-md text-xs font-bold transition-all disabled:opacity-30"
            >
              {optimizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              <span>Optimize Schedule</span>
            </button>

            <button 
              onClick={() => setConfirmClear(true)}
              disabled={clearing || leads.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-md text-xs font-bold transition-all disabled:opacity-30"
            >
              {clearing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              <span>Clear Schedule</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Inline Confirmation Banner (Clear) */}
      {confirmClear && (
        <div className="p-4 rounded-xl flex items-center justify-between bg-red-500/10 border border-red-500/30 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center space-x-3">
            <Trash2 className="h-4 w-4 text-red-400 flex-shrink-0" />
            <p className="text-sm font-bold text-red-400">Delete all {leads.length} lead records? This cannot be undone.</p>
          </div>
          <div className="flex items-center space-x-2 ml-6">
            <button
              onClick={() => setConfirmClear(false)}
              className="px-4 py-1.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)] rounded-md transition-all"
            >Cancel</button>
            <button
              onClick={clearSchedule}
              className="px-4 py-1.5 text-xs font-bold text-[var(--btn-text)] bg-red-600 hover:bg-red-700 rounded-md transition-all"
            >Yes, Clear All</button>
          </div>
        </div>
      )}

      {/* Inline Confirmation Banner (Optimize) */}
      {confirmOptimize && (
        <div className="p-4 rounded-xl flex items-center justify-between bg-[var(--accent)]/10 border border-[var(--accent)]/30 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center space-x-3">
            <RefreshCw className="h-4 w-4 text-[var(--accent)] flex-shrink-0" />
            <p className="text-sm font-bold text-[var(--accent)]">Optimize your schedule? This will redistribute all pending leads from today onward.</p>
          </div>
          <div className="flex items-center space-x-2 ml-6">
            <button
              onClick={() => setConfirmOptimize(false)}
              className="px-4 py-1.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)] rounded-md transition-all"
            >Cancel</button>
            <button
              onClick={rebalanceSchedule}
              className="px-4 py-1.5 text-xs font-bold text-[var(--btn-text)] bg-[var(--accent)] hover:opacity-90 rounded-md transition-all"
            >Yes, Optimize</button>
          </div>
        </div>
      )}

      {/* Status Notification */}
      {status && (
        <div className={cn(
          "p-4 rounded-xl flex items-center space-x-3 animate-in fade-in zoom-in-95 duration-500",
          status.type === "success" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
        )}>
          <div className={cn("h-2 w-2 rounded-full", status.type === "success" ? "bg-indigo-400 animate-pulse" : "bg-red-400")} />
          <p className="text-xs font-bold tracking-tight uppercase">{status.message}</p>
        </div>
      )}

      <div className="glass-panel p-0 overflow-hidden border-[var(--border)]">

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Lead Details</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Region & Time</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Scheduled Date</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Outreach Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)] mx-auto" />
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[var(--muted)]">
                    <div className="flex flex-col items-center space-y-2">
                      <AlertTriangle className="h-5 w-5 opacity-20" />
                      <p className="text-sm">No scheduled leads found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  let pitchData = { pitch: lead.ai_pitch, linkedin: null, assigned_color: null };
                  try {
                    if (lead.ai_pitch?.startsWith("{")) {
                      const parsed = JSON.parse(lead.ai_pitch);
                      pitchData = {
                        ...parsed,
                        pitch: parsed.pitch || null,
                        linkedin: parsed.linkedin || null,
                        assigned_color: parsed.assigned_color || null
                      };
                    }
                  } catch (e) {}

                  const stageMatch = pitchData.pitch?.match(/^\[(INTRO|SHOWREELS|CURTAIN_CALL)\]/);
                  const stage = stageMatch ? stageMatch[1] : "N/A";
                  const displayPitch = pitchData.pitch?.replace(/^\[.*?\]\s*/, "") || "No content";

                  const partnerColor = pitchData.assigned_color === "indigo" ? "bg-indigo-500 dark:shadow-[0_0_8px_rgba(99,102,241,0.6)]" : 
                                      pitchData.assigned_color === "rose" ? "bg-rose-500 dark:shadow-[0_0_8px_rgba(244,63,94,0.6)]" : 
                                      "bg-[var(--border)]";

                  return (
                    <tr key={lead.id} className="hover:bg-[var(--foreground)]/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center space-x-2">
                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", partnerColor)} />
                            <span className="font-bold text-[var(--foreground)] text-sm">{lead.name}</span>
                            {pitchData.linkedin && (
                              <div className="flex items-center space-x-2">
                                <a 
                                  href={getLinkedInUrl(pitchData.linkedin, lead.name, lead.agency) || "#"} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[var(--accent)] hover:opacity-70 transition-opacity"
                                  title="View LinkedIn Profile"
                                >
                                  <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                                </a>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const sender = pitchData.assigned_color === "indigo" ? "Werner" : pitchData.assigned_color === "rose" ? "Louis" : "Werner";
                                    const firstName = lead.name.split(' ')[0];
                                    const note = `Hi there ${firstName},\n\nI work at Trickery out of South Africa. We specialize in 2D and 3D motion graphics and animation for agencies around the globe. I would love to connect and showcase some of our work!\n\nGreetings,\n${sender}`;
                                    navigator.clipboard.writeText(note);
                                    setCopiedId(lead.id);
                                    setTimeout(() => setCopiedId(null), 2000);
                                  }}
                                  className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                                  title="Copy connection note"
                                >
                                  {copiedId === lead.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-[var(--muted)] font-medium">{lead.agency || "Independent"}</span>
                          <div className="flex items-center space-x-1.5 mt-1.5 text-[10px] text-[var(--muted)]">
                            <Mail className="h-2.5 w-2.5" />
                            <span>{lead.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col space-y-1.5">
                          <div className="flex items-center space-x-1.5 text-[10px] text-[var(--foreground)] font-medium">
                            <MapPin className="h-3 w-3 text-[var(--muted)]" />
                            <span>{lead.state}</span>
                          </div>
                          <div className="flex items-center space-x-1.5 text-[10px] text-[var(--muted)]">
                            <Clock className="h-3 w-3" />
                            <span>{lead.timezone}</span>
                          </div>
                          {lead.timezone && (
                             <div className="text-[9px] text-[var(--accent)] font-black uppercase tracking-tighter bg-gradient-to-r from-indigo-500/10 to-violet-500/5 px-2 py-1 rounded-full w-fit border border-indigo-500/20 dark:shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                               Optimal: 9AM - 12PM Local
                             </div>
                          )}

                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2 text-xs text-[var(--foreground)]">
                          <Calendar className="h-3.5 w-3.5 text-[var(--muted)]" />
                          <span className="font-medium">{format(parseISO(lead.scheduled_date), "MMM d, yyyy")}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const colors: Record<string, string> = {
                            INTRO: "from-blue-600/20 to-cyan-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
                            SHOWREELS: "from-purple-600/20 to-pink-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
                            CURTAIN_CALL: "from-amber-600/20 to-orange-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
                          };
                          return (
                            <div className="flex flex-col space-y-1">
                              <div className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border bg-gradient-to-br w-fit", colors[stage] || "bg-gray-500/10 text-gray-500 border-gray-500/20")}>
                                {stage}
                              </div>
                              <span className="text-[9px] text-[var(--muted)] truncate max-w-[150px] italic">"{displayPitch}"</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        {lead.sent_at ? (
                          <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                            Sent
                          </div>
                        ) : (
                          <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]">
                            Pending
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

