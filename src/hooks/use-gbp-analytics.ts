import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { queryKeys } from '@/lib/query-keys'

// Generated gbp_analytics row with period_type narrowed to its domain union.
export type GbpAnalytics = Omit<
  Database['wpa']['Tables']['gbp_analytics']['Row'],
  'period_type'
> & {
  period_type: 'week' | 'month'
}

export type GbpAnalyticsInsert = Omit<GbpAnalytics, 'id' | 'created_at'>

export function useGbpAnalytics(clientId: number | null, periodStart: string, periodEnd: string) {
  return useQuery<GbpAnalytics | null>({
    queryKey: queryKeys.gbpAnalytics.forPeriod(clientId, periodStart, periodEnd),
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
    queryKey: queryKeys.gbpAnalytics.prior(clientId, periodStart),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.gbpAnalytics.byClient(variables.client_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.gbpAnalytics.priorByClient(variables.client_id) })
    },
  })
}
