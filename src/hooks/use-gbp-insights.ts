import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/query-keys'

export interface GbpInsight {
  id: number
  contract_id: number
  week_ending: string
  search_views: number | null
  maps_views: number | null
  profile_views: number | null
  website_clicks: number | null
  phone_calls: number | null
  direction_requests: number | null
  photo_views: number | null
  message_count: number | null
  notes: string | null
  created_at: string
}

export type GbpInsightInsert = Omit<GbpInsight, 'id' | 'created_at'>

export function useGbpInsights(contractId: number | null) {
  return useQuery<GbpInsight[]>({
    queryKey: queryKeys.gbpInsights.byContract(contractId),
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('wpa')
        .from('wpa_gbp_insights')
        .select('*')
        .eq('contract_id', contractId!)
        .order('week_ending', { ascending: false })

      if (error) throw error
      return (data as GbpInsight[]) ?? []
    },
  })
}

export function useUpsertGbpInsight() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (insight: GbpInsightInsert) => {
      const { data, error } = await supabase
        .schema('wpa')
        .from('wpa_gbp_insights')
        .upsert(insight, { onConflict: 'contract_id,week_ending' })
        .select()
        .single()

      if (error) throw error
      return data as GbpInsight
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gbpInsights.byContract(data.contract_id) })
    },
  })
}
