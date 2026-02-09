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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_details: {
        Row: {
          account_name: string
          account_number: string
          bank: string
          contact_id: string
          created_at: string
          id: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank: string
          contact_id: string
          created_at?: string
          id?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank?: string
          contact_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_details_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          amount: number | null
          app_type: string | null
          avatar_url: string | null
          created_at: string
          day_type: number | null
          id: string
          is_archived: boolean | null
          is_muted: boolean | null
          is_online: boolean | null
          is_pinned: boolean | null
          last_seen: string | null
          loan_id: string
          name: string
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          app_type?: string | null
          avatar_url?: string | null
          created_at?: string
          day_type?: number | null
          id?: string
          is_archived?: boolean | null
          is_muted?: boolean | null
          is_online?: boolean | null
          is_pinned?: boolean | null
          last_seen?: string | null
          loan_id: string
          name: string
          phone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          app_type?: string | null
          avatar_url?: string | null
          created_at?: string
          day_type?: number | null
          id?: string
          is_archived?: boolean | null
          is_muted?: boolean | null
          is_online?: boolean | null
          is_pinned?: boolean | null
          last_seen?: string | null
          loan_id?: string
          name?: string
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          contact_id: string
          content: string
          created_at: string
          id: string
          is_outgoing: boolean
          media_url: string | null
          status: string
          template_name: string | null
          template_params: Json | null
          type: string
          user_id: string
          whatsapp_message_id: string | null
        }
        Insert: {
          contact_id: string
          content: string
          created_at?: string
          id?: string
          is_outgoing?: boolean
          media_url?: string | null
          status?: string
          template_name?: string | null
          template_params?: Json | null
          type?: string
          user_id: string
          whatsapp_message_id?: string | null
        }
        Update: {
          contact_id?: string
          content?: string
          created_at?: string
          id?: string
          is_outgoing?: boolean
          media_url?: string | null
          status?: string
          template_name?: string | null
          template_params?: Json | null
          type?: string
          user_id?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_settings: {
        Row: {
          api_token: string | null
          app_id: string | null
          business_account_id: string | null
          created_at: string
          id: string
          is_connected: boolean | null
          phone_number_id: string | null
          updated_at: string
          user_id: string
          verify_token: string | null
          webhook_url: string | null
        }
        Insert: {
          api_token?: string | null
          app_id?: string | null
          business_account_id?: string | null
          created_at?: string
          id?: string
          is_connected?: boolean | null
          phone_number_id?: string | null
          updated_at?: string
          user_id: string
          verify_token?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_token?: string | null
          app_id?: string | null
          business_account_id?: string | null
          created_at?: string
          id?: string
          is_connected?: boolean | null
          phone_number_id?: string | null
          updated_at?: string
          user_id?: string
          verify_token?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          category: string | null
          components: Json | null
          created_at: string
          id: string
          language: string | null
          name: string
          status: string | null
          template_id: string
          user_id: string
        }
        Insert: {
          category?: string | null
          components?: Json | null
          created_at?: string
          id?: string
          language?: string | null
          name: string
          status?: string | null
          template_id: string
          user_id: string
        }
        Update: {
          category?: string | null
          components?: Json | null
          created_at?: string
          id?: string
          language?: string | null
          name?: string
          status?: string | null
          template_id?: string
          user_id?: string
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
