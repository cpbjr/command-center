import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/query-keys'

export interface ClientBaseline {
  id: number
  contract_id: number
  snapshot_date: string
  keyword: string | null
  gtrack_avg_position: number | null
  gtrack_best_position: number | null
  gtrack_grid_size: number | null
  gtrack_top3_count: number | null
  gtrack_top10_count: number | null
  gtrack_20plus_count: number | null
  discovery_rank: number | null
  discovery_total: number | null
  discovery_query: string | null
  gbp_rating: number | null
  gbp_review_count: number | null
  mobile_lcp_seconds: number | null
  mobile_speed_score: number | null
  has_schema: boolean | null
  notes: string | null
  created_at: string
}

export function useClientBaselines(contractId: number | null) {
  return useQuery<ClientBaseline[]>({
    queryKey: queryKeys.clientBaselines.byContract(contractId),
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_client_baselines')
        .select('*')
        .eq('contract_id', contractId!)
        .order('snapshot_date', { ascending: false })

      if (error) throw error
      return (data as ClientBaseline[]) ?? []
    },
  })
}

export function useLatestBaseline(contractId: number | null) {
  return useQuery<ClientBaseline | null>({
    queryKey: queryKeys.clientBaselines.latest(contractId),
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_client_baselines')
        .select('*')
        .eq('contract_id', contractId!)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return (data as ClientBaseline) ?? null
    },
  })
}
