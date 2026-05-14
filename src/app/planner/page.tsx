"use client";

import { useState, useEffect } from "react";
import { Map, Save, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PlannerPage() {
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    const savedNote = localStorage.getItem("planner_note");
    if (savedNote) {
      setNote(savedNote);
    }
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    localStorage.setItem("planner_note", note);
    setTimeout(() => {
      setIsSaving(false);
      setLastSaved(new Date());
    }, 600);
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center">
            <Map className="mr-3 h-8 w-8 text-[var(--accent)]" />
            Outreach Planner
          </h1>
          <p className="mt-2 text-[var(--muted)]">Keep track of the states and regions you plan to target next.</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {lastSaved && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] animate-in fade-in slide-in-from-right-2">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "btn-primary py-2 px-6 text-xs flex items-center space-x-2",
              isSaving && "opacity-70 cursor-not-allowed"
            )}
          >
            <Save className={cn("h-4 w-4", isSaving && "animate-spin")} />
            <span>{isSaving ? "Saving..." : "Save Notes"}</span>
          </button>
        </div>
      </div>

      <div className="glass-panel min-h-[500px] flex flex-col p-6 space-y-4">
        <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]/70">
          <Info className="h-3 w-3" />
          <span>Internal Planning Notes</span>
        </div>
        
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Enter your outreach strategy, states to target, and upcoming months planning here..."
          className="flex-1 w-full bg-transparent border-none focus:ring-0 text-lg leading-relaxed resize-none placeholder:text-[var(--muted)]/30 placeholder:italic"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-4 space-y-2 border-dashed opacity-60">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">Pro Tip</h3>
          <p className="text-xs text-[var(--muted)]">Use this space to paste list of states like: California, Texas, New York for Q3 outreach.</p>
        </div>
        <div className="glass-panel p-4 space-y-2 border-dashed opacity-60">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">Reminders</h3>
          <p className="text-xs text-[var(--muted)]">Don't forget to check timezones before scheduling leads in new states.</p>
        </div>
        <div className="glass-panel p-4 space-y-2 border-dashed opacity-60">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">Auto-Save</h3>
          <p className="text-xs text-[var(--muted)]">Your notes are stored locally in your browser for quick access.</p>
        </div>
      </div>
    </div>
  );
}
