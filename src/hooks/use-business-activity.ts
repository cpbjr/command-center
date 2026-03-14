import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
export type { ActivityType } from '@/hooks/use-client-activity'
import type { ActivityType } from '@/hooks/use-client-activity'

export interface BusinessActivity {
  id: number
  business_id: string
  type: ActivityType
  summary: string
  occurred_at: string
  created_at: string
}

export type BusinessActivityInsert = Omit<BusinessActivity, 'id' | 'created_at'>

export function useBusinessActivity(businessId: string | null) {
  return useQuery<BusinessActivity[]>({
    queryKey: ['business-activity', businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_business_activity')
        .select('*')
        .eq('business_id', businessId!)
        .order('occurred_at', { ascending: false })

      if (error) throw error
      return (data as BusinessActivity[]) ?? []
    },
  })
}

export function useAddBusinessActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (activity: BusinessActivityInsert) => {
      const { data, error } = await supabase
        .from('wpa_business_activity')
        .insert(activity)
        .select()
        .single()

      if (error) throw error
      return data as BusinessActivity
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['business-activity', data.business_id] })
    },
  })
}
