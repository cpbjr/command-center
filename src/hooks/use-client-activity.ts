import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type ActivityType = 'call' | 'email' | 'meeting' | 'text' | 'action' | 'note'

export interface ClientActivity {
  id: number
  client_id: number
  type: ActivityType
  summary: string
  occurred_at: string
  created_at: string
}

export type ClientActivityInsert = Omit<ClientActivity, 'id' | 'created_at'>

export function useClientActivity(clientId: number | null) {
  return useQuery<ClientActivity[]>({
    queryKey: ['client-activity', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_client_activity')
        .select('*')
        .eq('client_id', clientId!)
        .order('occurred_at', { ascending: false })

      if (error) throw error
      return (data as ClientActivity[]) ?? []
    },
  })
}

export function useAddClientActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (activity: ClientActivityInsert) => {
      const { data, error } = await supabase
        .from('wpa_client_activity')
        .insert(activity)
        .select()
        .single()

      if (error) throw error
      return data as ClientActivity
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['client-activity', data.client_id] })
    },
  })
}
