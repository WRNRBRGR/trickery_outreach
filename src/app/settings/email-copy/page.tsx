"use client";

import { useState, useEffect } from "react";
import { Save, Sparkles, Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSchedulingConfig } from "@/lib/scheduling";
import { TEMPLATE_KEYS, DEFAULT_TEMPLATES } from "@/lib/constants";

export default function EmailCopySettings() {
  const [templates, setTemplates] = useState({
    INTRO: [
      { subject: "", body: "" },
      { subject: "", body: "" },
      { subject: "", body: "" },
    ],
    SHOWREELS: [
      { subject: "", body: "" },
      { subject: "", body: "" },
      { subject: "", body: "" },
    ],
    CURTAIN_CALL: [
      { subject: "", body: "" },
      { subject: "", body: "" },
      { subject: "", body: "" },
    ],
  });
  
  const [activeTabs, setActiveTabs] = useState({
    INTRO: 0,
    SHOWREELS: 0,
    CURTAIN_CALL: 0,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toasts, setToasts] = useState<{id: string, type: string, message: string}[]>([]);
  
  const config = useSchedulingConfig();
  const gap = config.daysBetween;

  useEffect(() => {
    const loadStage = (stage: keyof typeof TEMPLATE_KEYS) => {
      return TEMPLATE_KEYS[stage].map((keys, idx) => ({
        subject: localStorage.getItem(keys.subject) || DEFAULT_TEMPLATES[stage][idx].subject,
        body: localStorage.getItem(keys.body) || DEFAULT_TEMPLATES[stage][idx].body,
      }));
    };

    setTemplates({
      INTRO: loadStage("INTRO"),
      SHOWREELS: loadStage("SHOWREELS"),
      CURTAIN_CALL: loadStage("CURTAIN_CALL"),
    });
    setLoading(false);
  }, []);

  const addToast = (type: string, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const handleSave = () => {
    setSaving(true);
    setSaved(false);

    const saveStage = (stage: keyof typeof TEMPLATE_KEYS) => {
      templates[stage].forEach((v, idx) => {
        localStorage.setItem(TEMPLATE_KEYS[stage][idx].subject, v.subject);
        localStorage.setItem(TEMPLATE_KEYS[stage][idx].body, v.body);
      });
    };

    saveStage("INTRO");
    saveStage("SHOWREELS");
    saveStage("CURTAIN_CALL");
    
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      addToast("success", "All variations and subjects saved.");
      setTimeout(() => setSaved(false), 3000);
    }, 1000);
  };

  const handleReset = () => {
    if (confirm("Reset all templates and variations to their default values?")) {
      setTemplates(DEFAULT_TEMPLATES);
      
      const clearStage = (stage: keyof typeof TEMPLATE_KEYS) => {
        TEMPLATE_KEYS[stage].forEach(keys => {
          localStorage.removeItem(keys.subject);
          localStorage.removeItem(keys.body);
        });
      };

      clearStage("INTRO");
      clearStage("SHOWREELS");
      clearStage("CURTAIN_CALL");
      addToast("info", "Templates reset to defaults.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  const updateTemplate = (stage: keyof typeof templates, index: number, field: "subject" | "body", value: string) => {
    setTemplates(prev => {
      const next = { ...prev };
      next[stage] = [...next[stage]];
      next[stage][index] = { ...next[stage][index], [field]: value };
      return next;
    });
  };

  const renderStage = (stage: keyof typeof templates, label: string, step: string, dayText: string) => {
    const activeIdx = activeTabs[stage];
    const current = templates[stage][activeIdx];

    return (
      <div className="glass-panel space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[var(--accent)]/10 rounded-md">
              <Mail className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <div>
              <h3 className="font-bold uppercase tracking-widest text-[10px] text-[var(--muted)]">{step}</h3>
              <h4 className="text-sm font-black">{label}</h4>
            </div>
          </div>
          <span className="text-[10px] text-[var(--muted)] font-bold">{dayText}</span>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-[var(--background)] p-1 rounded-lg border border-[var(--border)]">
          {[0, 1, 2].map((idx) => (
            <button
              key={idx}
              onClick={() => setActiveTabs(prev => ({ ...prev, [stage]: idx }))}
              className={cn(
                "flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all",
                activeIdx === idx 
                  ? "bg-[var(--accent)] text-[var(--btn-text)] shadow-sm" 
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]"
              )}
            >
              Option {idx + 1}
            </button>
          ))}
        </div>

        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">Subject Heading</label>
            <input
              className="input-field w-full font-bold"
              placeholder="Enter subject line..."
              value={current.subject}
              onChange={(e) => updateTemplate(stage, activeIdx, "subject", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">Email Body</label>
            <textarea
              className="input-field w-full h-40 resize-none text-sm leading-relaxed"
              placeholder="Type your email copy here..."
              value={current.body}
              onChange={(e) => updateTemplate(stage, activeIdx, "body", e.target.value)}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Toasts */}
      <div className="fixed top-6 right-6 z-50 flex flex-col space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={cn(
              "px-4 py-3 rounded-xl border flex items-center space-x-3 text-sm font-bold shadow-xl animate-in slide-in-from-right-4 fade-in duration-300 backdrop-blur-sm",
              toast.type === "info" ? "bg-[var(--surface)]/90 text-[var(--muted)] border-[var(--border)]" : "bg-indigo-950/90 text-indigo-300 border-indigo-500/30",
            )}
          >
            <Sparkles className="h-4 w-4 flex-shrink-0" />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Email Sequence</h1>
          <p className="mt-2 text-[var(--muted)] text-sm">
            Define subjects and copy for each stage. Each lead will alternate between the 3 options automatically.
          </p>
        </div>
        <div className="flex items-center space-x-4 bg-[var(--surface)] border border-[var(--border)] px-4 py-2 rounded-xl">
           <div className="flex items-center space-x-2">
              <Sparkles className="h-3 w-3 text-[var(--accent)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Variables:</span>
           </div>
           <code className="text-[10px] bg-[var(--background)] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--accent)]">{"{name}"}</code>
        </div>
      </div>

      <div className="grid gap-8">
        {renderStage("INTRO", "Introduction", "01. First Contact", "Day 1")}
        {renderStage("SHOWREELS", "Showreels & Work", "02. Proof of Value", `Day ${1 + gap} (+${gap})`)}
        {renderStage("CURTAIN_CALL", "Curtain Call", "03. Final Check-in", `Day ${1 + gap * 2} (+${gap})`)}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
        <button 
          onClick={handleReset}
          className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] hover:text-red-500 transition-colors"
        >
          Reset All to Defaults
        </button>

        <div className="flex items-center space-x-6">
          {saved && (
            <div className="flex items-center space-x-2 text-[var(--accent)] animate-in fade-in slide-in-from-right-4">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Saved!</span>
            </div>
          )}
          <button 
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center space-x-2 px-10 py-3"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{saving ? "Saving Changes..." : "Save All Templates"}</span>
          </button>
        </div>
      </div>

    </div>
  );
}
