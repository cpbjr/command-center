import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Business {
  id: string
  name: string
  address: string
  phone: string
  website_url: string
  gbp_categories: string[]
  search_query: string
  discovered_at: string
  contact_status: 'IDENTIFIED' | 'NEW' | 'TARGETED' | 'CONTACTED' | 'REPLIED' | 'CLOSED' | 'CLOSED-WON'
  discovery_rank: number | null
  rank_total_candidates: number | null
  google_maps_uri: string
  business_status: string
  rating: number | null
  user_rating_count: number | null
  latest_score: number | null
  notes: string
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
    queryKey: ['businesses', options],
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
    queryKey: ['business-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_businesses_with_score')
        .select('search_query')
        .not('search_query', 'is', null)

      if (error) throw error

      const unique = Array.from(
        new Set((data ?? []).map((row: { search_query: string }) => row.search_query).filter(Boolean))
      ).sort()

      return unique as string[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useBusinessAudit(businessId: string | null) {
  return useQuery<BusinessAudit | null>({
    queryKey: ['business-audit', businessId],
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
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
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
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      queryClient.invalidateQueries({ queryKey: ['discovery'] })
      queryClient.invalidateQueries({ queryKey: ['discovery-recent'] })
      queryClient.invalidateQueries({ queryKey: ['discovery-search'] })
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
      queryClient.invalidateQueries({ queryKey: ['business-audit', businessId] })
    },
  })
}

export function useBusinessesSimple() {
  return useQuery<{ id: string; name: string }[]>({
    queryKey: ['businesses-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_businesses')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) throw error
      return (data ?? []) as { id: string; name: string }[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useConvertToClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      business,
      service_tier,
      monthly_revenue,
    }: {
      business: Business
      service_tier: string
      monthly_revenue?: number
    }) => {
      // First update business status to CLOSED-WON
      const { error: bizError } = await supabase
        .from('wpa_businesses')
        .update({ contact_status: 'CLOSED-WON' })
        .eq('id', business.id)
      if (bizError) throw bizError

      // Then create the client, linking back to the business record
      const { data, error } = await supabase
        .from('wpa_clients')
        .insert({
          name: business.name,
          address: business.address ?? '',
          phone: business.phone ?? '',
          website_url: business.website_url ?? '',
          business_id: business.id,
          service_tier,
          status: 'active',
          start_date: new Date().toISOString().split('T')[0],
          monthly_revenue: monthly_revenue ?? 0,
          notes: '',
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
