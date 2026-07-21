export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      showreels: {
        Row: {
          id: string
          title: string
          url: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          url: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          url?: string
          description?: string | null
          created_at?: string
        }
      }
      leads: {
        Row: {
          id: string
          name: string
          email: string
          state: string
          agency: string | null
          timezone: string
          scheduled_date: string
          sent_at: string | null
          showreel_id: string | null
          ai_pitch: string | null
          created_at: string
          suppressed: boolean
          suppressed_reason: "bounce" | "complaint" | "unsubscribe" | null
          bounce_count: number
          bounced_at: string | null
          sent_via: "gmail" | "ses" | null
          ses_message_id: string | null
        }
        Insert: {
          id?: string
          name: string
          email: string
          state: string
          agency?: string | null
          timezone: string
          scheduled_date: string
          sent_at?: string | null
          showreel_id?: string | null
          ai_pitch?: string | null
          created_at?: string
          suppressed?: boolean
          suppressed_reason?: "bounce" | "complaint" | "unsubscribe" | null
          bounce_count?: number
          bounced_at?: string | null
          sent_via?: "gmail" | "ses" | null
          ses_message_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          email?: string
          state?: string
          agency?: string | null
          timezone?: string
          scheduled_date?: string
          sent_at?: string | null
          showreel_id?: string | null
          ai_pitch?: string | null
          created_at?: string
          suppressed?: boolean
          suppressed_reason?: "bounce" | "complaint" | "unsubscribe" | null
          bounce_count?: number
          bounced_at?: string | null
          sent_via?: "gmail" | "ses" | null
          ses_message_id?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
