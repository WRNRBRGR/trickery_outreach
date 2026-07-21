"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database";
import { format, parseISO } from "date-fns";
import { 
  ChevronLeft, Clock, Send, Sparkles,
  CheckCircle2, Loader2,
  Mail, AlertCircle, RotateCcw, MapPin,
  Copy, ExternalLink
} from "lucide-react";
import Link from "next/link";
import { cn, replaceVariables, getGmailLink, getLinkedInUrl } from "@/lib/utils";
import { TIMEZONE_LABELS, TEMPLATE_KEYS, DEFAULT_TEMPLATES } from "@/lib/constants";
import { recomposeEmail } from "@/app/actions/ai";
import { sendViaSes } from "@/app/actions/send";

type Lead = Database["public"]["Tables"]["leads"]["Row"];


const EMAIL_SUBJECTS: Record<string, string> = {
  INTRO: "Introducing Trickery — Your animation partner",
  SHOWREELS: "Trickery — A look at our latest work",
  CURTAIN_CALL: "One last thought from Trickery",
};

const STAGE_COLORS: Record<string, string> = {
  INTRO: "from-blue-600/30 to-cyan-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40",
  SHOWREELS: "from-purple-600/30 to-pink-500/20 text-purple-700 dark:text-purple-300 border-purple-500/40",
  CURTAIN_CALL: "from-amber-600/30 to-orange-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40",
};

const STAGE_LABELS: Record<string, string> = {
  INTRO: "Intro",
  SHOWREELS: "Showreels",
  CURTAIN_CALL: "Curtain Call",
};

interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface ParsedPitch {
  stage: "INTRO" | "SHOWREELS" | "CURTAIN_CALL";
  subject: string | null;
  body: string | null;
  linkedin: string | null;
  assigned_color: string | null;
}

function parsePitch(raw: string | null): ParsedPitch {
  const defaults: ParsedPitch = { stage: "INTRO", subject: null, body: null, linkedin: null, assigned_color: null };
  if (!raw) return defaults;
  
  try {
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw);
      // Handle legacy 'pitch' format if necessary, or the new structured format
      let stage: ParsedPitch["stage"] = parsed.stage || "INTRO";
      let body = parsed.body || null;
      let subject = parsed.subject || null;
      
      if (parsed.pitch) {
        const stageMatch = parsed.pitch.match(/^\[(INTRO|SHOWREELS|CURTAIN_CALL)\]/);
        stage = (stageMatch ? stageMatch[1] : "INTRO") as ParsedPitch["stage"];
        body = body || parsed.pitch.replace(/^\[.*?\]\s*/, "");
      }
      
      return { 
        stage, 
        subject, 
        body, 
        linkedin: parsed.linkedin || null,
        assigned_color: parsed.assigned_color || null
      };
    }
  } catch {}

  const stageMatch = raw.match(/^\[(INTRO|SHOWREELS|CURTAIN_CALL)\]/);
  return { ...defaults, stage: (stageMatch ? stageMatch[1] : "INTRO") as ParsedPitch["stage"] };
}

function getSASendWindow(recipientTimezone: string): string {
  const now = new Date();
  const saHour = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Johannesburg", hour: "numeric", hour12: false }).format(now));
  const utcHour = now.getUTCHours();
  const saOffset = ((saHour - utcHour) + 24) % 24;
  const recipHour = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: recipientTimezone, hour: "numeric", hour12: false }).format(now));
  const recipOffset = ((recipHour - utcHour) + 24) % 24;
  const diff = saOffset - recipOffset;
  const startH = (9 + diff + 24) % 24;
  const endH = (12 + diff + 24) % 24;
  const fmt = (h: number) => {
    const ampm = h >= 12 ? "pm" : "am";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}${ampm}`;
  };
  return `${fmt(startH)} – ${fmt(endH)} SAST`;
}

const PARTNER_COLORS: Record<string, string> = {
  indigo: "bg-indigo-500 dark:shadow-[0_0_10px_rgba(99,102,241,0.5)]",
  rose: "bg-rose-500 dark:shadow-[0_0_10px_rgba(244,63,94,0.5)]",
};

export default function DailyWorkConsole({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [templates, setTemplates] = useState({ INTRO: "", SHOWREELS: "", CURTAIN_CALL: "" });
  const [signatures, setSignatures] = useState({ indigo: "", rose: "" });
  const [recomposing, setRecomposing] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function loadTemplates() {
    const loadDefault = (stage: "INTRO" | "SHOWREELS" | "CURTAIN_CALL") => {
      // For fallback, just use the first variation
      return localStorage.getItem(TEMPLATE_KEYS[stage][0].body) || DEFAULT_TEMPLATES[stage][0].body;
    };

    setTemplates({
      INTRO: loadDefault("INTRO"),
      SHOWREELS: loadDefault("SHOWREELS"),
      CURTAIN_CALL: loadDefault("CURTAIN_CALL"),
    });

    setSignatures({
      indigo: localStorage.getItem(TEMPLATE_KEYS.SIGNATURES.indigo) || DEFAULT_TEMPLATES.SIGNATURES.indigo,
      rose: localStorage.getItem(TEMPLATE_KEYS.SIGNATURES.rose) || DEFAULT_TEMPLATES.SIGNATURES.rose,
    });
  }

  useEffect(() => {
    fetchData();
    loadTemplates();
    window.addEventListener("storage", loadTemplates);
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", loadTemplates);
    };
  }, [date]);

  function addToast(type: ToastMessage["type"], message: string) {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }

  async function fetchData() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("leads").select("*").eq("scheduled_date", date);
      if (error) throw error;
      setLeads(data || []);
    } catch {
      addToast("error", "Failed to load outreach data.");
    } finally {
      setLoading(false);
    }
  }

  async function markAsSent(leadId: string, sentVia: "gmail" | "ses" = "gmail", sesMessageId?: string) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("leads")
      .update({ sent_at: now, sent_via: sentVia, ses_message_id: sesMessageId || null })
      .eq("id", leadId);
    if (!error) {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, sent_at: now, sent_via: sentVia, ses_message_id: sesMessageId || null } : l));
      addToast("success", "Lead marked as sent.");
    }
  }

  function handleOpenGmail(lead: Lead, subject: string, body: string) {
    const url = getGmailLink(lead.email, subject, body);
    window.open(url, "_blank", "noopener,noreferrer");
    markAsSent(lead.id, "gmail");
  }

  async function handleSendViaSes(lead: Lead, subject: string, body: string, assignedColor: string | null) {
    if (lead.suppressed) {
      addToast("error", `Cannot send — this address is suppressed (${lead.suppressed_reason || "unknown reason"}).`);
      return;
    }
    setSendingId(lead.id);
    const res = await sendViaSes(lead.email, subject, body, assignedColor);
    if (res.success) {
      await markAsSent(lead.id, "ses", res.messageId);
      addToast("success", "Email sent via SES.");
    } else {
      addToast("error", res.error || "Failed to send email.");
    }
    setSendingId(null);
  }

  async function markAsUnsent(leadId: string) {
    const { error } = await supabase.from("leads").update({ sent_at: null }).eq("id", leadId);
    if (!error) {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, sent_at: null } : l));
      addToast("info", "Lead moved back to pending.");
    }
  }

  async function handleRecompose(lead: Lead, stage: string, currentSubject: string, currentBody: string) {
    setRecomposing(lead.id);
    const res = await recomposeEmail(stage, currentSubject, currentBody, lead.name, lead.agency || "Independent");
    
    if (res.success && res.subject && res.body) {
      const { linkedin, assigned_color } = parsePitch(lead.ai_pitch);
      
      // Persist to DB immediately so it's not lost on refresh
      const updatedPitch = JSON.stringify({
        stage,
        subject: res.subject,
        body: res.body,
        linkedin,
        assigned_color
      });

      const { error } = await supabase
        .from("leads")
        .update({ ai_pitch: updatedPitch })
        .eq("id", lead.id);

      if (error) {
        addToast("error", "AI success, but failed to save to database.");
      } else {
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ai_pitch: updatedPitch } : l));
        addToast("success", "Email recomposed and saved.");
      }
    } else {
      addToast("error", res.error || "Failed to recompose email.");
    }
    setRecomposing(null);
  }

  function getLocalTime(timezone: string) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hour: "numeric", minute: "numeric", hour12: true
    }).format(currentTime);
  }

  function isReady(timezone: string) {
    const hour = parseInt(new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hour: "numeric", hour12: false
    }).format(currentTime));
    return hour >= 9 && hour < 17;
  }

  const sentCount = leads.filter(l => l.sent_at).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-[var(--accent)] mb-4" />
        <p className="text-[var(--muted)] font-medium">Preparing Outreach Console...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-700">
      {/* Toast Notifications */}
      <div className="fixed top-6 right-6 z-50 flex flex-col space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={cn(
              "px-4 py-3 rounded-xl border flex items-center space-x-3 text-sm font-bold shadow-xl animate-in slide-in-from-right-4 fade-in duration-300 backdrop-blur-sm",
              toast.type === "success" && "bg-indigo-950/90 text-indigo-300 border-indigo-500/30",
              toast.type === "error"   && "bg-red-950/90 text-red-300 border-red-500/30",
              toast.type === "info"    && "bg-[var(--surface)]/90 text-[var(--muted)] border-[var(--border)]",
            )}
          >
            {toast.type === "success" && <CheckCircle2 className="h-4 w-4 flex-shrink-0" />}
            {toast.type === "error"   && <AlertCircle className="h-4 w-4 flex-shrink-0" />}
            {toast.type === "info"    && <AlertCircle className="h-4 w-4 flex-shrink-0" />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link 
            href="/" 
            className="p-2 hover:bg-[var(--surface)] rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              Daily Work: <span className="text-[var(--accent)]">{format(parseISO(date), "MMMM do")}</span>
            </h1>
            <p className="text-[var(--muted)]">{sentCount}/{leads.length} leads sent today.</p>
          </div>
        </div>

        {leads.length > 0 && (
          <div className="flex flex-col items-end space-y-2">
            <div className="flex items-center space-x-4 mb-1">
              <div className="flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-500 dark:shadow-[0_0_5px_rgba(99,102,241,0.5)]"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Werner</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-500 dark:shadow-[0_0_5px_rgba(244,63,94,0.5)]"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Louis</span>
              </div>
            </div>
            <div className="flex items-center space-x-3 bg-[var(--surface)] border border-[var(--border)] px-4 py-2 rounded-xl">
              <div className="h-1.5 w-24 bg-[var(--border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-deep)] transition-all duration-700"
                  style={{ width: `${(sentCount / leads.length) * 100}%` }}
                />
              </div>
              <span className="text-xs font-black text-[var(--muted)]">{Math.round((sentCount / leads.length) * 100)}%</span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {leads.length === 0 ? (
          <div className="text-center py-24 glass-panel border-dashed border-[var(--border)]">
            <AlertCircle className="mx-auto h-12 w-12 text-[var(--border)] mb-4" />
            <p className="text-[var(--muted)]">No leads scheduled for this date.</p>
            <Link href="/leads/import" className="mt-4 inline-block text-[var(--accent)] hover:underline font-bold text-sm">
              Import Leads Now
            </Link>
          </div>
        ) : (
          leads.map((lead) => {
            const { stage, linkedin, subject: savedSubject, body: savedBody, assigned_color: assignedColor } = parsePitch(lead.ai_pitch);
            
            const firstName = lead.name.split(" ")[0];
            const companyName = lead.agency || "Independent";
            const sendWindow = getSASendWindow(lead.timezone);

            // Prioritize: 1. Saved variation data, 2. Global template fallback
            const stageKey = stage as "INTRO" | "SHOWREELS" | "CURTAIN_CALL";
            const emailSubject = savedSubject || DEFAULT_TEMPLATES[stageKey][0].subject || "";
            const emailBody = savedBody || (templates[stageKey] as any) || DEFAULT_TEMPLATES[stageKey][0].body || "";
            const signature = signatures[assignedColor as keyof typeof signatures] || "";

            const vars = { name: firstName, company: companyName };
            const finalSubject = replaceVariables(emailSubject, vars);
            const finalBody = replaceVariables(emailBody, vars);
            const finalBodyWithSig = `${finalBody}\n${signature}`;

            return (
              <div 
                key={lead.id} 
                className={cn(
                  "glass-panel relative overflow-hidden transition-all duration-500 pl-6",
                  lead.sent_at ? "opacity-50 grayscale" : "hover:border-[var(--accent)]/30"
                )}
              >
                {/* Partner Color Strip */}
                <div className={cn(
                  "absolute top-0 left-0 bottom-0 w-1.5",
                  assignedColor ? PARTNER_COLORS[assignedColor as keyof typeof PARTNER_COLORS] : "bg-[var(--border)]"
                )} />

                {/* Top progress bar */}
                <div className="absolute top-0 left-0 h-0.5 w-full bg-[var(--border)]">
                  <div className={cn(
                    "h-full transition-all duration-1000 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-deep)]",
                    lead.sent_at ? "w-full opacity-100" : "w-0"
                  )} />
                </div>

                {/* Stage badge — top right */}
                <div className="absolute top-4 right-5">
                  <div className={cn(
                    "px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border bg-gradient-to-br",
                    STAGE_COLORS[stage] || STAGE_COLORS.INTRO
                  )}>
                    {STAGE_LABELS[stage] || stage}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">

                  {/* Left: Lead Info */}
                  <div className="lg:col-span-3 space-y-4">
                    {/* Name + LinkedIn */}
                    <div>
                      <div className="flex items-center space-x-2 pr-20">
                        <div className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          assignedColor ? PARTNER_COLORS[assignedColor as keyof typeof PARTNER_COLORS] : "bg-[var(--muted)]"
                        )} />
                        <h3 className="text-lg font-black text-[var(--foreground)]">{lead.name}</h3>
                        {linkedin && (
                          <div className="flex items-center space-x-1">
                            <a
                              href={getLinkedInUrl(linkedin, lead.name, lead.agency) || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View LinkedIn Profile"
                              className="p-1 rounded-md text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors flex-shrink-0"
                            >
                              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                              </svg>
                            </a>
                            <button
                              onClick={() => {
                                const sender = assignedColor === "indigo" ? "Werner" : assignedColor === "rose" ? "Louis" : "Werner";
                                const note = `Hi there ${firstName},\n\nI work at Trickery out of South Africa. We specialize in 2D and 3D motion graphics and animation for agencies around the globe. I would love to connect and showcase some of our work!\n\nGreetings,\n${sender}`;
                                copyToClipboard(note, `linkedin-note-small-${lead.id}`);
                              }}
                              className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex-shrink-0"
                              title="Copy connection note"
                            >
                              <Copy className={cn("h-4 w-4", copiedId === `linkedin-note-small-${lead.id}` ? "text-green-500" : "")} />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest pl-4">{lead.agency || "Independent"}</p>
                    </div>

                    {/* Email */}
                    <div className="flex items-center justify-between group/email pr-4">
                      <div className="flex items-center space-x-2 text-xs text-[var(--muted)]">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate max-w-[140px]">{lead.email}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(lead.email, `email-${lead.id}`)}
                        className="opacity-0 group-hover/email:opacity-100 p-1 hover:bg-[var(--surface)] rounded transition-all"
                        title="Copy Email"
                      >
                        <Copy className={cn("h-3 w-3", copiedId === `email-${lead.id}` ? "text-green-500" : "text-[var(--muted)]")} />
                      </button>
                    </div>

                    {/* Time info */}
                    <div className="bg-[var(--background)]/60 p-3 rounded-lg border border-[var(--border)] space-y-3">
                      <div className="flex items-start space-x-3">
                        <Clock className="h-4 w-4 text-[var(--muted)] mt-0.5" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-base font-mono font-bold text-[var(--foreground)]">{getLocalTime(lead.timezone)}</span>
                            <span className="text-[9px] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 rounded text-[var(--muted)] font-black">
                              {TIMEZONE_LABELS[lead.timezone] || lead.timezone}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5 mt-1">
                            <div className={cn("h-1.5 w-1.5 rounded-full", isReady(lead.timezone) ? "bg-[var(--accent)] animate-pulse" : "bg-red-500")} />
                            <span className={cn("text-[10px] font-black uppercase tracking-widest", isReady(lead.timezone) ? "text-[var(--accent)]" : "text-red-500")}>
                              {isReady(lead.timezone) ? "Ready to Send" : "After Hours"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* SA send window */}
                      <div className="border-t border-[var(--border)] pt-2.5">
                        <p className="text-[9px] text-[var(--muted)] uppercase tracking-widest font-black mb-1.5">Your Send Window</p>
                        <div className="flex items-center space-x-1.5">
                          <MapPin className="h-3 w-3 text-[var(--accent)]" />
                          <span className="text-sm font-bold text-[var(--foreground)]">{sendWindow}</span>
                        </div>
                        <p className="text-[9px] text-[var(--muted)]/60 mt-0.5">Recipient receives at 9am–12pm local</p>
                      </div>
                    </div>
                  </div>

                  {/* Center: Email Preview */}
                  <div className="lg:col-span-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Email Preview</label>
                      {!lead.sent_at && (
                        <button 
                          onClick={() => copyToClipboard(`Subject: ${finalSubject}\n\nHi ${firstName},\n\n${finalBodyWithSig}`, `body-${lead.id}`)}
                          className="flex items-center space-x-1.5 px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--foreground)]/[0.05] text-[9px] font-bold uppercase tracking-widest transition-all"
                        >
                          <Copy className={cn("h-3 w-3", copiedId === `body-${lead.id}` ? "text-green-500" : "text-[var(--muted)]")} />
                          <span>{copiedId === `body-${lead.id}` ? "Copied!" : "Copy Full Email"}</span>
                        </button>
                      )}
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      {/* Subject */}
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center space-x-3 bg-slate-50/50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">Subject</span>
                        <span className="text-sm font-bold text-slate-800 truncate">{finalSubject}</span>
                      </div>
                      {/* Body */}
                      <div className="px-4 py-6 text-sm leading-relaxed text-slate-900 min-h-[160px] selection:bg-indigo-100">
                        <p className="mb-4">Hi {firstName},</p>
                        <p className="whitespace-pre-wrap">{finalBody}</p>
                      </div>
                    </div>

                    {/* AI Recompose button */}
                    {!lead.sent_at && (
                      <button
                        onClick={() => handleRecompose(lead, stage, emailSubject, emailBody)}
                        disabled={recomposing === lead.id}
                        className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg border border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/5 text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                      >
                        {recomposing === lead.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        <span>{recomposing === lead.id ? "Recomposing..." : "AI Recompose"}</span>
                      </button>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="lg:col-span-3 flex flex-col space-y-3 pt-6">
                    {lead.suppressed ? (
                      <div className="flex flex-col items-center space-y-3">
                        <div className="flex flex-col items-center text-red-500 bg-red-500/5 rounded-xl border border-red-500/20 p-6 w-full">
                          <AlertCircle className="h-10 w-10 mb-2" />
                          <span className="text-xs font-black uppercase tracking-widest">Suppressed</span>
                          <span className="text-[10px] text-[var(--muted)] mt-1 capitalize">{lead.suppressed_reason || "unknown reason"}</span>
                        </div>
                        {!lead.sent_at && (
                          <button
                            onClick={() => markAsSent(lead.id, "gmail")}
                            className="text-[10px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                          >
                            Override &amp; mark as sent manually
                          </button>
                        )}
                      </div>
                    ) : !lead.sent_at ? (
                      <>
                        <button
                          onClick={() => handleSendViaSes(lead, finalSubject, `Hi ${firstName},\n\n${finalBodyWithSig}`, assignedColor)}
                          disabled={sendingId === lead.id}
                          className={cn(
                            "btn-primary w-full flex items-center justify-center text-sm dark:shadow-lg transition-all disabled:opacity-50",
                            assignedColor === "rose"
                              ? "bg-gradient-to-r from-red-600 to-red-500 border-red-700/50 hover:from-red-700 hover:to-red-600 dark:shadow-red-600/20"
                              : "bg-gradient-to-r from-indigo-600 to-blue-500 border-indigo-700/50 hover:from-indigo-700 hover:to-indigo-600 dark:shadow-indigo-600/20"
                          )}
                        >
                          {sendingId === lead.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="mr-2 h-4 w-4" />
                          )}
                          {sendingId === lead.id ? "Sending..." : "Send Email"}
                        </button>

                        <button
                          onClick={() => handleOpenGmail(lead, finalSubject, `Hi ${firstName},\n\n${finalBodyWithSig}`)}
                          className="w-full flex items-center justify-center space-x-1.5 text-[10px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors py-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Open in Gmail instead</span>
                        </button>

                        {linkedin && (
                          <>
                            <a 
                              href={getLinkedInUrl(linkedin, lead.name, lead.agency) || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg border border-[#0077b5]/30 bg-[#0077b5]/10 text-[#0077b5] hover:bg-[#0077b5]/20 text-xs font-bold uppercase tracking-widest transition-all"
                            >
                              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                              <span>LinkedIn Profile</span>
                            </a>
                            <button
                              onClick={() => {
                                const sender = assignedColor === "indigo" ? "Werner" : assignedColor === "rose" ? "Louis" : "Werner";
                                const note = `Hi there ${firstName},\n\nI work at Trickery out of South Africa. We specialize in 2D and 3D motion graphics and animation for agencies around the globe. I would love to connect and showcase some of our work!\n\nGreetings,\n${sender}`;
                                copyToClipboard(note, `linkedin-note-large-${lead.id}`);
                              }}
                              className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 text-xs font-bold uppercase tracking-widest transition-all"
                            >
                              <Copy className={cn("h-4 w-4", copiedId === `linkedin-note-large-${lead.id}` ? "text-green-500" : "")} />
                              <span>{copiedId === `linkedin-note-large-${lead.id}` ? "Copied Note!" : "Copy Connect Note"}</span>
                            </button>
                          </>
                        )}

                        <button 
                          onClick={() => markAsSent(lead.id)}
                          className="w-full flex items-center justify-center space-x-1.5 text-[10px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors py-1"
                        >
                          <Send className="h-3 w-3" />
                          <span>Manual Mark as Sent</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center space-y-3">
                        <div className="flex flex-col items-center text-[var(--accent)] bg-[var(--accent)]/5 rounded-xl border border-[var(--accent)]/20 p-6 w-full">
                          <CheckCircle2 className="h-10 w-10 mb-2" />
                          <span className="text-xs font-black uppercase tracking-widest">Sent</span>
                          <span className="text-[10px] text-[var(--muted)] mt-1">{format(parseISO(lead.sent_at), "h:mm a")}</span>
                          <span className="text-[9px] text-[var(--muted)]/60 mt-0.5 uppercase tracking-widest">via {lead.sent_via === "ses" ? "SES" : "Gmail"}</span>
                        </div>
                        <button
                          onClick={() => markAsUnsent(lead.id)}
                          className="flex items-center space-x-1.5 text-[10px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Undo</span>
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
