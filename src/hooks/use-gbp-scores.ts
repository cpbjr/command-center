import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface GbpScore {
  id: number
  client_id: number
  score: number
  notes: string | null
  recorded_at: string
  created_at: string
}

export type GbpScoreInsert = Omit<GbpScore, 'id' | 'created_at'>

export function useGbpScores(clientId: number | null) {
  return useQuery<GbpScore[]>({
    queryKey: ['gbp-scores', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_gbp_scores')
        .select('*')
        .eq('client_id', clientId!)
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
      queryClient.invalidateQueries({ queryKey: ['gbp-scores', data.client_id] })
    },
  })
}
