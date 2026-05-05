"use client";

import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDefaultConfig, SchedulingConfig } from "@/lib/scheduling";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SchedulingSettings({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<SchedulingConfig>(getDefaultConfig());

  const handleToggleDay = (dayIndex: number) => {
    setConfig(prev => {
      const activeDays = prev.activeDays.includes(dayIndex)
        ? prev.activeDays.filter(d => d !== dayIndex)
        : [...prev.activeDays, dayIndex].sort();
      return { ...prev, activeDays };
    });
  };

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem("scheduling_config", JSON.stringify(config));
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 1000);
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="glass-panel w-full max-w-md space-y-6 relative border-[var(--border)]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <X className="h-4 w-4" />
        </button>

        <div>
          <h2 className="text-xl font-black tracking-tight">Scheduling Rules</h2>
          <p className="text-xs text-[var(--muted)] mt-1">Control how leads are spaced across the calendar.</p>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Days Between Emails</label>
          <div className="flex items-center space-x-4">
            <input 
              type="range" 
              min="1" 
              max="7" 
              step="1"
              value={config.daysBetween}
              onChange={(e) => setConfig({ ...config, daysBetween: parseInt(e.target.value) })}
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="text-lg font-black w-8">{config.daysBetween}</span>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Daily Email Limit</label>
          <div className="flex items-center space-x-4">
            <input 
              type="range" 
              min="1" 
              max="50" 
              step="1"
              value={config.dailyLimit}
              onChange={(e) => setConfig({ ...config, dailyLimit: parseInt(e.target.value) })}
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="text-lg font-black w-8">{config.dailyLimit}</span>
          </div>
        </div>


        <div className="space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Active Outreach Days</label>
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((day, idx) => {
              const isActive = config.activeDays.includes(idx);
              return (
                <button
                  key={day}
                  onClick={() => handleToggleDay(idx)}
                  className={cn(
                    "flex flex-col items-center justify-center py-2 rounded-md border transition-all",
                    isActive 
                      ? "bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]" 
                      : "bg-[var(--background)] border-[var(--border)] text-[var(--muted)]"
                  )}
                >
                  <span className="text-[8px] font-bold uppercase">{day}</span>
                  {isActive && <Check className="h-2 w-2 mt-1" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-4 flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={saved}
            className={cn(
              "btn-primary py-2 px-6 text-xs flex items-center space-x-2",
              saved && "from-emerald-500 to-teal-500 shadow-emerald-500/20"
            )}
          >
            {saved && <Check className="h-4 w-4" />}
            <span>{saved ? "Changes Applied!" : "Apply Changes"}</span>
          </button>

        </div>
      </div>
    </div>
  );
}
