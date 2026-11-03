export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_generations: {
        Row: {
          created_at: string
          edit_ratio: number | null
          final_text: string | null
          id: string
          letter_id: string | null
          mock: boolean | null
          organization_id: string
          output: Json | null
          prompt: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          edit_ratio?: number | null
          final_text?: string | null
          id?: string
          letter_id?: string | null
          mock?: boolean | null
          organization_id: string
          output?: Json | null
          prompt: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          edit_ratio?: number | null
          final_text?: string | null
          id?: string
          letter_id?: string | null
          mock?: boolean | null
          organization_id?: string
          output?: Json | null
          prompt?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          organization_name: string | null
          title: string | null
          type: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          organization_name?: string | null
          title?: string | null
          type?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          organization_name?: string | null
          title?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          id: string
          number: string
          organization_id: string
          paid_at: string | null
          period_end: string
          period_start: string
          plan: Database["public"]["Enums"]["plan_tier"]
          status: string
          total: number
          vat: number
        }
        Insert: {
          amount: number
          id?: string
          number: string
          organization_id: string
          paid_at?: string | null
          period_end: string
          period_start: string
          plan: Database["public"]["Enums"]["plan_tier"]
          status?: string
          total: number
          vat: number
        }
        Update: {
          amount?: number
          id?: string
          number?: string
          organization_id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          status?: string
          total?: number
          vat?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_events: {
        Row: {
          at: string
          id: string
          letter_id: string
          organization_id: string
          type: string
          user_id: string | null
        }
        Insert: {
          at?: string
          id?: string
          letter_id: string
          organization_id: string
          type: string
          user_id?: string | null
        }
        Update: {
          at?: string
          id?: string
          letter_id?: string
          organization_id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "letter_events_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letter_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      letters: {
        Row: {
          ai_output: Json | null
          ai_prompt: string | null
          assigned_to: string | null
          body: Json
          cc: Json
          created_at: string
          created_by: string | null
          direction: string
          edit_ratio: number | null
          eth_year: number | null
          field_values: Json
          file_url: string | null
          finalized_at: string | null
          id: string
          letter_date: string
          organization_id: string
          recipient: Json
          reference_no: string | null
          sender: string | null
          sequence_no: number | null
          signatory_id: string | null
          source: string
          status: string
          subject: string
          template_id: string | null
          their_reference: string | null
          updated_at: string
        }
        Insert: {
          ai_output?: Json | null
          ai_prompt?: string | null
          assigned_to?: string | null
          body?: Json
          cc?: Json
          created_at?: string
          created_by?: string | null
          direction?: string
          edit_ratio?: number | null
          eth_year?: number | null
          field_values?: Json
          file_url?: string | null
          finalized_at?: string | null
          id?: string
          letter_date?: string
          organization_id: string
          recipient?: Json
          reference_no?: string | null
          sender?: string | null
          sequence_no?: number | null
          signatory_id?: string | null
          source?: string
          status?: string
          subject?: string
          template_id?: string | null
          their_reference?: string | null
          updated_at?: string
        }
        Update: {
          ai_output?: Json | null
          ai_prompt?: string | null
          assigned_to?: string | null
          body?: Json
          cc?: Json
          created_at?: string
          created_by?: string | null
          direction?: string
          edit_ratio?: number | null
          eth_year?: number | null
          field_values?: Json
          file_url?: string | null
          finalized_at?: string | null
          id?: string
          letter_date?: string
          organization_id?: string
          recipient?: Json
          reference_no?: string | null
          sender?: string | null
          sequence_no?: number | null
          signatory_id?: string | null
          source?: string
          status?: string
          subject?: string
          template_id?: string | null
          their_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "letters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letters_signatory_id_fkey"
            columns: ["signatory_id"]
            isOneToOne: false
            referencedRelation: "signatories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letters_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          created_at: string
          dept: string | null
          email: string | null
          id: string
          incoming_prefix: string
          letterhead_footer_url: string | null
          letterhead_header_url: string | null
          logo_url: string | null
          name_am: string
          name_en: string
          phone: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          ref_pattern: string
          ref_prefix: string
          reset_yearly: boolean
          tin: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          dept?: string | null
          email?: string | null
          id?: string
          incoming_prefix?: string
          letterhead_footer_url?: string | null
          letterhead_header_url?: string | null
          logo_url?: string | null
          name_am?: string
          name_en?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          ref_pattern?: string
          ref_prefix?: string
          reset_yearly?: boolean
          tin?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          dept?: string | null
          email?: string | null
          id?: string
          incoming_prefix?: string
          letterhead_footer_url?: string | null
          letterhead_header_url?: string | null
          logo_url?: string | null
          name_am?: string
          name_en?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          ref_pattern?: string
          ref_prefix?: string
          reset_yearly?: boolean
          tin?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          organization_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_counters: {
        Row: {
          direction: string
          eth_year: number
          last_seq: number
          organization_id: string
        }
        Insert: {
          direction: string
          eth_year: number
          last_seq?: number
          organization_id: string
        }
        Update: {
          direction?: string
          eth_year?: number
          last_seq?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      signatories: {
        Row: {
          created_at: string
          id: string
          name_am: string
          name_en: string | null
          organization_id: string
          position_am: string | null
          position_en: string | null
          signature_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name_am: string
          name_en?: string | null
          organization_id: string
          position_am?: string | null
          position_en?: string | null
          signature_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name_am?: string
          name_en?: string | null
          organization_id?: string
          position_am?: string | null
          position_en?: string | null
          signature_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signatories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          body_am: string
          category: string
          created_at: string
          fields: Json
          id: string
          is_active: boolean
          organization_id: string | null
          subject_am: string
          title_am: string
          title_en: string
        }
        Insert: {
          body_am?: string
          category?: string
          created_at?: string
          fields?: Json
          id?: string
          is_active?: boolean
          organization_id?: string | null
          subject_am?: string
          title_am: string
          title_en?: string
        }
        Update: {
          body_am?: string
          category?: string
          created_at?: string
          fields?: Json
          id?: string
          is_active?: boolean
          organization_id?: string | null
          subject_am?: string
          title_am?: string
          title_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      usage_monthly: {
        Row: {
          finalized_count: number | null
          month: string | null
          organization_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "letters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_org: { Args: never; Returns: string }
      finalize_letter: {
        Args: { _eth_year: number; _letter: string }
        Returns: string
      }
      format_reference: {
        Args: {
          _dept: string
          _pattern: string
          _prefix: string
          _seq: number
          _year: number
        }
        Returns: string
      }
      has_org_role: {
        Args: { _roles: Database["public"]["Enums"]["org_role"][] }
        Returns: boolean
      }
      next_reference: {
        Args: { _direction: string; _eth_year: number; _org: string }
        Returns: {
          reference_no: string
          seq: number
        }[]
      }
      plan_limit: {
        Args: { _p: Database["public"]["Enums"]["plan_tier"] }
        Returns: number
      }
      register_incoming: {
        Args: {
          _assigned: string
          _eth_year: number
          _file_url: string
          _received: string
          _sender: string
          _subject: string
          _their_ref: string
        }
        Returns: string
      }
    }
    Enums: {
      org_role: "owner" | "admin" | "writer"
      plan_tier: "basic" | "office" | "unlimited"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      org_role: ["owner", "admin", "writer"],
      plan_tier: ["basic", "office", "unlimited"],
    },
  },
} as const
