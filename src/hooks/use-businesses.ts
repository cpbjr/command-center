import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys, businessCacheRoots } from '@/lib/query-keys'
import type { LifecycleStage } from '@/lib/lifecycle'

// Business rows are read under all of these keys (Leads page + Discovery page),
// so every business mutation must invalidate the full set.
function invalidateBusinessCaches(queryClient: QueryClient) {
  for (const key of businessCacheRoots) {
    queryClient.invalidateQueries({ queryKey: key })
  }
}

export interface Business {
  id: string
  name: string
  address: string
  phone: string
  website_url: string
  gbp_categories: string[]
  search_query: string
  discovered_at: string
  contact_status: 'IDENTIFIED' | 'NEW' | 'TARGETED' | 'CONTACTED' | 'REPLIED' | 'CLOSED' | 'CLOSED-WON'  // legacy, removed in Task 5.10
  lifecycle_stage: LifecycleStage
  dropped_reason: 'declined' | 'not_a_fit' | 'no_response' | null
  discovery_rank: number | null
  rank_total_candidates: number | null
  google_maps_uri: string
  business_status: string
  rating: number | null
  user_rating_count: number | null
  latest_score: number | null
  notes: string
  folder_path: string | null
}

export interface BusinessAudit {
  id: string
  business_id: string
  audited_at: string
  score: number | null
  has_schema: boolean | null
  has_sameas: boolean | null
  category_aligned: boolean | null
  nap_consistent: boolean | null
  mobile_speed_score: number | null
}

export interface UseBusinessesOptions {
  page: number
  pageSize: number
  statusFilter: string[]
  scoreRange: [number, number]
  search: string
  category: string
  noWebsite: boolean
}

export interface BusinessesResult {
  data: Business[]
  count: number
}

export function useBusinesses(options: UseBusinessesOptions) {
  const { page, pageSize, statusFilter, scoreRange, search, category, noWebsite } = options
  const from = page * pageSize
  const to = from + pageSize - 1

  return useQuery<BusinessesResult>({
    queryKey: queryKeys.businesses.list(options),
    queryFn: async () => {
      let query = supabase
        .from('wpa_businesses_with_score')
        .select('*', { count: 'exact' })
        .order('latest_score', { ascending: false, nullsFirst: false })
        .range(from, to)

      if (statusFilter.length > 0) {
        query = query.in('contact_status', statusFilter)
      }

      if (search.trim()) {
        query = query.or(
          `name.ilike.%${search.trim()}%,address.ilike.%${search.trim()}%`
        )
      }

      if (category) {
        query = query.eq('search_query', category)
      }

      if (noWebsite) {
        query = query.or('website_url.is.null,website_url.eq.')
      }

      const [minScore, maxScore] = scoreRange
      if (minScore > 0) {
        query = query.gte('latest_score', minScore)
      }
      if (maxScore < 5) {
        query = query.lte('latest_score', maxScore)
      }

      const { data, error, count } = await query

      if (error) throw error

      return {
        data: (data as Business[]) ?? [],
        count: count ?? 0,
      }
    },
    placeholderData: (prev) => prev,
  })
}

export function useBusinessCategories() {
  return useQuery<string[]>({
    queryKey: queryKeys.businesses.categories(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_businesses_with_score')
        .select('search_query')
        .not('search_query', 'is', null)

      if (error) throw error

      const unique = Array.from(
        new Set(
          (data ?? [])
            .map((row) => row.search_query)
            .filter((q): q is string => Boolean(q))
        )
      ).sort()

      return unique
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useBusinessAudit(businessId: string | null) {
  return useQuery<BusinessAudit | null>({
    queryKey: queryKeys.businesses.audit(businessId),
    queryFn: async () => {
      if (!businessId) return null

      const { data, error } = await supabase
        .from('wpa_audits')
        .select('*')
        .eq('business_id', businessId)
        .order('audited_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data as BusinessAudit | null
    },
    enabled: !!businessId,
  })
}

export function useUpdateBusinessStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      contact_status,
    }: {
      id: string
      contact_status: Business['contact_status']
    }) => {
      const { error } = await supabase
        .from('wpa_businesses')
        .update({ contact_status })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      invalidateBusinessCaches(queryClient)
    },
  })
}

export function useMoveToStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: LifecycleStage }) => {
      const { error } = await supabase.rpc('move_to_stage', {
        p_business_id: id, p_stage: stage, p_actor: 'human',
      })
      if (error) throw error
    },
    onSuccess: () => invalidateBusinessCaches(queryClient),
  })
}

export function useMarkDropped() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string | null }) => {
      const { error: e1 } = await supabase.from('wpa_businesses')
        .update({ dropped_reason: reason }).eq('id', id)
      if (e1) throw e1
      const { error: e2 } = await supabase.rpc('move_to_stage', {
        p_business_id: id, p_stage: 'dropped', p_actor: 'human',
      })
      if (e2) throw e2
    },
    onSuccess: () => invalidateBusinessCaches(queryClient),
  })
}

export function useEndEngagement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ business_id, close_reason }: { business_id: string; close_reason: string }) => {
      const { error } = await supabase.rpc('end_engagement', {
        p_business_id: business_id, p_close_reason: close_reason, p_actor: 'human',
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidateBusinessCaches(queryClient)
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all })
    },
  })
}

export function useUpdateBusinessNotes() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('wpa_businesses')
        .update({ notes })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      invalidateBusinessCaches(queryClient)
    },
  })
}

export function useUpdateBusinessFolderPath() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, folder_path }: { id: string; folder_path: string | null }) => {
      const { error } = await supabase
        .from('wpa_businesses')
        .update({ folder_path })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      invalidateBusinessCaches(queryClient)
    },
  })
}

export function useRequestAudit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (businessId: string) => {
      const timestamp = new Date().toISOString()
      const { error } = await supabase
        .from('wpa_audits')
        .insert({
          business_id: businessId,
          score: null,
          issues: [],
          pitch_summary: `MANUAL_AUDIT_REQUESTED - ${timestamp}`,
          audited_at: timestamp,
        })

      if (error) throw error
    },
    onSuccess: (_data, businessId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businesses.audit(businessId) })
    },
  })
}

export function useBusinessesSimple(search = '') {
  const trimmed = search.trim()
  return useQuery<{ id: string; name: string }[]>({
    queryKey: queryKeys.businesses.simple(trimmed),
    queryFn: async () => {
      let query = supabase
        .from('wpa_businesses')
        .select('id, name')
        .order('name', { ascending: true })
        .limit(20)

      if (trimmed) {
        query = query.ilike('name', `%${trimmed}%`)
      }

      const { data, error } = await query
      if (error) throw error
      return (data as { id: string; name: string }[]) ?? []
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useConvertToClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      business_id,
      service_tier,
      monthly_revenue,
    }: {
      business_id: string
      service_tier: string
      monthly_revenue?: number
    }) => {
      const { data, error } = await supabase.rpc('convert_to_client', {
        p_business_id: business_id,
        p_service_tier: service_tier,
        p_monthly_revenue: monthly_revenue ?? 0,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateBusinessCaches(queryClient)
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all })
    },
  })
}

export function useDeleteBusiness() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('wpa_businesses')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateBusinessCaches(queryClient)
      queryClient.invalidateQueries({ queryKey: queryKeys.businesses.simpleRoot })
    },
  })
}
