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

export function useGbpAnalytics(contractId: number | null, periodStart: string, periodEnd: string) {
  return useQuery<GbpAnalytics | null>({
    queryKey: queryKeys.gbpAnalytics.forPeriod(contractId, periodStart, periodEnd),
    enabled: !!contractId && !!periodStart && !!periodEnd,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gbp_analytics')
        .select('*')
        .eq('contract_id', contractId!)
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

export function useGbpAnalyticsPrior(contractId: number | null, periodStart: string) {
  return useQuery<GbpAnalytics | null>({
    queryKey: queryKeys.gbpAnalytics.prior(contractId, periodStart),
    enabled: !!contractId && !!periodStart,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gbp_analytics')
        .select('*')
        .eq('contract_id', contractId!)
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
      queryClient.invalidateQueries({ queryKey: queryKeys.gbpAnalytics.byContract(variables.contract_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.gbpAnalytics.priorByContract(variables.contract_id) })
    },
  })
}
