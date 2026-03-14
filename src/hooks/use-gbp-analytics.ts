import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface GbpAnalytics {
  id: number
  client_id: number
  period_type: 'week' | 'month'
  period_start: string
  period_end: string
  total_searches: number | null
  direct_searches: number | null
  discovery_searches: number | null
  calls: number | null
  website_clicks: number | null
  direction_requests: number | null
  photo_views: number | null
  review_count: number | null
  avg_rating: number | null
  new_reviews: number | null
  citation_count: number | null
  notes: string | null
  created_at: string
}

export type GbpAnalyticsInsert = Omit<GbpAnalytics, 'id' | 'created_at'>

export function useGbpAnalytics(clientId: number | null, periodStart: string, periodEnd: string) {
  return useQuery<GbpAnalytics | null>({
    queryKey: ['gbp-analytics', clientId, periodStart, periodEnd],
    enabled: !!clientId && !!periodStart && !!periodEnd,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gbp_analytics')
        .select('*')
        .eq('client_id', clientId!)
        .gte('period_start', periodStart)
        .lte('period_start', periodEnd)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data as GbpAnalytics | null
    },
  })
}

export function useGbpAnalyticsPrior(clientId: number | null, periodStart: string) {
  return useQuery<GbpAnalytics | null>({
    queryKey: ['gbp-analytics-prior', clientId, periodStart],
    enabled: !!clientId && !!periodStart,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gbp_analytics')
        .select('*')
        .eq('client_id', clientId!)
        .lt('period_start', periodStart)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data as GbpAnalytics | null
    },
  })
}

export function useAddGbpAnalytics() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (row: GbpAnalyticsInsert) => {
      const { data, error } = await supabase
        .from('gbp_analytics')
        .insert(row)
        .select()
        .single()

      if (error) throw error
      return data as GbpAnalytics
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gbp-analytics', variables.client_id] })
      queryClient.invalidateQueries({ queryKey: ['gbp-analytics-prior', variables.client_id] })
    },
  })
}
