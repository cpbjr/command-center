import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface GbpInsight {
  id: number
  client_id: number
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

export function useGbpInsights(clientId: number | null) {
  return useQuery<GbpInsight[]>({
    queryKey: ['gbp-insights', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('wpa')
        .from('wpa_gbp_insights')
        .select('*')
        .eq('client_id', clientId!)
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
        .upsert(insight, { onConflict: 'client_id,week_ending' })
        .select()
        .single()

      if (error) throw error
      return data as GbpInsight
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gbp-insights', data.client_id] })
    },
  })
}
