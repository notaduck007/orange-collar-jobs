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
      ads: {
        Row: {
          active: boolean
          created_at: string
          ends_at: string | null
          id: string
          image_url: string | null
          owner_id: string | null
          placement: Database["public"]["Enums"]["ad_placement"]
          starts_at: string
          target_url: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          owner_id?: string | null
          placement: Database["public"]["Enums"]["ad_placement"]
          starts_at?: string
          target_url: string
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          owner_id?: string | null
          placement?: Database["public"]["Enums"]["ad_placement"]
          starts_at?: string
          target_url?: string
          title?: string
        }
        Relationships: []
      }
      advertisements: {
        Row: {
          clicks: number
          company_id: string | null
          created_at: string
          end_date: string | null
          id: string
          image_url: string
          impressions: number
          slot: string
          start_date: string | null
          status: string
          target_url: string
        }
        Insert: {
          clicks?: number
          company_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          image_url: string
          impressions?: number
          slot: string
          start_date?: string | null
          status?: string
          target_url: string
        }
        Update: {
          clicks?: number
          company_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          image_url?: string
          impressions?: number
          slot?: string
          start_date?: string | null
          status?: string
          target_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "advertisements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applicant_id: string
          cover_letter: string | null
          created_at: string
          id: string
          job_id: string
          resume_url: string | null
          status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          applicant_id: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id: string
          resume_url?: string | null
          status?: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          applicant_id?: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id?: string
          resume_url?: string | null
          status?: Database["public"]["Enums"]["application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          description: string | null
          featured_credits: number
          hq_city: string | null
          hq_state: string | null
          id: string
          industry: string | null
          location: string | null
          logo_url: string | null
          name: string
          owner_id: string | null
          posting_credits: number
          slug: string
          status: string
          verified: boolean
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          featured_credits?: number
          hq_city?: string | null
          hq_state?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          posting_credits?: number
          slug: string
          status?: string
          verified?: boolean
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          featured_credits?: number
          hq_city?: string | null
          hq_state?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          posting_credits?: number
          slug?: string
          status?: string
          verified?: boolean
          website?: string | null
        }
        Relationships: []
      }
      job_alerts: {
        Row: {
          applicant_id: string
          category_id: number | null
          city: string | null
          created_at: string
          frequency: string
          id: string
          keyword: string | null
          state: string | null
        }
        Insert: {
          applicant_id: string
          category_id?: number | null
          city?: string | null
          created_at?: string
          frequency?: string
          id?: string
          keyword?: string | null
          state?: string | null
        }
        Update: {
          applicant_id?: string
          category_id?: number | null
          city?: string | null
          created_at?: string
          frequency?: string
          id?: string
          keyword?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_alerts_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_alerts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "job_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      job_categories: {
        Row: {
          icon: string | null
          id: number
          name: string
          slug: string
        }
        Insert: {
          icon?: string | null
          id?: number
          name: string
          slug: string
        }
        Update: {
          icon?: string | null
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          category: string
          category_id: number | null
          city: string | null
          company_id: string
          created_at: string
          description: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          expires_at: string | null
          featured: boolean
          id: string
          lat: number | null
          lng: number | null
          location: string
          pay_max: number | null
          pay_min: number | null
          pay_period: string | null
          posted_at: string
          posted_by: string | null
          requirements: string | null
          shift: Database["public"]["Enums"]["job_shift"]
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          views: number
          zip: string | null
        }
        Insert: {
          category: string
          category_id?: number | null
          city?: string | null
          company_id: string
          created_at?: string
          description: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          expires_at?: string | null
          featured?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          location: string
          pay_max?: number | null
          pay_min?: number | null
          pay_period?: string | null
          posted_at?: string
          posted_by?: string | null
          requirements?: string | null
          shift?: Database["public"]["Enums"]["job_shift"]
          slug: string
          state?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          views?: number
          zip?: string | null
        }
        Update: {
          category?: string
          category_id?: number | null
          city?: string | null
          company_id?: string
          created_at?: string
          description?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          expires_at?: string | null
          featured?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          location?: string
          pay_max?: number | null
          pay_min?: number | null
          pay_period?: string | null
          posted_at?: string
          posted_by?: string | null
          requirements?: string | null
          shift?: Database["public"]["Enums"]["job_shift"]
          slug?: string
          state?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          views?: number
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "job_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_cents: number
          company_id: string | null
          created_at: string
          featured_count_granted: number
          id: string
          package_id: string | null
          posting_count_granted: number
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount_cents: number
          company_id?: string | null
          created_at?: string
          featured_count_granted?: number
          id?: string
          package_id?: string | null
          posting_count_granted?: number
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount_cents?: number
          company_id?: string | null
          created_at?: string
          featured_count_granted?: number
          id?: string
          package_id?: string | null
          posting_count_granted?: number
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          active: boolean
          ad_slot: string | null
          created_at: string
          description: string | null
          duration_days: number
          featured_count: number
          id: string
          kind: string
          name: string
          posting_count: number
          price_cents: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          ad_slot?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number
          featured_count?: number
          id?: string
          kind: string
          name: string
          posting_count?: number
          price_cents: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          ad_slot?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number
          featured_count?: number
          id?: string
          kind?: string
          name?: string
          posting_count?: number
          price_cents?: number
          sort_order?: number
        }
        Relationships: []
      }
      posting_packages: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          duration_days: number
          featured_credits: number
          id: string
          name: string
          post_credits: number
          price_cents: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_days?: number
          featured_credits?: number
          id?: string
          name: string
          post_credits?: number
          price_cents: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_days?: number
          featured_credits?: number
          id?: string
          name?: string
          post_credits?: number
          price_cents?: number
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_resume_url: string | null
          display_name: string | null
          full_name: string | null
          id: string
          location: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_resume_url?: string | null
          display_name?: string | null
          full_name?: string | null
          id: string
          location?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_resume_url?: string | null
          display_name?: string | null
          full_name?: string | null
          id?: string
          location?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_jobs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      ad_placement: "home_banner" | "search_inline" | "job_sidebar"
      app_role: "admin" | "employer" | "job_seeker"
      application_status:
        | "submitted"
        | "reviewed"
        | "interview"
        | "hired"
        | "rejected"
        | "shortlisted"
      employment_type:
        | "full_time"
        | "part_time"
        | "temp"
        | "temp_to_hire"
        | "seasonal"
        | "contract"
      job_shift: "first" | "second" | "third" | "weekend" | "flexible"
      job_status:
        | "draft"
        | "published"
        | "closed"
        | "expired"
        | "active"
        | "paused"
        | "pending_review"
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
      ad_placement: ["home_banner", "search_inline", "job_sidebar"],
      app_role: ["admin", "employer", "job_seeker"],
      application_status: [
        "submitted",
        "reviewed",
        "interview",
        "hired",
        "rejected",
        "shortlisted",
      ],
      employment_type: [
        "full_time",
        "part_time",
        "temp",
        "temp_to_hire",
        "seasonal",
        "contract",
      ],
      job_shift: ["first", "second", "third", "weekend", "flexible"],
      job_status: [
        "draft",
        "published",
        "closed",
        "expired",
        "active",
        "paused",
        "pending_review",
      ],
    },
  },
} as const
