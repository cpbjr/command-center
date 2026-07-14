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
    PostgrestVersion: "13.0.4"
  }
  wpa: {
    Tables: {
      gbp_analytics: {
        Row: {
          avg_rating: number | null
          calls: number | null
          citation_count: number | null
          contract_id: number
          created_at: string | null
          direct_searches: number | null
          direction_requests: number | null
          discovery_searches: number | null
          id: string
          new_reviews: number | null
          notes: string | null
          period_end: string
          period_start: string
          period_type: string
          photo_views: number | null
          review_count: number | null
          total_searches: number | null
          website_clicks: number | null
        }
        Insert: {
          avg_rating?: number | null
          calls?: number | null
          citation_count?: number | null
          contract_id: number
          created_at?: string | null
          direct_searches?: number | null
          direction_requests?: number | null
          discovery_searches?: number | null
          id?: string
          new_reviews?: number | null
          notes?: string | null
          period_end: string
          period_start: string
          period_type: string
          photo_views?: number | null
          review_count?: number | null
          total_searches?: number | null
          website_clicks?: number | null
        }
        Update: {
          avg_rating?: number | null
          calls?: number | null
          citation_count?: number | null
          contract_id?: number
          created_at?: string | null
          direct_searches?: number | null
          direction_requests?: number | null
          discovery_searches?: number | null
          id?: string
          new_reviews?: number | null
          notes?: string | null
          period_end?: string
          period_start?: string
          period_type?: string
          photo_views?: number | null
          review_count?: number | null
          total_searches?: number | null
          website_clicks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gbp_analytics_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "wpa_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_activity: {
        Row: {
          actor: string
          business_id: string
          created_at: string
          id: number
          occurred_at: string
          summary: string
          type: string
        }
        Insert: {
          actor?: string
          business_id: string
          created_at?: string
          id?: number
          occurred_at?: string
          summary: string
          type: string
        }
        Update: {
          actor?: string
          business_id?: string
          created_at?: string
          id?: number
          occurred_at?: string
          summary?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpa_activity_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "wpa_businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpa_activity_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "wpa_businesses_with_score"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_audits: {
        Row: {
          audited_at: string
          business_id: string
          category_aligned: boolean | null
          created_at: string
          has_sameas: boolean | null
          has_schema: boolean | null
          hosting_cost_max: number | null
          hosting_cost_min: number | null
          hosting_provider: string | null
          hosting_savings_max: number | null
          hosting_savings_min: number | null
          id: number
          issues: Json | null
          mobile_lcp: number | null
          mobile_speed_score: number | null
          nap_consistent: boolean | null
          pitch_summary: string | null
          raw_schema: Json | null
          score: number | null
          updated_at: string
        }
        Insert: {
          audited_at?: string
          business_id: string
          category_aligned?: boolean | null
          created_at?: string
          has_sameas?: boolean | null
          has_schema?: boolean | null
          hosting_cost_max?: number | null
          hosting_cost_min?: number | null
          hosting_provider?: string | null
          hosting_savings_max?: number | null
          hosting_savings_min?: number | null
          id?: number
          issues?: Json | null
          mobile_lcp?: number | null
          mobile_speed_score?: number | null
          nap_consistent?: boolean | null
          pitch_summary?: string | null
          raw_schema?: Json | null
          score?: number | null
          updated_at?: string
        }
        Update: {
          audited_at?: string
          business_id?: string
          category_aligned?: boolean | null
          created_at?: string
          has_sameas?: boolean | null
          has_schema?: boolean | null
          hosting_cost_max?: number | null
          hosting_cost_min?: number | null
          hosting_provider?: string | null
          hosting_savings_max?: number | null
          hosting_savings_min?: number | null
          id?: number
          issues?: Json | null
          mobile_lcp?: number | null
          mobile_speed_score?: number | null
          nap_consistent?: boolean | null
          pitch_summary?: string | null
          raw_schema?: Json | null
          score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpa_audits_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "wpa_businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpa_audits_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "wpa_businesses_with_score"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_businesses: {
        Row: {
          address: string
          business_status: string | null
          closed_date: string | null
          contract_value: number | null
          created_at: string
          discovered_at: string
          discovery_rank: number | null
          dropped_reason: string | null
          folder_path: string | null
          gbp_categories: Json | null
          gbp_primary_type: string
          google_maps_uri: string | null
          id: string
          lead_source: string | null
          lifecycle_stage: Database["wpa"]["Enums"]["lifecycle_stage"]
          name: string
          notes: string | null
          phone: string | null
          rank_total_candidates: number | null
          rating: number | null
          raw_data: Json | null
          search_query: string
          updated_at: string
          user_rating_count: number | null
          website_url: string | null
        }
        Insert: {
          address?: string
          business_status?: string | null
          closed_date?: string | null
          contract_value?: number | null
          created_at?: string
          discovered_at?: string
          discovery_rank?: number | null
          dropped_reason?: string | null
          folder_path?: string | null
          gbp_categories?: Json | null
          gbp_primary_type?: string
          google_maps_uri?: string | null
          id: string
          lead_source?: string | null
          lifecycle_stage?: Database["wpa"]["Enums"]["lifecycle_stage"]
          name: string
          notes?: string | null
          phone?: string | null
          rank_total_candidates?: number | null
          rating?: number | null
          raw_data?: Json | null
          search_query?: string
          updated_at?: string
          user_rating_count?: number | null
          website_url?: string | null
        }
        Update: {
          address?: string
          business_status?: string | null
          closed_date?: string | null
          contract_value?: number | null
          created_at?: string
          discovered_at?: string
          discovery_rank?: number | null
          dropped_reason?: string | null
          folder_path?: string | null
          gbp_categories?: Json | null
          gbp_primary_type?: string
          google_maps_uri?: string | null
          id?: string
          lead_source?: string | null
          lifecycle_stage?: Database["wpa"]["Enums"]["lifecycle_stage"]
          name?: string
          notes?: string | null
          phone?: string | null
          rank_total_candidates?: number | null
          rating?: number | null
          raw_data?: Json | null
          search_query?: string
          updated_at?: string
          user_rating_count?: number | null
          website_url?: string | null
        }
        Relationships: []
      }
      wpa_client_baselines: {
        Row: {
          contract_id: number
          created_at: string
          discovery_query: string | null
          discovery_rank: number | null
          discovery_total: number | null
          gbp_rating: number | null
          gbp_review_count: number | null
          gtrack_20plus_count: number | null
          gtrack_avg_position: number | null
          gtrack_best_position: number | null
          gtrack_grid_size: number | null
          gtrack_top10_count: number | null
          gtrack_top3_count: number | null
          has_schema: boolean | null
          id: number
          keyword: string | null
          mobile_lcp_seconds: number | null
          mobile_speed_score: number | null
          notes: string | null
          snapshot_date: string
        }
        Insert: {
          contract_id: number
          created_at?: string
          discovery_query?: string | null
          discovery_rank?: number | null
          discovery_total?: number | null
          gbp_rating?: number | null
          gbp_review_count?: number | null
          gtrack_20plus_count?: number | null
          gtrack_avg_position?: number | null
          gtrack_best_position?: number | null
          gtrack_grid_size?: number | null
          gtrack_top10_count?: number | null
          gtrack_top3_count?: number | null
          has_schema?: boolean | null
          id?: number
          keyword?: string | null
          mobile_lcp_seconds?: number | null
          mobile_speed_score?: number | null
          notes?: string | null
          snapshot_date: string
        }
        Update: {
          contract_id?: number
          created_at?: string
          discovery_query?: string | null
          discovery_rank?: number | null
          discovery_total?: number | null
          gbp_rating?: number | null
          gbp_review_count?: number | null
          gtrack_20plus_count?: number | null
          gtrack_avg_position?: number | null
          gtrack_best_position?: number | null
          gtrack_grid_size?: number | null
          gtrack_top10_count?: number | null
          gtrack_top3_count?: number | null
          has_schema?: boolean | null
          id?: number
          keyword?: string | null
          mobile_lcp_seconds?: number | null
          mobile_speed_score?: number | null
          notes?: string | null
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpa_client_baselines_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "wpa_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_contact_notes: {
        Row: {
          body: string
          contact_id: number
          created_at: string
          id: number
          occurred_at: string
          type: string
        }
        Insert: {
          body: string
          contact_id: number
          created_at?: string
          id?: number
          occurred_at?: string
          type?: string
        }
        Update: {
          body?: string
          contact_id?: number
          created_at?: string
          id?: number
          occurred_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpa_contact_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wpa_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_contacts: {
        Row: {
          business_id: string
          created_at: string
          email: string | null
          id: number
          is_primary: boolean
          last_name: string
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          email?: string | null
          id?: number
          is_primary?: boolean
          last_name?: string
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string | null
          id?: number
          is_primary?: boolean
          last_name?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpa_contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "wpa_businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpa_contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "wpa_businesses_with_score"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_contracts: {
        Row: {
          business_id: string
          close_reason: string | null
          closed_at: string | null
          created_at: string
          current_phase: string
          end_date: string | null
          folder_path: string | null
          id: number
          monthly_revenue: number
          next_action: string
          notes: string
          service_tier: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          current_phase?: string
          end_date?: string | null
          folder_path?: string | null
          id?: number
          monthly_revenue?: number
          next_action?: string
          notes?: string
          service_tier: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          current_phase?: string
          end_date?: string | null
          folder_path?: string | null
          id?: number
          monthly_revenue?: number
          next_action?: string
          notes?: string
          service_tier?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpa_contracts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "wpa_businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpa_contracts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "wpa_businesses_with_score"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_daily_costs: {
        Row: {
          anthropic_cost: number | null
          anthropic_tokens: number | null
          created_at: string
          date: string
          id: number
          moonshot_cost: number | null
          moonshot_tokens: number | null
          openai_cost: number | null
          openai_tokens: number | null
          raw_data: Json | null
          total_cost: number | null
        }
        Insert: {
          anthropic_cost?: number | null
          anthropic_tokens?: number | null
          created_at?: string
          date: string
          id?: number
          moonshot_cost?: number | null
          moonshot_tokens?: number | null
          openai_cost?: number | null
          openai_tokens?: number | null
          raw_data?: Json | null
          total_cost?: number | null
        }
        Update: {
          anthropic_cost?: number | null
          anthropic_tokens?: number | null
          created_at?: string
          date?: string
          id?: number
          moonshot_cost?: number | null
          moonshot_tokens?: number | null
          openai_cost?: number | null
          openai_tokens?: number | null
          raw_data?: Json | null
          total_cost?: number | null
        }
        Relationships: []
      }
      wpa_documents: {
        Row: {
          business_id: string | null
          contract_id: number | null
          created_at: string
          file_path: string | null
          id: number
          notes: string | null
          title: string
          type: string | null
          url: string | null
        }
        Insert: {
          business_id?: string | null
          contract_id?: number | null
          created_at?: string
          file_path?: string | null
          id?: number
          notes?: string | null
          title: string
          type?: string | null
          url?: string | null
        }
        Update: {
          business_id?: string | null
          contract_id?: number | null
          created_at?: string
          file_path?: string | null
          id?: number
          notes?: string | null
          title?: string
          type?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wpa_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "wpa_businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpa_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "wpa_businesses_with_score"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpa_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "wpa_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_gbp_insights: {
        Row: {
          contract_id: number
          created_at: string
          direction_requests: number | null
          id: number
          maps_views: number | null
          menu_views: number | null
          message_count: number | null
          notes: string | null
          phone_calls: number | null
          photo_views: number | null
          profile_views: number | null
          search_views: number | null
          website_clicks: number | null
          week_ending: string
        }
        Insert: {
          contract_id: number
          created_at?: string
          direction_requests?: number | null
          id?: number
          maps_views?: number | null
          menu_views?: number | null
          message_count?: number | null
          notes?: string | null
          phone_calls?: number | null
          photo_views?: number | null
          profile_views?: number | null
          search_views?: number | null
          website_clicks?: number | null
          week_ending: string
        }
        Update: {
          contract_id?: number
          created_at?: string
          direction_requests?: number | null
          id?: number
          maps_views?: number | null
          menu_views?: number | null
          message_count?: number | null
          notes?: string | null
          phone_calls?: number | null
          photo_views?: number | null
          profile_views?: number | null
          search_views?: number | null
          website_clicks?: number | null
          week_ending?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpa_gbp_insights_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "wpa_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_gbp_scores: {
        Row: {
          contract_id: number
          created_at: string | null
          id: number
          notes: string | null
          recorded_at: string | null
          score: number | null
        }
        Insert: {
          contract_id: number
          created_at?: string | null
          id?: number
          notes?: string | null
          recorded_at?: string | null
          score?: number | null
        }
        Update: {
          contract_id?: number
          created_at?: string | null
          id?: number
          notes?: string | null
          recorded_at?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wpa_gbp_scores_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "wpa_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_project_updates: {
        Row: {
          author: string
          created_at: string
          details: Json | null
          id: number
          project_id: number
          summary: string
          type: string
        }
        Insert: {
          author?: string
          created_at?: string
          details?: Json | null
          id?: number
          project_id: number
          summary: string
          type: string
        }
        Update: {
          author?: string
          created_at?: string
          details?: Json | null
          id?: number
          project_id?: number
          summary?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpa_project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "wpa_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_projects: {
        Row: {
          agent_notes: string | null
          agent_status: string
          budget_cents: number | null
          budget_spent_cents: number | null
          category: string
          contract_id: number | null
          created_at: string
          description: string | null
          due_date: string | null
          id: number
          last_agent_activity: string | null
          metadata: Json | null
          name: string
          next_milestone: string | null
          owner: string
          priority: string
          progress_pct: number | null
          start_date: string | null
          status: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          agent_notes?: string | null
          agent_status?: string
          budget_cents?: number | null
          budget_spent_cents?: number | null
          category?: string
          contract_id?: number | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: number
          last_agent_activity?: string | null
          metadata?: Json | null
          name: string
          next_milestone?: string | null
          owner?: string
          priority?: string
          progress_pct?: number | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          agent_notes?: string | null
          agent_status?: string
          budget_cents?: number | null
          budget_spent_cents?: number | null
          category?: string
          contract_id?: number | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: number
          last_agent_activity?: string | null
          metadata?: Json | null
          name?: string
          next_milestone?: string | null
          owner?: string
          priority?: string
          progress_pct?: number | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpa_projects_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "wpa_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_service_ranks: {
        Row: {
          business_id: string
          discovered_at: string
          discovery_rank: number | null
          id: number
          service_label: string
          service_query: string
          total_results: number | null
        }
        Insert: {
          business_id: string
          discovered_at?: string
          discovery_rank?: number | null
          id?: number
          service_label: string
          service_query: string
          total_results?: number | null
        }
        Update: {
          business_id?: string
          discovered_at?: string
          discovery_rank?: number | null
          id?: number
          service_label?: string
          service_query?: string
          total_results?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wpa_service_ranks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "wpa_businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpa_service_ranks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "wpa_businesses_with_score"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_task_events: {
        Row: {
          actor: string
          body: string
          created_at: string
          id: number
          kind: string
          meta: Json
          task_id: number
        }
        Insert: {
          actor?: string
          body?: string
          created_at?: string
          id?: number
          kind?: string
          meta?: Json
          task_id: number
        }
        Update: {
          actor?: string
          body?: string
          created_at?: string
          id?: number
          kind?: string
          meta?: Json
          task_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "wpa_task_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "wpa_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_tasks: {
        Row: {
          assigned_to: string
          business_id: string | null
          category: string
          completed_at: string | null
          contract_id: number | null
          created_at: string
          description: string | null
          due_date: string | null
          id: number
          is_template: boolean | null
          last_generated_at: string | null
          notes: string | null
          priority: string
          project_id: number | null
          recurrence_rule: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string
          business_id?: string | null
          category?: string
          completed_at?: string | null
          contract_id?: number | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: number
          is_template?: boolean | null
          last_generated_at?: string | null
          notes?: string | null
          priority?: string
          project_id?: number | null
          recurrence_rule?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          business_id?: string | null
          category?: string
          completed_at?: string | null
          contract_id?: number | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: number
          is_template?: boolean | null
          last_generated_at?: string | null
          notes?: string | null
          priority?: string
          project_id?: number | null
          recurrence_rule?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpa_tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "wpa_businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpa_tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "wpa_businesses_with_score"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpa_tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "wpa_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wpa_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "wpa_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_weekly_reports: {
        Row: {
          body: string
          client_email: string | null
          contract_id: number
          created_at: string
          drafted_at: string
          id: number
          notes: string | null
          sent_at: string | null
          status: string
          subject: string
          week_ending: string
        }
        Insert: {
          body: string
          client_email?: string | null
          contract_id: number
          created_at?: string
          drafted_at?: string
          id?: number
          notes?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          week_ending: string
        }
        Update: {
          body?: string
          client_email?: string | null
          contract_id?: number
          created_at?: string
          drafted_at?: string
          id?: number
          notes?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          week_ending?: string
        }
        Relationships: [
          {
            foreignKeyName: "wpa_weekly_reports_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "wpa_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_winnow_decisions: {
        Row: {
          business_id: string
          decided_at: string
          decision: string
          haiku_decision: string | null
          haiku_evaluated_at: string | null
          haiku_pitch_angle: string | null
          haiku_verdict: string | null
          id: number
          is_chain: boolean | null
          outcome_actual: string | null
          outcome_updated_at: string | null
          override_by_human: boolean | null
          override_reason: string | null
          reasoning_summary: string | null
          review_trend: string | null
          review_velocity_90d: number | null
          run_id: string
          score_breakdown: Json | null
          site_quality_score: number | null
          sos_entity_type: string | null
          sos_registered_at: string | null
          sos_status: string | null
          website_final_url: string | null
          website_reachable: boolean | null
          winnow_score: number
        }
        Insert: {
          business_id: string
          decided_at?: string
          decision: string
          haiku_decision?: string | null
          haiku_evaluated_at?: string | null
          haiku_pitch_angle?: string | null
          haiku_verdict?: string | null
          id?: number
          is_chain?: boolean | null
          outcome_actual?: string | null
          outcome_updated_at?: string | null
          override_by_human?: boolean | null
          override_reason?: string | null
          reasoning_summary?: string | null
          review_trend?: string | null
          review_velocity_90d?: number | null
          run_id: string
          score_breakdown?: Json | null
          site_quality_score?: number | null
          sos_entity_type?: string | null
          sos_registered_at?: string | null
          sos_status?: string | null
          website_final_url?: string | null
          website_reachable?: boolean | null
          winnow_score: number
        }
        Update: {
          business_id?: string
          decided_at?: string
          decision?: string
          haiku_decision?: string | null
          haiku_evaluated_at?: string | null
          haiku_pitch_angle?: string | null
          haiku_verdict?: string | null
          id?: number
          is_chain?: boolean | null
          outcome_actual?: string | null
          outcome_updated_at?: string | null
          override_by_human?: boolean | null
          override_reason?: string | null
          reasoning_summary?: string | null
          review_trend?: string | null
          review_velocity_90d?: number | null
          run_id?: string
          score_breakdown?: Json | null
          site_quality_score?: number | null
          sos_entity_type?: string | null
          sos_registered_at?: string | null
          sos_status?: string | null
          website_final_url?: string | null
          website_reachable?: boolean | null
          winnow_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "winnow_decisions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "wpa_businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "winnow_decisions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "wpa_businesses_with_score"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "winnow_decisions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "wpa_winnow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      wpa_winnow_runs: {
        Row: {
          batch_size_requested: number | null
          businesses_evaluated: number | null
          closed_count: number | null
          config_snapshot: Json | null
          errors_count: number | null
          filter_query: string | null
          finished_at: string | null
          id: string
          identified_count: number | null
          middle_band_count: number | null
          notes: string | null
          run_by: string
          skipped_count: number | null
          started_at: string
        }
        Insert: {
          batch_size_requested?: number | null
          businesses_evaluated?: number | null
          closed_count?: number | null
          config_snapshot?: Json | null
          errors_count?: number | null
          filter_query?: string | null
          finished_at?: string | null
          id?: string
          identified_count?: number | null
          middle_band_count?: number | null
          notes?: string | null
          run_by?: string
          skipped_count?: number | null
          started_at?: string
        }
        Update: {
          batch_size_requested?: number | null
          businesses_evaluated?: number | null
          closed_count?: number | null
          config_snapshot?: Json | null
          errors_count?: number | null
          filter_query?: string | null
          finished_at?: string | null
          id?: string
          identified_count?: number | null
          middle_band_count?: number | null
          notes?: string | null
          run_by?: string
          skipped_count?: number | null
          started_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      wpa_businesses_with_score: {
        Row: {
          address: string | null
          business_status: string | null
          closed_date: string | null
          contract_value: number | null
          created_at: string | null
          discovered_at: string | null
          discovery_rank: number | null
          dropped_reason: string | null
          folder_path: string | null
          gbp_categories: Json | null
          gbp_primary_type: string | null
          google_maps_uri: string | null
          id: string | null
          latest_score: number | null
          lead_source: string | null
          lifecycle_stage: Database["wpa"]["Enums"]["lifecycle_stage"] | null
          name: string | null
          notes: string | null
          phone: string | null
          rank_total_candidates: number | null
          rating: number | null
          raw_data: Json | null
          search_query: string | null
          updated_at: string | null
          user_rating_count: number | null
          website_url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      append_activity: {
        Args: {
          p_actor?: string
          p_business_id: string
          p_occurred_at?: string
          p_summary: string
          p_type: string
        }
        Returns: {
          actor: string
          business_id: string
          created_at: string
          id: number
          occurred_at: string
          summary: string
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "wpa_activity"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      convert_to_client: {
        Args: {
          p_actor?: string
          p_business_id: string
          p_monthly_revenue?: number
          p_service_tier: string
        }
        Returns: {
          business_id: string
          close_reason: string | null
          closed_at: string | null
          created_at: string
          current_phase: string
          end_date: string | null
          folder_path: string | null
          id: number
          monthly_revenue: number
          next_action: string
          notes: string
          service_tier: string
          start_date: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "wpa_contracts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      end_engagement: {
        Args: {
          p_actor?: string
          p_business_id: string
          p_close_reason: string
        }
        Returns: {
          business_id: string
          close_reason: string | null
          closed_at: string | null
          created_at: string
          current_phase: string
          end_date: string | null
          folder_path: string | null
          id: number
          monthly_revenue: number
          next_action: string
          notes: string
          service_tier: string
          start_date: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "wpa_contracts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      move_to_stage: {
        Args: { p_actor?: string; p_business_id: string; p_stage: string }
        Returns: {
          address: string
          business_status: string | null
          closed_date: string | null
          contract_value: number | null
          created_at: string
          discovered_at: string
          discovery_rank: number | null
          dropped_reason: string | null
          folder_path: string | null
          gbp_categories: Json | null
          gbp_primary_type: string
          google_maps_uri: string | null
          id: string
          lead_source: string | null
          lifecycle_stage: Database["wpa"]["Enums"]["lifecycle_stage"]
          name: string
          notes: string | null
          phone: string | null
          rank_total_candidates: number | null
          rating: number | null
          raw_data: Json | null
          search_query: string
          updated_at: string
          user_rating_count: number | null
          website_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "wpa_businesses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      lifecycle_stage:
        | "identified"
        | "new_prospect"
        | "lead"
        | "client"
        | "dropped"
        | "relationship_ended"
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
  wpa: {
    Enums: {
      lifecycle_stage: [
        "identified",
        "new_prospect",
        "lead",
        "client",
        "dropped",
        "relationship_ended",
      ],
    },
  },
} as const
