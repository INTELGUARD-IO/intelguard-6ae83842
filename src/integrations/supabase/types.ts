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
      raw_indicators: {
        Row: {
          first_seen: string
          id: number
          indicator: string
          kind: string
          last_seen: string
          source: string
        }
        Insert: {
          first_seen?: string
          id?: number
          indicator: string
          kind: string
          last_seen?: string
          source: string
        }
        Update: {
          first_seen?: string
          id?: number
          indicator?: string
          kind?: string
          last_seen?: string
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
