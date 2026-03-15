import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type ServiceTier = 'Lazy Ranking' | 'Core 30' | 'Geographic Expansion' | 'Quick Win'
export type ClientStatus = 'active' | 'paused' | 'churned'

export interface Client {
  id: number
  name: string
  address: string
  phone: string
  website_url: string
  business_id: string | null
  service_tier: ServiceTier
  monthly_revenue: number
  current_phase: string
  next_action: string
  status: ClientStatus
  start_date: string
  notes: string
  folder_path: string | null
  created_at: string
  updated_at: string
}

export type ClientInsert = Omit<Client, 'id' | 'created_at' | 'updated_at' | 'business_id'> & { business_id?: string | null }
export type ClientUpdate = Partial<ClientInsert> & { id: number }

export function useClients() {
  return useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_clients')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      return (data as Client[]) ?? []
    },
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (client: ClientInsert) => {
      const { data, error } = await supabase
        .from('wpa_clients')
        .insert(client)
        .select()
        .single()

      if (error) throw error
      return data as Client
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: ClientUpdate) => {
      const { data, error } = await supabase
        .from('wpa_clients')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Client
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
