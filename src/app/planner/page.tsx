"use client";

import { useState, useEffect } from "react";
import { Map, Save, Info } from "lucide-react";
import { cn } from "@/lib/utils";

import RichTextEditor from "@/components/RichTextEditor";

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

      <div className="glass-panel min-h-[600px] flex flex-col p-6 space-y-4">
        <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]/70">
          <Info className="h-3 w-3" />
          <span>Internal Planning Notes (Supports Rich Text & Markdown)</span>
        </div>
        
        <RichTextEditor
          content={note}
          onChange={setNote}
          placeholder="Enter your outreach strategy, states to target, and upcoming months planning here..."
        />
      </div>


    </div>
  );
}

