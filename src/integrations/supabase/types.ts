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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auth_events: {
        Row: {
          created_at: string
          email: string | null
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      export_history: {
        Row: {
          created_at: string
          file_name: string
          file_size_bytes: number
          filters: Json | null
          format: string
          id: string
          ip_address: unknown
          row_count: number
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size_bytes?: number
          filters?: Json | null
          format: string
          id?: string
          ip_address?: unknown
          row_count?: number
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size_bytes?: number
          filters?: Json | null
          format?: string
          id?: string
          ip_address?: unknown
          row_count?: number
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      incident_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          id: string
          incident_id: string
          mime_type: string | null
          scan_notes: string | null
          scan_status: Database["public"]["Enums"]["attachment_scan_status"]
          storage_path: string
          tags: string[]
          updated_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number
          id?: string
          incident_id: string
          mime_type?: string | null
          scan_notes?: string | null
          scan_status?: Database["public"]["Enums"]["attachment_scan_status"]
          storage_path: string
          tags?: string[]
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          incident_id?: string
          mime_type?: string | null
          scan_notes?: string | null
          scan_status?: Database["public"]["Enums"]["attachment_scan_status"]
          storage_path?: string
          tags?: string[]
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "incident_attachments_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_response_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["response_action_type"]
          created_at: string
          id: string
          incident_id: string
          instructions: string
          priority: Database["public"]["Enums"]["incident_severity"]
          requested_by: string | null
          requested_by_email: string | null
          status: Database["public"]["Enums"]["response_action_status"]
          updated_at: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["response_action_type"]
          created_at?: string
          id?: string
          incident_id: string
          instructions: string
          priority: Database["public"]["Enums"]["incident_severity"]
          requested_by?: string | null
          requested_by_email?: string | null
          status?: Database["public"]["Enums"]["response_action_status"]
          updated_at?: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["response_action_type"]
          created_at?: string
          id?: string
          incident_id?: string
          instructions?: string
          priority?: Database["public"]["Enums"]["incident_severity"]
          requested_by?: string | null
          requested_by_email?: string | null
          status?: Database["public"]["Enums"]["response_action_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_response_actions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_status_history: {
        Row: {
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["incident_status"] | null
          id: string
          incident_id: string
          note: string | null
          to_status: Database["public"]["Enums"]["incident_status"]
        }
        Insert: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["incident_status"] | null
          id?: string
          incident_id: string
          note?: string | null
          to_status: Database["public"]["Enums"]["incident_status"]
        }
        Update: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["incident_status"] | null
          id?: string
          incident_id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["incident_status"]
        }
        Relationships: [
          {
            foreignKeyName: "incident_status_history_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          attachments: Json
          casualties: number
          category: string
          client_submission_id: string | null
          created_at: string
          deleted_at: string | null
          department: string | null
          description: string
          district: string | null
          fatalities: number
          gps_coordinates: string | null
          id: string
          incident_date: string
          incident_type: string | null
          injury_type: string | null
          location_name: string
          previous_channel: string | null
          product_type: string | null
          reference_code: string | null
          region: string
          reporter_id: string | null
          reporter_name: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          source: string | null
          source_contact: string | null
          source_notes: string | null
          status: Database["public"]["Enums"]["incident_status"]
          submission_state: Database["public"]["Enums"]["submission_state"]
          expected_attachments: number
          updated_at: string
          verification_notes: string | null
          verification_score: number | null
        }
        Insert: {
          attachments?: Json
          casualties?: number
          category: string
          client_submission_id?: string | null
          created_at?: string
          deleted_at?: string | null
          department?: string | null
          description: string
          district?: string | null
          fatalities?: number
          gps_coordinates?: string | null
          id?: string
          incident_date: string
          incident_type?: string | null
          injury_type?: string | null
          location_name: string
          previous_channel?: string | null
          product_type?: string | null
          reference_code?: string | null
          region: string
          reporter_id?: string | null
          reporter_name?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          source?: string | null
          source_contact?: string | null
          source_notes?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          submission_state?: Database["public"]["Enums"]["submission_state"]
          expected_attachments?: number
          updated_at?: string
          verification_notes?: string | null
          verification_score?: number | null
        }
        Update: {
          attachments?: Json
          casualties?: number
          category?: string
          client_submission_id?: string | null
          created_at?: string
          deleted_at?: string | null
          department?: string | null
          description?: string
          district?: string | null
          fatalities?: number
          gps_coordinates?: string | null
          id?: string
          incident_date?: string
          incident_type?: string | null
          injury_type?: string | null
          location_name?: string
          previous_channel?: string | null
          product_type?: string | null
          reference_code?: string | null
          region?: string
          reporter_id?: string | null
          reporter_name?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          source?: string | null
          source_contact?: string | null
          source_notes?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          submission_state?: Database["public"]["Enums"]["submission_state"]
          expected_attachments?: number
          updated_at?: string
          verification_notes?: string | null
          verification_score?: number | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          daily_summary: boolean
          email_alerts: boolean
          in_app_alerts: boolean
          notify_on_new_incident: boolean
          notify_on_status_change: boolean
          quiet_hours: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          sms_critical: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_summary?: boolean
          email_alerts?: boolean
          in_app_alerts?: boolean
          notify_on_new_incident?: boolean
          notify_on_status_change?: boolean
          quiet_hours?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          sms_critical?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_summary?: boolean
          email_alerts?: boolean
          in_app_alerts?: boolean
          notify_on_new_incident?: boolean
          notify_on_status_change?: boolean
          quiet_hours?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          sms_critical?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          category: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string
          full_name: string | null
          id: string
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          full_name?: string | null
          id: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      query_templates: {
        Row: {
          created_at: string
          definition: Json
          description: string | null
          id: string
          is_shared: boolean
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          definition?: Json
          description?: string | null
          id?: string
          is_shared?: boolean
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          definition?: Json
          description?: string | null
          id?: string
          is_shared?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
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
      admin_set_user_role: {
        Args: { _user_id: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      begin_incident_submission: {
        Args: { _submission_id: string; _payload: Json; _expected_attachments?: number }
        Returns: Database["public"]["Tables"]["incidents"]["Row"]
      }
      create_incident_response_action: {
        Args: {
          _incident_id: string
          _action: Database["public"]["Enums"]["response_action_type"]
          _instructions: string
        }
        Returns: Database["public"]["Tables"]["incident_response_actions"]["Row"]
      }
      current_role_level: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
      get_unread_notifications_count: {
        Args: never
        Returns: number
      }
      mark_all_notifications_read: {
        Args: never
        Returns: number
      }
      finalize_incident_submission: {
        Args: { _incident_id: string }
        Returns: Database["public"]["Tables"]["incidents"]["Row"]
      }
      transition_incident_status: {
        Args: { _incident_id: string; _to_status: Database["public"]["Enums"]["incident_status"]; _note?: string | null }
        Returns: Database["public"]["Tables"]["incidents"]["Row"]
      }
    }
    Enums: {
      account_status: "pending" | "active" | "suspended"
      app_role: "collector" | "analyst" | "admin"
      attachment_scan_status: "pending" | "clean" | "infected" | "skipped"
      incident_severity: "low" | "medium" | "high" | "critical"
      incident_status:
        | "New"
        | "Reviewed"
        | "Closed"
        | "draft"
        | "submitted"
        | "under_review"
        | "returned"
        | "verified"
        | "archived"
      submission_state: "staging" | "complete" | "failed"
      response_action_type:
        | "dispatch_team"
        | "escalate_alert"
        | "lockdown_protocol"
        | "request_reinforcement"
      response_action_status: "requested" | "acknowledged" | "completed" | "cancelled"
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
      account_status: ["pending", "active", "suspended"],
      app_role: ["collector", "analyst", "admin"],
      attachment_scan_status: ["pending", "clean", "infected", "skipped"],
      incident_severity: ["low", "medium", "high", "critical"],
      incident_status: [
        "New",
        "Reviewed",
        "Closed",
        "draft",
        "submitted",
        "under_review",
        "returned",
        "verified",
        "archived",
      ],
      submission_state: ["staging", "complete", "failed"],
      response_action_type: [
        "dispatch_team",
        "escalate_alert",
        "lockdown_protocol",
        "request_reinforcement",
      ],
      response_action_status: ["requested", "acknowledged", "completed", "cancelled"],
    },
  },
} as const
