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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      active_sessions: {
        Row: {
          anon_user_id: string
          content_id: string | null
          content_kind: string | null
          content_started_at: string | null
          content_title: string | null
          id: string
          ip: string | null
          iptv_username: string | null
          last_seen_at: string
          started_at: string
          ua_hash: string | null
        }
        Insert: {
          anon_user_id: string
          content_id?: string | null
          content_kind?: string | null
          content_started_at?: string | null
          content_title?: string | null
          id?: string
          ip?: string | null
          iptv_username?: string | null
          last_seen_at?: string
          started_at?: string
          ua_hash?: string | null
        }
        Update: {
          anon_user_id?: string
          content_id?: string | null
          content_kind?: string | null
          content_started_at?: string | null
          content_title?: string | null
          id?: string
          ip?: string | null
          iptv_username?: string | null
          last_seen_at?: string
          started_at?: string
          ua_hash?: string | null
        }
        Relationships: []
      }
      allowed_servers: {
        Row: {
          consecutive_failures: number
          created_at: string
          id: string
          label: string | null
          last_working_at: string | null
          last_working_variant: string | null
          notes: string | null
          server_url: string
          unreachable_until: string | null
        }
        Insert: {
          consecutive_failures?: number
          created_at?: string
          id?: string
          label?: string | null
          last_working_at?: string | null
          last_working_variant?: string | null
          notes?: string | null
          server_url: string
          unreachable_until?: string | null
        }
        Update: {
          consecutive_failures?: number
          created_at?: string
          id?: string
          label?: string | null
          last_working_at?: string | null
          last_working_variant?: string | null
          notes?: string | null
          server_url?: string
          unreachable_until?: string | null
        }
        Relationships: []
      }
      client_diagnostics: {
        Row: {
          city: string | null
          client_error: string | null
          country: string | null
          created_at: string
          device_memory: number | null
          downlink_mbps: number | null
          duration_ms: number | null
          effective_type: string | null
          hardware_concurrency: number | null
          id: string
          ip: string | null
          isp: string | null
          language: string | null
          login_event_id: string | null
          outcome: string
          region: string | null
          rtt_ms: number | null
          save_data: boolean | null
          screen: string | null
          server_url: string | null
          speed_kbps: number | null
          timezone: string | null
          user_agent: string | null
          username: string | null
        }
        Insert: {
          city?: string | null
          client_error?: string | null
          country?: string | null
          created_at?: string
          device_memory?: number | null
          downlink_mbps?: number | null
          duration_ms?: number | null
          effective_type?: string | null
          hardware_concurrency?: number | null
          id?: string
          ip?: string | null
          isp?: string | null
          language?: string | null
          login_event_id?: string | null
          outcome: string
          region?: string | null
          rtt_ms?: number | null
          save_data?: boolean | null
          screen?: string | null
          server_url?: string | null
          speed_kbps?: number | null
          timezone?: string | null
          user_agent?: string | null
          username?: string | null
        }
        Update: {
          city?: string | null
          client_error?: string | null
          country?: string | null
          created_at?: string
          device_memory?: number | null
          downlink_mbps?: number | null
          duration_ms?: number | null
          effective_type?: string | null
          hardware_concurrency?: number | null
          id?: string
          ip?: string | null
          isp?: string | null
          language?: string | null
          login_event_id?: string | null
          outcome?: string
          region?: string | null
          rtt_ms?: number | null
          save_data?: boolean | null
          screen?: string | null
          server_url?: string | null
          speed_kbps?: number | null
          timezone?: string | null
          user_agent?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_diagnostics_login_event_id_fkey"
            columns: ["login_event_id"]
            isOneToOne: false
            referencedRelation: "login_events"
            referencedColumns: ["id"]
          },
        ]
      }
      login_events: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          reason: string | null
          server_url: string
          success: boolean
          user_agent: string | null
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          server_url: string
          success?: boolean
          user_agent?: string | null
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          server_url?: string
          success?: boolean
          user_agent?: string | null
          username?: string
        }
        Relationships: []
      }
      stream_events: {
        Row: {
          anon_user_id: string | null
          created_at: string
          event_type: string
          id: string
          ip: string | null
          meta: Json | null
          ua_hash: string | null
          url_hash: string | null
        }
        Insert: {
          anon_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip?: string | null
          meta?: Json | null
          ua_hash?: string | null
          url_hash?: string | null
        }
        Update: {
          anon_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip?: string | null
          meta?: Json | null
          ua_hash?: string | null
          url_hash?: string | null
        }
        Relationships: []
      }
      usage_counters: {
        Row: {
          anon_user_id: string
          request_count: number
          segment_count: number
          window_start: string
        }
        Insert: {
          anon_user_id: string
          request_count?: number
          segment_count?: number
          window_start: string
        }
        Update: {
          anon_user_id?: string
          request_count?: number
          segment_count?: number
          window_start?: string
        }
        Relationships: []
      }
      used_nonces: {
        Row: {
          nonce: string
          used_at: string
        }
        Insert: {
          nonce: string
          used_at?: string
        }
        Update: {
          nonce?: string
          used_at?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          anon_user_id: string
          blocked_until: string
          created_at: string
          reason: string | null
        }
        Insert: {
          anon_user_id: string
          blocked_until: string
          created_at?: string
          reason?: string | null
        }
        Update: {
          anon_user_id?: string
          blocked_until?: string
          created_at?: string
          reason?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      evict_idle_sessions: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_server_url: { Args: { url: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
