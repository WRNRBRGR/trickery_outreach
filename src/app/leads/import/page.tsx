"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { STATE_TIMEZONES, TEMPLATE_KEYS, DEFAULT_TEMPLATES } from "@/lib/constants";
import { Loader2, Upload, CheckCircle2, AlertCircle, FileText, X, Sparkles, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScheduleTracker, useSchedulingConfig } from "@/lib/scheduling";
import { getVariation } from "@/app/actions/ai";
import { format } from "date-fns";
import Papa from "papaparse";


export default function LeadImportPage() {
  const router = useRouter();
  const config = useSchedulingConfig();
  const [rawData, setRawData] = useState("");
  const [importing, setImporting] = useState(false);
  const [skipAI, setSkipAI] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("skip_ai_personalization") === "true";
    }
    return false;
  });
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  const parseCSV = (text: string): { name: string; email: string; state: string; agency: string; linkedin: string | null }[] => {
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    // Try to find columns by common header names
    const rows = result.data;
    if (rows.length === 0) return [];

    const headers = Object.keys(rows[0]).map(h => h.toLowerCase());

    const findCol = (keys: string[]) =>
      keys.find(k => headers.some(h => h.includes(k)));

    const nameCol = findCol(["name", "first name", "full name"]);
    const emailCol = findCol(["email"]);
    const stateCol = findCol(["state", "location", "region"]);
    const agencyCol = findCol(["agency", "company", "organization"]);
    const linkedinCol = findCol(["linkedin"]);

    return rows.map(row => {
      const get = (key?: string) => key ? (Object.entries(row).find(([k]) => k.toLowerCase().includes(key))?.[1] || "").trim() : "";
      const name = get(nameCol) || "";
      const email = get(emailCol) || "";
      const stateRaw = get(stateCol) || "";
      // Extract 2-letter US state abbreviation if present in location string
      const stateMatch = stateRaw.match(/\b([A-Z]{2})\b/);
      const state = stateMatch ? stateMatch[1] : stateRaw.substring(0, 2).toUpperCase();
      const agency = get(agencyCol) || "";
      const linkedin = get(linkedinCol) || null;
      return { name, email, state, agency, linkedin: linkedin || null };
    }).filter(l => l.name && l.email);
  };


  const processImport = async (text: string) => {
    setImporting(true);
    setStatus(null);

    try {
      const parsedLeads = parseCSV(text);
      if (parsedLeads.length === 0) {
        throw new Error("No valid leads found. Ensure format: Name, Email, State, Agency");
      }

      // 0. Duplicate Check
      const { data: existingEmails, error: fetchError } = await supabase.from("leads").select("email");
      if (fetchError) throw fetchError;
      
      const existingEmailSet = new Set(existingEmails?.map(e => e.email.toLowerCase()) || []);
      const uniqueLeads = parsedLeads.filter(l => !existingEmailSet.has(l.email.toLowerCase()));
      const skippedCount = parsedLeads.length - uniqueLeads.length;

      if (uniqueLeads.length === 0) {
        throw new Error(`All ${parsedLeads.length} leads in this batch have already been imported.`);
      }

      setProgress({ current: 0, total: uniqueLeads.length });

      // 1. Load all template variations and subjects
      const loadStage = (stage: "INTRO" | "SHOWREELS" | "CURTAIN_CALL") => {
        const templateArray = DEFAULT_TEMPLATES[stage];
        return TEMPLATE_KEYS[stage].map((keys, idx) => ({
          subject: localStorage.getItem(keys.subject) || templateArray[idx].subject,
          body: localStorage.getItem(keys.body) || templateArray[idx].body,
        }));
      };

      const allTemplates = {
        INTRO: loadStage("INTRO"),
        SHOWREELS: loadStage("SHOWREELS"),
        CURTAIN_CALL: loadStage("CURTAIN_CALL"),
      };

      // 2. Flexible Schedule Tracker
      const today = new Date();
      // If it's past 3 PM, start scheduling from tomorrow
      if (today.getHours() >= 15) {
        today.setDate(today.getDate() + 1);
      }
      today.setHours(0, 0, 0, 0);
      const todayStr = format(today, "yyyy-MM-dd");

      // Fetch existing scheduled counts from DB
      const { data: existingCounts } = await supabase
        .from("leads")
        .select("scheduled_date")
        .gte("scheduled_date", todayStr);
      
      const countsMap = new Map<string, number>();
      if (existingCounts) {
        existingCounts.forEach(l => {
          countsMap.set(l.scheduled_date, (countsMap.get(l.scheduled_date) || 0) + 1);
        });
      }

      const tracker = new ScheduleTracker(config, countsMap);
      const finalLeads = [];
      const gap = config.daysBetween;
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      const concurrencyLimit = skipAI ? 5 : 1; // Only process 1 lead at a time if AI is enabled

      for (let i = 0; i < uniqueLeads.length; i += concurrencyLimit) {
        const batch = uniqueLeads.slice(i, i + concurrencyLimit);
        
          const batchPromises = batch.map(async (lead, batchIdx) => {
            const globalIdx = i + batchIdx;
            const tz = STATE_TIMEZONES[lead.state?.toUpperCase() || "NY"] || "America/New_York";
            const vIdx = globalIdx % 3;
            
            // Assign one of two colors evenly
            const assignedColor = globalIdx % 2 === 0 ? "indigo" : "rose";

            const d1 = tracker.getNextAvailableDate(today);
            const d2 = tracker.getNextAvailableDate(d1, gap);
            const d3 = tracker.getNextAvailableDate(d2, gap);

            const stages = [
              { type: "INTRO", date: d1, template: allTemplates.INTRO[vIdx] },
              { type: "SHOWREELS", date: d2, template: allTemplates.SHOWREELS[vIdx] },
              { type: "CURTAIN_CALL", date: d3, template: allTemplates.CURTAIN_CALL[vIdx] },
            ];

            const leadRecords = [];
            for (const stage of stages) {
              let finalSubject = stage.template.subject;
              let finalBody = stage.template.body;

              if (!skipAI) {
                // Add a small delay between stages to avoid hitting rate limits (15/min is roughly 1 every 4s)
                // But since we are doing 3 per lead, let's wait 2s between each request.
                if (leadRecords.length > 0) await sleep(2000); 
                
                const res = await getVariation(stage.type, finalSubject, finalBody, lead.name, lead.agency || "Independent");
                if (res.success && res.subject && res.body) {
                  finalSubject = res.subject;
                  finalBody = res.body;
                }
              }

              leadRecords.push({
                name: lead.name,
                email: lead.email,
                state: lead.state?.toUpperCase(),
                agency: lead.agency || null,
                timezone: tz,
                scheduled_date: format(stage.date, "yyyy-MM-dd"),
                ai_pitch: JSON.stringify({ 
                  stage: stage.type,
                  subject: finalSubject,
                  body: finalBody,
                  linkedin: lead.linkedin || null,
                  assigned_color: assignedColor
                }),
              });
            }
            return leadRecords;
          });

        const batchResults = await Promise.all(batchPromises);
        finalLeads.push(...batchResults.flat());
        setProgress({ current: Math.min(i + concurrencyLimit, uniqueLeads.length), total: uniqueLeads.length });
      }

      const { error: insertError } = await supabase.from("leads").insert(finalLeads);
      if (insertError) throw insertError;

      setStatus({
        type: "success",
        message: `Successfully imported ${uniqueLeads.length} leads. ${skippedCount > 0 ? `${skippedCount} duplicates skipped.` : ""} Calendar populated with 3-email sequences.`,
      });
      setImportedCount(uniqueLeads.length);
      setRawData("");
      setFileName(null);
      // No auto-redirect — user clicks through manually

    } catch (error: any) {
      console.error("Import failed:", error);
      setStatus({ type: "error", message: error.message || "An unknown error occurred" });
    } finally {
      setImporting(false);
    }
  };


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawData(text);
    };
    reader.readAsText(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setRawData(text);
      };
      reader.readAsText(file);
    } else {
      setStatus({ type: "error", message: "Please upload a valid CSV file." });
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)]">Bulk Lead Importer</h1>
        <p className="mt-2 text-[var(--muted)]">
          Upload a CSV or paste lead data. Leads are paced at exactly {config.dailyLimit} per day.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={cn(
              "glass-panel border-dashed border-2 flex flex-col items-center justify-center py-12 transition-all group relative overflow-hidden",
              isDragging ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-white/10 hover:border-white/20",
              fileName && "border-[var(--accent)]/50 bg-[var(--accent)]/[0.02]"
            )}
          >
            {!fileName ? (
              <>
                <div className="p-4 bg-[var(--background)]/50 rounded-full mb-4 group-hover:scale-110 transition-transform duration-500">
                  <Upload className={cn("h-8 w-8", isDragging ? "text-[var(--accent)]" : "text-[var(--muted)]")} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg mb-1">Drag & Drop CSV</p>
                  <p className="text-sm text-[var(--muted)] mb-4">or click to browse files</p>
                  <label className="btn-primary cursor-pointer text-xs py-1.5 px-4">
                    Choose File
                    <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-[var(--accent)]/10 rounded-xl">
                  <FileText className="h-6 w-6 text-[var(--accent)]" />
                </div>
                <div>
                  <p className="font-bold text-[var(--accent)]">{fileName}</p>
                  <button 
                    onClick={() => { setFileName(null); setRawData(""); }}
                    className="text-[10px] uppercase tracking-widest text-[var(--muted)] hover:text-[var(--foreground)] mt-1 flex items-center"
                  >
                    <X className="h-3 w-3 mr-1" /> Remove File
                  </button>
                </div>
              </div>
            )}
            
            {/* Visual Flair */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-[var(--accent)]/10 transition-colors" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Manual Data Override / Preview</label>
              <span className="text-[10px] text-[var(--muted)]/60">Format: Name, Email, State, Agency</span>
            </div>
            <textarea
              placeholder="John Doe, john@agency.com, NY, Creative Studio..."
              className="input-field w-full h-48 font-mono text-xs leading-relaxed opacity-60 hover:opacity-100 focus:opacity-100 transition-opacity"
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              disabled={importing}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel">
            <h3 className="font-bold mb-4 flex items-center text-sm">
              <Sparkles className="h-4 w-4 mr-2 text-[var(--accent)]" />
              AI Personalization
            </h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer group">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={skipAI}
                    onChange={(e) => {
                      setSkipAI(e.target.checked);
                      localStorage.setItem("skip_ai_personalization", String(e.target.checked));
                    }}
                  />
                  <div className={cn(
                    "w-10 h-5 rounded-full border transition-colors",
                    skipAI ? "bg-[var(--accent)] border-[var(--accent)]" : "bg-[var(--background)] border-[var(--border)] group-hover:border-[var(--muted)]/30"
                  )} />
                  <div className={cn(
                    "absolute left-1 top-1 w-3 h-3 rounded-full transition-transform",
                    skipAI ? "translate-x-5 bg-white" : "translate-x-0 bg-[var(--muted)]"
                  )} />
                </div>
                <span className="text-xs font-bold text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">Skip AI Personalization</span>
              </label>
            </div>
          </div>

          <div className="glass-panel">
            <h3 className="font-bold mb-4 flex items-center text-sm">
              <AlertCircle className="h-4 w-4 mr-2 text-[var(--accent)]" />
              Import Pacing
            </h3>
            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center text-[var(--muted)]">
                <span>Daily Limit</span>
                <span className="text-[var(--foreground)] font-bold">{config.dailyLimit} Leads</span>
              </div>

              <div className="flex justify-between items-center text-[var(--muted)]">
                <span>Timezone Logic</span>
                <span className="text-[var(--foreground)] font-bold">Enabled</span>
              </div>
            </div>
          </div>

          {importing && (
            <div className="glass-panel border-[var(--accent)]/30 animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">Processing Leads</span>
                <span className="text-[10px] font-mono text-[var(--accent)]">{progress.current} / {progress.total}</span>
              </div>
              <div className="h-2 w-full bg-[var(--background)] rounded-full overflow-hidden border border-[var(--border)]">
                <div 
                  className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-deep)] transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] text-[var(--muted)] animate-pulse text-center">
                {skipAI ? "Importing data..." : "AI is crafting variations (Respecting rate limits...)"}
              </p>
              {!skipAI && (
                <p className="mt-1 text-[9px] text-[var(--muted)]/60 text-center italic">
                  Free Tier limit: 15 emails per minute. This may take a moment.
                </p>
              )}
            </div>
          )}

          {status && (
            <div className={cn(
              "p-4 rounded-xl flex flex-col gap-3 animate-in fade-in zoom-in-95",
              status.type === "success" 
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
            )}>
              <div className="flex items-start space-x-3">
                {status.type === "success" ? <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />}
                <p className="text-xs font-medium leading-relaxed">{status.message}</p>
              </div>
              {status.type === "success" && (
                <button
                  onClick={() => router.push("/leads")}
                  className="flex items-center justify-center space-x-2 text-[10px] font-black uppercase tracking-widest py-2 px-4 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                >
                  <span>View Leads</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => processImport(rawData)}
            disabled={importing || !rawData.trim()}
            className="btn-primary w-full flex items-center justify-center disabled:opacity-30 py-4"
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import & Schedule
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
