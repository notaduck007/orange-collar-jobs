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
      ad_events: {
        Row: {
          ad_slot: string | null
          advertisement_id: string
          id: string
          ip_hash: string | null
          occurred_at: string
          type: string
        }
        Insert: {
          ad_slot?: string | null
          advertisement_id: string
          id?: string
          ip_hash?: string | null
          occurred_at?: string
          type: string
        }
        Update: {
          ad_slot?: string | null
          advertisement_id?: string
          id?: string
          ip_hash?: string | null
          occurred_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_events_advertisement_id_fkey"
            columns: ["advertisement_id"]
            isOneToOne: false
            referencedRelation: "advertisements"
            referencedColumns: ["id"]
          },
        ]
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
          owner_id: string | null
          slot: string
          start_date: string | null
          status: string
          target_url: string
          title: string | null
        }
        Insert: {
          clicks?: number
          company_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          image_url: string
          impressions?: number
          owner_id?: string | null
          slot: string
          start_date?: string | null
          status?: string
          target_url: string
          title?: string | null
        }
        Update: {
          clicks?: number
          company_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          image_url?: string
          impressions?: number
          owner_id?: string | null
          slot?: string
          start_date?: string | null
          status?: string
          target_url?: string
          title?: string | null
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
      application_answers: {
        Row: {
          answer: Json | null
          application_id: string
          created_at: string
          id: string
          question_id: string
        }
        Insert: {
          answer?: Json | null
          application_id: string
          created_at?: string
          id?: string
          question_id: string
        }
        Update: {
          answer?: Json | null
          application_id?: string
          created_at?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "screening_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      application_notes: {
        Row: {
          application_id: string
          author_id: string
          body: string
          created_at: string
          id: string
        }
        Insert: {
          application_id: string
          author_id: string
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          application_id?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          applicant_id: string
          cover_letter: string | null
          created_at: string
          id: string
          job_id: string
          rating: number | null
          rejection_reason: string | null
          resume_url: string | null
          status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          applicant_id: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id: string
          rating?: number | null
          rejection_reason?: string | null
          resume_url?: string | null
          status?: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          applicant_id?: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id?: string
          rating?: number | null
          rejection_reason?: string | null
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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
        }
        Relationships: []
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
          verification_evidence_url: string | null
          verification_note: string | null
          verification_status: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
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
          verification_evidence_url?: string | null
          verification_note?: string | null
          verification_status?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
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
          verification_evidence_url?: string | null
          verification_note?: string | null
          verification_status?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      company_credits: {
        Row: {
          balance: number
          company_id: string
          credit_type: string
          id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          company_id: string
          credit_type: string
          id?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          company_id?: string
          credit_type?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_email: string | null
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_email?: string | null
          role?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_email?: string | null
          role?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      company_packages: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string
          featured_total: number
          featured_used: number
          id: string
          order_id: string | null
          package_id: string | null
          posts_total: number
          posts_used: number
          purchased_at: string
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at: string
          featured_total?: number
          featured_used?: number
          id?: string
          order_id?: string | null
          package_id?: string | null
          posts_total?: number
          posts_used?: number
          purchased_at?: string
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string
          featured_total?: number
          featured_used?: number
          id?: string
          order_id?: string | null
          package_id?: string | null
          posts_total?: number
          posts_used?: number
          purchased_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_packages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_packages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          company_id: string
          created_at: string
          credit_type: string
          delta: number
          id: string
          order_id: string | null
          reason: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          credit_type: string
          delta: number
          id?: string
          order_id?: string | null
          reason?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          credit_type?: string
          delta?: number
          id?: string
          order_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          created_at: string
          id: string
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          requested_by: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_by?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_by?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      faq_items: {
        Row: {
          answer: string
          created_at: string
          id: string
          published: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          published?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          published?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          rollout_pct: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          rollout_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          rollout_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      interview_bookings: {
        Row: {
          applicant_id: string
          application_id: string
          created_at: string
          id: string
          slot_id: string
          status: string
        }
        Insert: {
          applicant_id: string
          application_id: string
          created_at?: string
          id?: string
          slot_id: string
          status?: string
        }
        Update: {
          applicant_id?: string
          application_id?: string
          created_at?: string
          id?: string
          slot_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "interview_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_slots: {
        Row: {
          booked_count: number
          capacity: number
          created_at: string
          id: string
          job_id: string
          starts_at: string
        }
        Insert: {
          booked_count?: number
          capacity?: number
          created_at?: string
          id?: string
          job_id: string
          starts_at: string
        }
        Update: {
          booked_count?: number
          capacity?: number
          created_at?: string
          id?: string
          job_id?: string
          starts_at?: string
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
          active: boolean
          icon: string | null
          id: number
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          icon?: string | null
          id?: number
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          icon?: string | null
          id?: number
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          category: string
          category_id: number | null
          certifications_required: string[]
          city: string | null
          company_id: string
          company_package_id: string | null
          created_at: string
          description: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          expires_at: string | null
          featured: boolean
          featured_until: string | null
          id: string
          lat: number | null
          lift_requirement_lbs: number | null
          lng: number | null
          location: string
          overtime_available: boolean
          pay_max: number | null
          pay_min: number | null
          pay_period: string | null
          posted_at: string
          posted_by: string | null
          quick_hire: boolean
          requirements: string | null
          search_vector: unknown
          shift: Database["public"]["Enums"]["job_shift"]
          slug: string
          spam_score: number
          state: string | null
          status: Database["public"]["Enums"]["job_status"]
          temperature_env: string | null
          title: string
          views: number
          weekly_pay: boolean
          zip: string | null
        }
        Insert: {
          category: string
          category_id?: number | null
          certifications_required?: string[]
          city?: string | null
          company_id: string
          company_package_id?: string | null
          created_at?: string
          description: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          expires_at?: string | null
          featured?: boolean
          featured_until?: string | null
          id?: string
          lat?: number | null
          lift_requirement_lbs?: number | null
          lng?: number | null
          location: string
          overtime_available?: boolean
          pay_max?: number | null
          pay_min?: number | null
          pay_period?: string | null
          posted_at?: string
          posted_by?: string | null
          quick_hire?: boolean
          requirements?: string | null
          search_vector?: unknown
          shift?: Database["public"]["Enums"]["job_shift"]
          slug: string
          spam_score?: number
          state?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          temperature_env?: string | null
          title: string
          views?: number
          weekly_pay?: boolean
          zip?: string | null
        }
        Update: {
          category?: string
          category_id?: number | null
          certifications_required?: string[]
          city?: string | null
          company_id?: string
          company_package_id?: string | null
          created_at?: string
          description?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          expires_at?: string | null
          featured?: boolean
          featured_until?: string | null
          id?: string
          lat?: number | null
          lift_requirement_lbs?: number | null
          lng?: number | null
          location?: string
          overtime_available?: boolean
          pay_max?: number | null
          pay_min?: number | null
          pay_period?: string | null
          posted_at?: string
          posted_by?: string | null
          quick_hire?: boolean
          requirements?: string | null
          search_vector?: unknown
          shift?: Database["public"]["Enums"]["job_shift"]
          slug?: string
          spam_score?: number
          state?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          temperature_env?: string | null
          title?: string
          views?: number
          weekly_pay?: boolean
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
          {
            foreignKeyName: "jobs_company_package_id_fkey"
            columns: ["company_package_id"]
            isOneToOne: false
            referencedRelation: "company_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          sender_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          sender_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          sender_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_cents: number
          company_id: string | null
          created_at: string
          currency: string
          featured_count_granted: number
          fulfilled_at: string | null
          id: string
          invoice_number: string | null
          package_id: string | null
          package_snapshot: Json | null
          posting_count_granted: number
          receipt_url: string | null
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount_cents: number
          company_id?: string | null
          created_at?: string
          currency?: string
          featured_count_granted?: number
          fulfilled_at?: string | null
          id?: string
          invoice_number?: string | null
          package_id?: string | null
          package_snapshot?: Json | null
          posting_count_granted?: number
          receipt_url?: string | null
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount_cents?: number
          company_id?: string | null
          created_at?: string
          currency?: string
          featured_count_granted?: number
          fulfilled_at?: string | null
          id?: string
          invoice_number?: string | null
          package_id?: string | null
          package_snapshot?: Json | null
          posting_count_granted?: number
          receipt_url?: string | null
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
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          key: string
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          key: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          key?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          default_resume_url: string | null
          deleted_at: string | null
          display_name: string | null
          full_name: string | null
          id: string
          location: string | null
          phone: string | null
          pii_anonymized_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          default_resume_url?: string | null
          deleted_at?: string | null
          display_name?: string | null
          full_name?: string | null
          id: string
          location?: string | null
          phone?: string | null
          pii_anonymized_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          default_resume_url?: string | null
          deleted_at?: string | null
          display_name?: string | null
          full_name?: string | null
          id?: string
          location?: string | null
          phone?: string | null
          pii_anonymized_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          updated_at?: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          assigned_to: string | null
          created_at: string
          details: string | null
          entity_id: string
          entity_type: string
          id: string
          reason: string
          reporter_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          details?: string | null
          entity_id: string
          entity_type: string
          id?: string
          reason: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          details?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          reason?: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_id: string
          body: string
          company_id: string
          created_at: string
          flag_count: number
          flag_reason: string | null
          id: string
          rating: number
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          company_id: string
          created_at?: string
          flag_count?: number
          flag_reason?: string | null
          id?: string
          rating: number
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          company_id?: string
          created_at?: string
          flag_count?: number
          flag_reason?: string | null
          id?: string
          rating?: number
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_key: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_key: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
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
      screening_questions: {
        Row: {
          created_at: string
          id: string
          job_id: string
          knockout_answer: Json | null
          options: Json | null
          prompt: string
          required: boolean
          sort_order: number
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          knockout_answer?: Json | null
          options?: Json | null
          prompt: string
          required?: boolean
          sort_order?: number
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          knockout_answer?: Json | null
          options?: Json | null
          prompt?: string
          required?: boolean
          sort_order?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_questions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      seeker_profiles: {
        Row: {
          certifications: string[]
          created_at: string
          desired_employment_type:
            | Database["public"]["Enums"]["employment_type"]
            | null
          desired_pay_min: number | null
          desired_shift: Database["public"]["Enums"]["job_shift"] | null
          discoverable: boolean
          headline: string | null
          skills: string[]
          summary: string | null
          updated_at: string
          user_id: string
          willing_to_relocate: boolean
        }
        Insert: {
          certifications?: string[]
          created_at?: string
          desired_employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          desired_pay_min?: number | null
          desired_shift?: Database["public"]["Enums"]["job_shift"] | null
          discoverable?: boolean
          headline?: string | null
          skills?: string[]
          summary?: string | null
          updated_at?: string
          user_id: string
          willing_to_relocate?: boolean
        }
        Update: {
          certifications?: string[]
          created_at?: string
          desired_employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          desired_pay_min?: number | null
          desired_shift?: Database["public"]["Enums"]["job_shift"] | null
          discoverable?: boolean
          headline?: string | null
          skills?: string[]
          summary?: string | null
          updated_at?: string
          user_id?: string
          willing_to_relocate?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "seeker_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_pages: {
        Row: {
          body: string
          created_at: string
          id: string
          meta_description: string | null
          published: boolean
          slug: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          meta_description?: string | null
          published?: boolean
          slug: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          meta_description?: string | null
          published?: boolean
          slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          body: string
          created_at: string
          email: string
          id: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          body: string
          created_at?: string
          email: string
          id?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          body?: string
          created_at?: string
          email?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_role_assignments: {
        Row: {
          granted_at: string
          granted_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
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
      work_history: {
        Row: {
          created_at: string
          current: boolean
          description: string | null
          employer_name: string
          end_date: string | null
          id: string
          start_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current?: boolean
          description?: string | null
          employer_name: string
          end_date?: string | null
          id?: string
          start_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current?: boolean
          description?: string | null
          employer_name?: string
          end_date?: string | null
          id?: string
          start_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      zip_codes: {
        Row: {
          city: string
          created_at: string
          lat: number
          lng: number
          state: string
          zip: string
        }
        Insert: {
          city: string
          created_at?: string
          lat: number
          lng: number
          state: string
          zip: string
        }
        Update: {
          city?: string
          created_at?: string
          lat?: number
          lng?: number
          state?: string
          zip?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ad_increment_click: { Args: { _ad_id: string }; Returns: undefined }
      ad_increment_impression: { Args: { _ad_id: string }; Returns: undefined }
      anonymize_user: { Args: { _user_id: string }; Returns: undefined }
      check_rate_limit: {
        Args: { _key: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      consume_credit: {
        Args: { _company_id: string; _credit_type: string }
        Returns: boolean
      }
      consume_post_and_publish: {
        Args: { _company_id: string; _job_id: string; _want_featured?: boolean }
        Returns: {
          company_package_id: string
          expires_at: string
          featured: boolean
          job_id: string
        }[]
      }
      feature_existing_job: {
        Args: { _company_id: string; _job_id: string }
        Returns: {
          company_package_id: string
          featured_until: string
          job_id: string
        }[]
      }
      generate_invoice_number: { Args: never; Returns: string }
      get_active_package: {
        Args: { p_company_id: string }
        Returns: {
          expires_at: string
          featured_remaining: number
          featured_total: number
          featured_used: number
          id: string
          package_id: string
          package_name: string
          posts_remaining: number
          posts_total: number
          posts_used: number
        }[]
      }
      get_my_permissions: { Args: never; Returns: string[] }
      get_public_settings: { Args: never; Returns: Json }
      get_user_permissions: { Args: { _user_id: string }; Returns: string[] }
      grant_credits_for_order: {
        Args: { _order_id: string }
        Returns: undefined
      }
      grant_starter_package: { Args: { _company_id: string }; Returns: string }
      has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_admin: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      recommended_jobs: {
        Args: { _limit?: number; _user_id: string }
        Returns: {
          category: string
          company_name: string
          company_slug: string
          created_at: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          featured: boolean
          id: string
          location: string
          pay_max: number
          pay_min: number
          score: number
          shift: Database["public"]["Enums"]["job_shift"]
          slug: string
          title: string
        }[]
      }
      role_member_counts: {
        Args: never
        Returns: {
          member_count: number
          role_id: string
        }[]
      }
      search_jobs:
        | {
            Args: {
              p_category?: string
              p_limit?: number
              p_location?: string
              p_offset?: number
              p_pay_min?: number
              p_query?: string
              p_radius_miles?: number
              p_shift?: string
              p_sort?: string
              p_type?: string
            }
            Returns: {
              category: string
              company_name: string
              company_slug: string
              company_verified: boolean
              created_at: string
              distance_miles: number
              employment_type: Database["public"]["Enums"]["employment_type"]
              featured: boolean
              id: string
              location: string
              pay_max: number
              pay_min: number
              pay_period: string
              rank: number
              shift: Database["public"]["Enums"]["job_shift"]
              slug: string
              title: string
              total_count: number
            }[]
          }
        | {
            Args: {
              p_category?: string
              p_certifications?: string[]
              p_limit?: number
              p_location?: string
              p_max_lift?: number
              p_offset?: number
              p_overtime?: boolean
              p_pay_min?: number
              p_query?: string
              p_quick_hire?: boolean
              p_radius_miles?: number
              p_shift?: string
              p_sort?: string
              p_temperature_env?: string
              p_type?: string
              p_weekly_pay?: boolean
            }
            Returns: {
              category: string
              certifications_required: string[]
              company_name: string
              company_slug: string
              company_verified: boolean
              created_at: string
              distance_miles: number
              employment_type: Database["public"]["Enums"]["employment_type"]
              featured: boolean
              id: string
              lift_requirement_lbs: number
              location: string
              overtime_available: boolean
              pay_max: number
              pay_min: number
              pay_period: string
              quick_hire: boolean
              rank: number
              shift: Database["public"]["Enums"]["job_shift"]
              slug: string
              temperature_env: string
              title: string
              total_count: number
              weekly_pay: boolean
            }[]
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
