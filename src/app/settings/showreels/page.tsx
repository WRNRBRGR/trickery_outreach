"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, ExternalLink, Loader2, CheckCircle2, AlertCircle, Film } from "lucide-react";
import { Database } from "@/types/database";
import { cn } from "@/lib/utils";

type Showreel = Database["public"]["Tables"]["showreels"]["Row"];

interface Toast {
  id: string;
  type: "success" | "error";
  message: string;
}

export default function ShowreelsPage() {
  const [showreels, setShowreels] = useState<Showreel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    fetchShowreels();
  }, []);

  function addToast(type: Toast["type"], message: string) {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }

  async function fetchShowreels() {
    try {
      const { data, error } = await supabase
        .from("showreels")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setShowreels(data || []);
    } catch (error) {
      console.error("Error fetching showreels:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddShowreel(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase.from("showreels").insert([
        { title: newTitle, url: newUrl, description: newDesc },
      ]);

      if (error) throw error;

      setNewTitle("");
      setNewUrl("");
      setNewDesc("");
      fetchShowreels();
      addToast("success", `"${newTitle}" added successfully.`);
    } catch (error: any) {
      console.error("Error adding showreel:", error);
      addToast("error", error.message || "Failed to add showreel.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

    try {
      const { error } = await supabase.from("showreels").delete().eq("id", id);
      if (error) throw error;
      setShowreels(prev => prev.filter(r => r.id !== id));
      addToast("success", `"${title}" deleted.`);
    } catch (error: any) {
      console.error("Error deleting showreel:", error);
      addToast("error", error.message || "Failed to delete showreel.");
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Toast Notifications */}
      <div className="fixed top-6 right-6 z-50 flex flex-col space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={cn(
              "px-4 py-3 rounded-xl border flex items-center space-x-3 text-sm font-bold shadow-xl animate-in slide-in-from-right-4 fade-in duration-300 backdrop-blur-sm",
              toast.type === "success" ? "bg-indigo-950/90 text-indigo-300 border-indigo-500/30" : "bg-red-950/90 text-red-300 border-red-500/30"
            )}
          >
            {toast.type === "success" ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      <div>
        <h1 className="text-3xl font-black tracking-tight">Showreel Asset Manager</h1>
        <p className="mt-2 text-[var(--muted)]">Define your studio's creative assets for outreach targeting.</p>
      </div>

      {/* Add New Showreel Form */}
      <div className="glass-panel">
        <h2 className="text-xl font-bold mb-6 text-[var(--accent)] flex items-center">
          <Plus className="mr-2 h-5 w-5" /> Add New Profile
        </h2>
        <form onSubmit={handleAddShowreel} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Title</label>
            <input
              required
              placeholder='e.g. "3D/Houdini Reel 2024"'
              className="input-field w-full"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">URL (Vimeo/YouTube)</label>
            <input
              required
              type="url"
              placeholder="https://vimeo.com/..."
              className="input-field w-full"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Description</label>
            <textarea
              placeholder="Brief overview of the reel's focus..."
              className="input-field w-full h-24 resize-none"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              disabled={saving}
              className="btn-primary flex items-center disabled:opacity-50"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Save Profile
            </button>
          </div>
        </form>
      </div>

      {/* List of Showreels */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold px-1">Active Profiles
          <span className="ml-2 text-sm font-medium text-[var(--muted)]">({showreels.length})</span>
        </h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
          </div>
        ) : showreels.length === 0 ? (
          <div className="text-center py-16 glass-panel border-dashed border-[var(--border)]">
            <Film className="mx-auto h-10 w-10 text-[var(--border)] mb-3" />
            <p className="text-[var(--muted)] text-sm">No showreels defined yet.</p>
            <p className="text-[var(--muted)] text-xs mt-1 opacity-60">Add your first asset above to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {showreels.map((reel) => (
              <div key={reel.id} className="glass-panel group relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                      {reel.title}
                    </h3>
                    <div className="flex space-x-1">
                      <a
                        href={reel.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-[var(--background)] rounded-md text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                        title="Open in browser"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => handleDelete(reel.id, reel.title)}
                        className="p-1.5 hover:bg-red-500/10 rounded-md text-[var(--muted)] hover:text-red-500 transition-colors"
                        title="Delete showreel"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--muted)] line-clamp-3 mb-6">
                    {reel.description || "No description provided."}
                  </p>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-[var(--muted)]/50 font-bold">
                  Created {new Date(reel.created_at).toLocaleDateString()}
                </div>
                
                {/* Visual Flair */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-[var(--accent)]/10 transition-colors" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
