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
  useEffect(() => {
    const saved = localStorage.getItem("scheduling_config");
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse scheduling config", e);
      }
    }
  }, []);

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem("scheduling_config", JSON.stringify(config));
    window.dispatchEvent(new Event("scheduling_config_updated"));
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

        <div className="space-y-4 pt-6 border-t border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Smart Warm-up</label>
              <p className="text-[9px] text-[var(--muted)]">Gradually increase volume to protect sender reputation.</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, warmupEnabled: !config.warmupEnabled })}
              className={cn(
                "relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                config.warmupEnabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  config.warmupEnabled ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {config.warmupEnabled && (
            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]/70">Start Volume</label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="number"
                    value={config.warmupStart}
                    onChange={(e) => setConfig({ ...config, warmupStart: parseInt(e.target.value) || 1 })}
                    className="input-field py-1 px-2 text-xs w-full"
                  />
                  <span className="text-[9px] text-[var(--muted)]">emails</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]/70">Daily Increase</label>
                <div className="flex items-center space-x-2">
                   <input 
                    type="number"
                    value={config.warmupIncrement}
                    onChange={(e) => setConfig({ ...config, warmupIncrement: parseInt(e.target.value) || 1 })}
                    className="input-field py-1 px-2 text-xs w-full"
                  />
                  <span className="text-[9px] text-[var(--muted)]">+ emails</span>
                </div>
              </div>
            </div>
          )}
        </div>


        <div className="space-y-4 pt-6 border-t border-[var(--border)]">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Partner Calendar Sync</label>
            <a 
              href="https://support.google.com/calendar/answer/37100" 
              target="_blank" 
              className="text-[9px] font-bold text-[var(--accent)] hover:underline"
            >
              How to add?
            </a>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Werner's Feed */}
            <div className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.5)]"></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--foreground)]">Werner</span>
                </div>
                <button 
                  onClick={() => {
                    const url = `${window.location.origin}/api/calendar?key=trickery-outreach-secret&partner=indigo`;
                    navigator.clipboard.writeText(url);
                    const btn = document.getElementById('copy-werner');
                    if (btn) btn.innerText = 'Copied!';
                    setTimeout(() => { if (btn) btn.innerText = 'Copy URL'; }, 2000);
                  }}
                  id="copy-werner"
                  className="text-[9px] font-bold uppercase text-[var(--accent)] hover:underline"
                >
                  Copy URL
                </button>
              </div>
              <p className="text-[9px] text-[var(--muted)]">Syncs leads assigned to Werner (Indigo).</p>
            </div>

            {/* Louis's Feed */}
            <div className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.5)]"></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--foreground)]">Louis</span>
                </div>
                <button 
                  onClick={() => {
                    const url = `${window.location.origin}/api/calendar?key=trickery-outreach-secret&partner=rose`;
                    navigator.clipboard.writeText(url);
                    const btn = document.getElementById('copy-louis');
                    if (btn) btn.innerText = 'Copied!';
                    setTimeout(() => { if (btn) btn.innerText = 'Copy URL'; }, 2000);
                  }}
                  id="copy-louis"
                  className="text-[9px] font-bold uppercase text-[var(--accent)] hover:underline"
                >
                  Copy URL
                </button>
              </div>
              <p className="text-[9px] text-[var(--muted)]">Syncs leads assigned to Louis (Rose).</p>
            </div>
          </div>
        </div>

        <div className="pt-6 flex justify-end space-x-3">
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
