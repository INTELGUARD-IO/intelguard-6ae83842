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
      bgpview_enrichment: {
        Row: {
          asn: number | null
          asn_description: string | null
          asn_name: string | null
          checked_at: string
          cidr: number | null
          country_code: string | null
          expires_at: string
          id: string
          indicator: string
          kind: string
          prefix: string | null
          ptr_record: string | null
          raw_response: Json | null
        }
        Insert: {
          asn?: number | null
          asn_description?: string | null
          asn_name?: string | null
          checked_at?: string
          cidr?: number | null
          country_code?: string | null
          expires_at?: string
          id?: string
          indicator: string
          kind?: string
          prefix?: string | null
          ptr_record?: string | null
          raw_response?: Json | null
        }
        Update: {
          asn?: number | null
          asn_description?: string | null
          asn_name?: string | null
          checked_at?: string
          cidr?: number | null
          country_code?: string | null
          expires_at?: string
          id?: string
          indicator?: string
          kind?: string
          prefix?: string | null
          ptr_record?: string | null
          raw_response?: Json | null
        }
        Relationships: []
      }
      censys_monthly_usage: {
        Row: {
          api_calls_count: number
          created_at: string
          id: string
          month: string
          updated_at: string
        }
        Insert: {
          api_calls_count?: number
          created_at?: string
          id?: string
          month: string
          updated_at?: string
        }
        Update: {
          api_calls_count?: number
          created_at?: string
          id?: string
          month?: string
          updated_at?: string
        }
        Relationships: []
      }
      cloudflare_radar_enrichment: {
        Row: {
          asn: number | null
          asn_name: string | null
          checked_at: string
          country_code: string | null
          expires_at: string
          id: string
          indicator: string
          kind: string
          prefix: string | null
          raw_response: Json | null
        }
        Insert: {
          asn?: number | null
          asn_name?: string | null
          checked_at?: string
          country_code?: string | null
          expires_at?: string
          id?: string
          indicator: string
          kind?: string
          prefix?: string | null
          raw_response?: Json | null
        }
        Update: {
          asn?: number | null
          asn_name?: string | null
          checked_at?: string
          country_code?: string | null
          expires_at?: string
          id?: string
          indicator?: string
          kind?: string
          prefix?: string | null
          raw_response?: Json | null
        }
        Relationships: []
      }
      cloudflare_radar_top_domains: {
        Row: {
          added_at: string
          bucket: string
          dataset_id: string | null
          domain: string
          expires_at: string
          rank: number | null
        }
        Insert: {
          added_at?: string
          bucket?: string
          dataset_id?: string | null
          domain: string
          expires_at?: string
          rank?: number | null
        }
        Update: {
          added_at?: string
          bucket?: string
          dataset_id?: string | null
          domain?: string
          expires_at?: string
          rank?: number | null
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
          censys_checked: boolean
          censys_malicious: boolean | null
          censys_score: number | null
          confidence: number
          first_validated: string
          honeydb_checked: boolean
          honeydb_in_blacklist: boolean | null
          honeydb_threat_score: number | null
          id: number
          indicator: string
          kind: string
          last_validated: string
          neutrinoapi_checked: boolean
          neutrinoapi_host_reputation_score: number | null
          neutrinoapi_in_blocklist: boolean | null
          neutrinoapi_is_hosting: boolean | null
          neutrinoapi_is_proxy: boolean | null
          neutrinoapi_is_vpn: boolean | null
          neutrinoapi_metadata: Json | null
          otx_checked: boolean
          otx_score: number | null
          otx_verdict: string | null
          safebrowsing_checked: boolean
          safebrowsing_score: number | null
          safebrowsing_verdict: string | null
          source_count: number
          sources: string[]
          urlscan_checked: boolean
          urlscan_malicious: boolean | null
          urlscan_score: number | null
          virustotal_checked: boolean
          virustotal_malicious: boolean | null
          virustotal_score: number | null
        }
        Insert: {
          abuse_ch_checked?: boolean
          abuse_ch_is_fp?: boolean | null
          abuseipdb_checked?: boolean
          abuseipdb_in_blacklist?: boolean | null
          abuseipdb_score?: number | null
          censys_checked?: boolean
          censys_malicious?: boolean | null
          censys_score?: number | null
          confidence: number
          first_validated?: string
          honeydb_checked?: boolean
          honeydb_in_blacklist?: boolean | null
          honeydb_threat_score?: number | null
          id?: number
          indicator: string
          kind: string
          last_validated?: string
          neutrinoapi_checked?: boolean
          neutrinoapi_host_reputation_score?: number | null
          neutrinoapi_in_blocklist?: boolean | null
          neutrinoapi_is_hosting?: boolean | null
          neutrinoapi_is_proxy?: boolean | null
          neutrinoapi_is_vpn?: boolean | null
          neutrinoapi_metadata?: Json | null
          otx_checked?: boolean
          otx_score?: number | null
          otx_verdict?: string | null
          safebrowsing_checked?: boolean
          safebrowsing_score?: number | null
          safebrowsing_verdict?: string | null
          source_count?: number
          sources: string[]
          urlscan_checked?: boolean
          urlscan_malicious?: boolean | null
          urlscan_score?: number | null
          virustotal_checked?: boolean
          virustotal_malicious?: boolean | null
          virustotal_score?: number | null
        }
        Update: {
          abuse_ch_checked?: boolean
          abuse_ch_is_fp?: boolean | null
          abuseipdb_checked?: boolean
          abuseipdb_in_blacklist?: boolean | null
          abuseipdb_score?: number | null
          censys_checked?: boolean
          censys_malicious?: boolean | null
          censys_score?: number | null
          confidence?: number
          first_validated?: string
          honeydb_checked?: boolean
          honeydb_in_blacklist?: boolean | null
          honeydb_threat_score?: number | null
          id?: number
          indicator?: string
          kind?: string
          last_validated?: string
          neutrinoapi_checked?: boolean
          neutrinoapi_host_reputation_score?: number | null
          neutrinoapi_in_blocklist?: boolean | null
          neutrinoapi_is_hosting?: boolean | null
          neutrinoapi_is_proxy?: boolean | null
          neutrinoapi_is_vpn?: boolean | null
          neutrinoapi_metadata?: Json | null
          otx_checked?: boolean
          otx_score?: number | null
          otx_verdict?: string | null
          safebrowsing_checked?: boolean
          safebrowsing_score?: number | null
          safebrowsing_verdict?: string | null
          source_count?: number
          sources?: string[]
          urlscan_checked?: boolean
          urlscan_malicious?: boolean | null
          urlscan_score?: number | null
          virustotal_checked?: boolean
          virustotal_malicious?: boolean | null
          virustotal_score?: number | null
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
      google_safebrowsing_cache: {
        Row: {
          checked_at: string
          expires_at: string
          indicator: string
          is_threat: boolean
          kind: string
          platform_types: string[] | null
          raw_response: Json | null
          score: number
          threat_entry_types: string[] | null
          threat_types: string[] | null
          verdict: string
        }
        Insert: {
          checked_at?: string
          expires_at?: string
          indicator: string
          is_threat?: boolean
          kind: string
          platform_types?: string[] | null
          raw_response?: Json | null
          score?: number
          threat_entry_types?: string[] | null
          threat_types?: string[] | null
          verdict?: string
        }
        Update: {
          checked_at?: string
          expires_at?: string
          indicator?: string
          is_threat?: boolean
          kind?: string
          platform_types?: string[] | null
          raw_response?: Json | null
          score?: number
          threat_entry_types?: string[] | null
          threat_types?: string[] | null
          verdict?: string
        }
        Relationships: []
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
      network_activity_log: {
        Row: {
          bytes_transferred: number | null
          call_type: string
          completed_at: string | null
          edge_function_name: string | null
          error_message: string | null
          id: string
          items_processed: number | null
          items_total: number | null
          metadata: Json | null
          method: string
          request_headers: Json | null
          response_time_ms: number | null
          started_at: string
          status: string
          status_code: number | null
          target_name: string
          target_url: string
          user_id: string | null
        }
        Insert: {
          bytes_transferred?: number | null
          call_type: string
          completed_at?: string | null
          edge_function_name?: string | null
          error_message?: string | null
          id?: string
          items_processed?: number | null
          items_total?: number | null
          metadata?: Json | null
          method?: string
          request_headers?: Json | null
          response_time_ms?: number | null
          started_at?: string
          status?: string
          status_code?: number | null
          target_name: string
          target_url: string
          user_id?: string | null
        }
        Update: {
          bytes_transferred?: number | null
          call_type?: string
          completed_at?: string | null
          edge_function_name?: string | null
          error_message?: string | null
          id?: string
          items_processed?: number | null
          items_total?: number | null
          metadata?: Json | null
          method?: string
          request_headers?: Json | null
          response_time_ms?: number | null
          started_at?: string
          status?: string
          status_code?: number | null
          target_name?: string
          target_url?: string
          user_id?: string | null
        }
        Relationships: []
      }
      neutrinoapi_blocklist: {
        Row: {
          added_at: string
          category: string | null
          expires_at: string
          indicator: string
          kind: string
        }
        Insert: {
          added_at?: string
          category?: string | null
          expires_at?: string
          indicator: string
          kind?: string
        }
        Update: {
          added_at?: string
          category?: string | null
          expires_at?: string
          indicator?: string
          kind?: string
        }
        Relationships: []
      }
      otx_enrichment: {
        Row: {
          asn: string | null
          authors_count: number | null
          country: string | null
          indicator: string
          kind: string
          latest_pulse: string | null
          pulses_count: number | null
          raw_otx: Json | null
          reasons: string[] | null
          refreshed_at: string
          score: number | null
          tags: string[] | null
          ttl_seconds: number | null
          verdict: string | null
        }
        Insert: {
          asn?: string | null
          authors_count?: number | null
          country?: string | null
          indicator: string
          kind: string
          latest_pulse?: string | null
          pulses_count?: number | null
          raw_otx?: Json | null
          reasons?: string[] | null
          refreshed_at?: string
          score?: number | null
          tags?: string[] | null
          ttl_seconds?: number | null
          verdict?: string | null
        }
        Update: {
          asn?: string | null
          authors_count?: number | null
          country?: string | null
          indicator?: string
          kind?: string
          latest_pulse?: string | null
          pulses_count?: number | null
          raw_otx?: Json | null
          reasons?: string[] | null
          refreshed_at?: string
          score?: number | null
          tags?: string[] | null
          ttl_seconds?: number | null
          verdict?: string | null
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
      ripestat_enrichment: {
        Row: {
          abuse_email: string | null
          asn: number | null
          asn_holder: string | null
          checked_at: string
          city: string | null
          country_code: string | null
          country_name: string | null
          expires_at: string
          geolocation_data: Json | null
          id: string
          indicator: string
          kind: string
          latitude: number | null
          longitude: number | null
          network_info: Json | null
          prefix: string | null
          ptr_record: string | null
          routing_status: Json | null
          whois_data: Json | null
        }
        Insert: {
          abuse_email?: string | null
          asn?: number | null
          asn_holder?: string | null
          checked_at?: string
          city?: string | null
          country_code?: string | null
          country_name?: string | null
          expires_at?: string
          geolocation_data?: Json | null
          id?: string
          indicator: string
          kind: string
          latitude?: number | null
          longitude?: number | null
          network_info?: Json | null
          prefix?: string | null
          ptr_record?: string | null
          routing_status?: Json | null
          whois_data?: Json | null
        }
        Update: {
          abuse_email?: string | null
          asn?: number | null
          asn_holder?: string | null
          checked_at?: string
          city?: string | null
          country_code?: string | null
          country_name?: string | null
          expires_at?: string
          geolocation_data?: Json | null
          id?: string
          indicator?: string
          kind?: string
          latitude?: number | null
          longitude?: number | null
          network_info?: Json | null
          prefix?: string | null
          ptr_record?: string | null
          routing_status?: Json | null
          whois_data?: Json | null
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
      virustotal_cache: {
        Row: {
          checked_at: string
          expires_at: string
          harmless_count: number | null
          indicator: string
          kind: string
          last_analysis_stats: Json | null
          malicious_count: number | null
          reputation: number | null
          suspicious_count: number | null
          undetected_count: number | null
        }
        Insert: {
          checked_at?: string
          expires_at?: string
          harmless_count?: number | null
          indicator: string
          kind: string
          last_analysis_stats?: Json | null
          malicious_count?: number | null
          reputation?: number | null
          suspicious_count?: number | null
          undetected_count?: number | null
        }
        Update: {
          checked_at?: string
          expires_at?: string
          harmless_count?: number | null
          indicator?: string
          kind?: string
          last_analysis_stats?: Json | null
          malicious_count?: number | null
          reputation?: number | null
          suspicious_count?: number | null
          undetected_count?: number | null
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
      clean_expired_bgpview_cache: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      clean_expired_cf_radar_cache: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      clean_expired_cf_radar_domains: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      clean_expired_honeydb_blacklist: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      clean_expired_neutrinoapi_blocklist: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      clean_expired_otx_cache: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      clean_expired_ripestat_cache: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      clean_expired_safebrowsing_cache: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      clean_expired_virustotal_cache: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      count_unique_indicators: {
        Args: { p_kind: string }
        Returns: number
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
      get_current_month_censys_usage: {
        Args: Record<PropertyKey, never>
        Returns: {
          api_calls_count: number
          id: string
          month: string
          remaining_calls: number
        }[]
      }
      increment_censys_usage: {
        Args: { calls_count?: number }
        Returns: undefined
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
