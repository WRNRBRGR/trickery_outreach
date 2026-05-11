"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database";
import { format, parseISO } from "date-fns";
import { Search, Mail, MapPin, Calendar, Clock, ArrowRight, UserCheck, History, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

interface ArchivedContact {
  email: string;
  name: string;
  agency: string | null;
  state: string;
  timezone: string;
  first_contacted: string;
  last_contacted: string;
  total_sent: number;
  last_stage: string;
  all_leads: Lead[];
}

export default function LeadArchivePage() {
  const [contacts, setContacts] = useState<ArchivedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  useEffect(() => {
    fetchArchivedLeads();
  }, []);

  async function fetchArchivedLeads() {
    try {
      // Get all leads that have been sent
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: false });

      if (error) throw error;
      
      // Group by email to create contact-centric view
      const groups: Record<string, Lead[]> = {};
      data?.forEach(lead => {
        if (!groups[lead.email]) groups[lead.email] = [];
        groups[lead.email].push(lead);
      });

      const archivedContacts: ArchivedContact[] = Object.entries(groups).map(([email, leads]) => {
        // Sort leads by sent_at to find first/last
        const sortedLeads = [...leads].sort((a, b) => 
          new Date(a.sent_at!).getTime() - new Date(b.sent_at!).getTime()
        );

        const firstLead = sortedLeads[0];
        const lastLead = sortedLeads[sortedLeads.length - 1];

        // Parse stage from last lead
        let lastStage = "INTRO";
        if (lastLead.ai_pitch) {
          try {
            if (lastLead.ai_pitch.startsWith("{")) {
              const data = JSON.parse(lastLead.ai_pitch);
              lastStage = data.stage || "INTRO";
            } else {
              const match = lastLead.ai_pitch.match(/^\[(INTRO|SHOWREELS|CURTAIN_CALL)\]/);
              lastStage = match ? match[1] : "INTRO";
            }
          } catch (e) {
            const match = lastLead.ai_pitch.match(/^\[(INTRO|SHOWREELS|CURTAIN_CALL)\]/);
            lastStage = match ? match[1] : "INTRO";
          }
        }

        return {
          email,
          name: lastLead.name,
          agency: lastLead.agency,
          state: lastLead.state,
          timezone: lastLead.timezone,
          first_contacted: firstLead.sent_at!,
          last_contacted: lastLead.sent_at!,
          total_sent: leads.length,
          last_stage: lastStage,
          all_leads: leads
        };
      });

      setContacts(archivedContacts);
    } catch (error) {
      console.error("Error fetching archived leads:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.agency?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Lead Archive</h1>
          <p className="mt-2 text-[var(--muted)]">{contacts.length} total contacts reached.</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted)]" />
            <input 
              placeholder="Search archive..."
              className="input-field pl-9 w-64 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="glass-panel p-0 overflow-hidden border-[var(--border)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Contact Details</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Outreach Stats</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">First Reached</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center space-y-2">
                      <History className="h-6 w-6 animate-spin text-[var(--accent)] mx-auto opacity-50" />
                      <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest">Loading Archive...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[var(--muted)]">
                    <div className="flex flex-col items-center space-y-2">
                      <UserCheck className="h-5 w-5 opacity-20" />
                      <p className="text-sm">No archived contacts found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr key={contact.email} className="hover:bg-[var(--foreground)]/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-[var(--foreground)] text-sm">{contact.name}</span>
                          <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] text-[9px] font-black uppercase tracking-tighter">
                            <UserCheck className="h-2.5 w-2.5" />
                            <span>Contacted</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-[var(--muted)] font-medium">{contact.agency || "Independent"}</span>
                        <div className="flex items-center space-x-1.5 mt-1.5 text-[10px] text-[var(--muted)]">
                          <Mail className="h-2.5 w-2.5" />
                          <span>{contact.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <div className="flex -space-x-1">
                            {Array.from({ length: contact.total_sent }).map((_, i) => (
                              <div key={i} className="h-2 w-2 rounded-full border border-[var(--background)] bg-[var(--accent)]" />
                            ))}
                            {Array.from({ length: Math.max(0, 3 - contact.total_sent) }).map((_, i) => (
                              <div key={i} className="h-2 w-2 rounded-full border border-[var(--background)] bg-[var(--border)]" />
                            ))}
                          </div>
                          <span className="text-[10px] font-bold text-[var(--foreground)]">{contact.total_sent}/3 Sequences</span>
                        </div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">
                          Latest: <span className="text-[var(--accent)]">{contact.last_stage}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2 text-xs text-[var(--foreground)]">
                        <Calendar className="h-3.5 w-3.5 text-[var(--muted)]" />
                        <span className="font-medium">{format(parseISO(contact.first_contacted), "MMM d, yyyy")}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                           <span className="text-xs font-medium text-[var(--foreground)]">{format(parseISO(contact.last_contacted), "MMM d, yyyy")}</span>
                           <span className="text-[9px] text-[var(--muted)] uppercase font-bold">{format(parseISO(contact.last_contacted), "h:mm a")}</span>
                        </div>
                        <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-[var(--accent)]/10 rounded-full transition-all text-[var(--accent)]">
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
