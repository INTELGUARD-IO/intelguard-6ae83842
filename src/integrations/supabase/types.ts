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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      abuse_ch_fplist: {
        Row: {
          added_at: string
          expires_at: string
          indicator: string
          kind: string
        }
        Insert: {
          added_at?: string
          expires_at?: string
          indicator: string
          kind: string
        }
        Update: {
          added_at?: string
          expires_at?: string
          indicator?: string
          kind?: string
        }
        Relationships: []
      }
      abuseipdb_blacklist: {
        Row: {
          abuse_confidence_score: number
          added_at: string
          expires_at: string
          indicator: string
          last_reported_at: string
        }
        Insert: {
          abuse_confidence_score: number
          added_at?: string
          expires_at?: string
          indicator: string
          last_reported_at: string
        }
        Update: {
          abuse_confidence_score?: number
          added_at?: string
          expires_at?: string
          indicator?: string
          last_reported_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_deltas: {
        Row: {
          added: number
          id: number
          kind: string
          removed: number
          run_date: string
        }
        Insert: {
          added: number
          id?: number
          kind: string
          removed: number
          run_date: string
        }
        Update: {
          added?: number
          id?: number
          kind?: string
          removed?: number
          run_date?: string
        }
        Relationships: []
      }
      dynamic_raw_indicators: {
        Row: {
          abuse_ch_checked: boolean
          abuse_ch_is_fp: boolean | null
          abuseipdb_checked: boolean
          abuseipdb_in_blacklist: boolean | null
          abuseipdb_score: number | null
          confidence: number
          first_validated: string
          honeydb_checked: boolean
          honeydb_in_blacklist: boolean | null
          honeydb_threat_score: number | null
          id: number
          indicator: string
          kind: string
          last_validated: string
          source_count: number
          sources: string[]
          urlscan_checked: boolean
          urlscan_malicious: boolean | null
          urlscan_score: number | null
        }
        Insert: {
          abuse_ch_checked?: boolean
          abuse_ch_is_fp?: boolean | null
          abuseipdb_checked?: boolean
          abuseipdb_in_blacklist?: boolean | null
          abuseipdb_score?: number | null
          confidence: number
          first_validated?: string
          honeydb_checked?: boolean
          honeydb_in_blacklist?: boolean | null
          honeydb_threat_score?: number | null
          id?: number
          indicator: string
          kind: string
          last_validated?: string
          source_count?: number
          sources: string[]
          urlscan_checked?: boolean
          urlscan_malicious?: boolean | null
          urlscan_score?: number | null
        }
        Update: {
          abuse_ch_checked?: boolean
          abuse_ch_is_fp?: boolean | null
          abuseipdb_checked?: boolean
          abuseipdb_in_blacklist?: boolean | null
          abuseipdb_score?: number | null
          confidence?: number
          first_validated?: string
          honeydb_checked?: boolean
          honeydb_in_blacklist?: boolean | null
          honeydb_threat_score?: number | null
          id?: number
          indicator?: string
          kind?: string
          last_validated?: string
          source_count?: number
          sources?: string[]
          urlscan_checked?: boolean
          urlscan_malicious?: boolean | null
          urlscan_score?: number | null
        }
        Relationships: []
      }
      email_preferences: {
        Row: {
          freq: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          freq?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          freq?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feed_access_logs: {
        Row: {
          created_at: string
          id: number
          ip: string | null
          kind: string
          token: string
          ua: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          ip?: string | null
          kind: string
          token: string
          ua?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          ip?: string | null
          kind?: string
          token?: string
          ua?: string | null
        }
        Relationships: []
      }
      feed_tokens: {
        Row: {
          created_at: string
          customer_id: string | null
          enabled: boolean
          id: string
          tenant_id: string | null
          token: string
          type: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          enabled?: boolean
          id?: string
          tenant_id?: string | null
          token: string
          type: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          enabled?: boolean
          id?: string
          tenant_id?: string | null
          token?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      honeydb_blacklist: {
        Row: {
          added_at: string
          expires_at: string
          indicator: string
          last_seen: string
          threat_score: number | null
        }
        Insert: {
          added_at?: string
          expires_at?: string
          indicator: string
          last_seen?: string
          threat_score?: number | null
        }
        Update: {
          added_at?: string
          expires_at?: string
          indicator?: string
          last_seen?: string
          threat_score?: number | null
        }
        Relationships: []
      }
      indicator_snapshots: {
        Row: {
          created_at: string
          id: number
          indicator: string
          kind: string
          snapshot_date: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: number
          indicator: string
          kind: string
          snapshot_date: string
          source: string
        }
        Update: {
          created_at?: string
          id?: number
          indicator?: string
          kind?: string
          snapshot_date?: string
          source?: string
        }
        Relationships: []
      }
      ingest_logs: {
        Row: {
          completed_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: number
          indicators_fetched: number | null
          source_id: string
          source_name: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: never
          indicators_fetched?: number | null
          source_id: string
          source_name: string
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: never
          indicators_fetched?: number | null
          source_id?: string
          source_name?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_source"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "ingest_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_sources: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          indicators_count: number | null
          kind: string
          last_attempt: string | null
          last_error: string | null
          last_run: string | null
          last_success: string | null
          name: string
          priority: number | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          indicators_count?: number | null
          kind: string
          last_attempt?: string | null
          last_error?: string | null
          last_run?: string | null
          last_success?: string | null
          name: string
          priority?: number | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          indicators_count?: number | null
          kind?: string
          last_attempt?: string | null
          last_error?: string | null
          last_run?: string | null
          last_success?: string | null
          name?: string
          priority?: number | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      raw_indicators: {
        Row: {
          first_seen: string
          id: number
          indicator: string
          kind: string
          last_seen: string
          removed_at: string | null
          source: string
        }
        Insert: {
          first_seen?: string
          id?: number
          indicator: string
          kind: string
          last_seen?: string
          removed_at?: string | null
          source: string
        }
        Update: {
          first_seen?: string
          id?: number
          indicator?: string
          kind?: string
          last_seen?: string
          removed_at?: string | null
          source?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          message: string | null
          subject: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          subject?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          subject?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_audit_logs: {
        Row: {
          created_at: string
          description: string | null
          execution_time_ms: number | null
          id: string
          metadata: Json | null
          operation_name: string
          operation_type: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          execution_time_ms?: number | null
          id?: string
          metadata?: Json | null
          operation_name: string
          operation_type: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          execution_time_ms?: number | null
          id?: string
          metadata?: Json | null
          operation_name?: string
          operation_type?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tenant_members: {
        Row: {
          created_at: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          type?: string
        }
        Relationships: []
      }
      validated_indicators: {
        Row: {
          asn: string | null
          confidence: number
          country: string | null
          indicator: string
          kind: string
          last_validated: string
        }
        Insert: {
          asn?: string | null
          confidence: number
          country?: string | null
          indicator: string
          kind: string
          last_validated?: string
        }
        Update: {
          asn?: string | null
          confidence?: number
          country?: string | null
          indicator?: string
          kind?: string
          last_validated?: string
        }
        Relationships: []
      }
      validation_jobs: {
        Row: {
          attempts: number
          id: number
          indicator: string
          kind: string
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          id?: number
          indicator: string
          kind: string
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          id?: number
          indicator?: string
          kind?: string
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      vendor_checks: {
        Row: {
          checked_at: string
          id: number
          indicator: string
          kind: string
          raw: Json | null
          score: number | null
          vendor: string
        }
        Insert: {
          checked_at?: string
          id?: number
          indicator: string
          kind: string
          raw?: Json | null
          score?: number | null
          vendor: string
        }
        Update: {
          checked_at?: string
          id?: number
          indicator?: string
          kind?: string
          raw?: Json | null
          score?: number | null
          vendor?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _call_edge: {
        Args: { function_name: string }
        Returns: undefined
      }
      clean_expired_abuse_ch_fplist: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      clean_expired_abuseipdb_blacklist: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      clean_expired_honeydb_blacklist: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_cron_jobs: {
        Args: Record<PropertyKey, never>
        Returns: {
          active: boolean
          command: string
          database: string
          jobid: number
          jobname: string
          nodename: string
          nodeport: number
          schedule: string
          username: string
        }[]
      }
      is_super_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
