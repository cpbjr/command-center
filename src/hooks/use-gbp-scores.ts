import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/query-keys'

export interface GbpScore {
  id: number
  contract_id: number
  score: number
  notes: string | null
  recorded_at: string
  created_at: string
}

export type GbpScoreInsert = Omit<GbpScore, 'id' | 'created_at'>

export function useGbpScores(contractId: number | null) {
  return useQuery<GbpScore[]>({
    queryKey: queryKeys.gbpScores.byContract(contractId),
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_gbp_scores')
        .select('*')
        .eq('contract_id', contractId!)
        .order('recorded_at', { ascending: false })

      if (error) throw error
      return (data as GbpScore[]) ?? []
    },
  })
}

export function useAddGbpScore() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (score: GbpScoreInsert) => {
      const { data, error } = await supabase
        .from('wpa_gbp_scores')
        .insert(score)
        .select()
        .single()

      if (error) throw error
      return data as GbpScore
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gbpScores.byContract(data.contract_id) })
    },
  })
}
