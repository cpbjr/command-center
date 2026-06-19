import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type ActivityType = 'call' | 'email' | 'meeting' | 'text' | 'action' | 'note' | 'stage_change'

export interface Activity {
  id: number
  business_id: string
  type: ActivityType
  summary: string
  occurred_at: string
  created_at: string
}

export function useActivity(businessId: string | null) {
  return useQuery<Activity[]>({
    queryKey: ['activity', businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_activity')
        .select('*')
        .eq('business_id', businessId!)
        .order('occurred_at', { ascending: false })
      if (error) throw error
      return (data as Activity[]) ?? []
    },
  })
}

export function useAddActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      business_id,
      type,
      summary,
      occurred_at,
    }: {
      business_id: string
      type: ActivityType
      summary: string
      occurred_at?: string
    }) => {
      const { data, error } = await supabase.rpc('append_activity', {
        p_business_id: business_id,
        p_type: type,
        p_summary: summary,
        p_occurred_at: occurred_at ?? new Date().toISOString(),
      })
      if (error) throw error
      return data as Activity
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['activity', vars.business_id] })
    },
  })
}
