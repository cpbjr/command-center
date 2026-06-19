import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type ServiceTier = 'Lazy Ranking' | 'Core 30' | 'Geographic Expansion' | 'Quick Win'
export type ContractStatus = 'active' | 'paused' | 'churned'

export interface ContractBusiness {
  name: string
  website_url: string | null
  phone: string | null
  address: string | null
}

export interface Contract {
  id: number
  business_id: string
  service_tier: ServiceTier
  monthly_revenue: number
  current_phase: string
  next_action: string
  status: ContractStatus
  start_date: string
  end_date: string | null
  notes: string
  folder_path: string | null
  created_at: string
  updated_at: string
  wpa_businesses?: ContractBusiness
}

export type ContractUpdate = Partial<Omit<Contract, 'id' | 'business_id' | 'created_at' | 'wpa_businesses'>> & { id: number }

export function useContracts() {
  return useQuery<Contract[]>({
    queryKey: ['contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_contracts')
        .select('*, wpa_businesses(name, website_url, phone, address)')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data as Contract[]) ?? []
    },
  })
}

export function useUpdateContract() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: ContractUpdate) => {
      const { data, error } = await supabase
        .from('wpa_contracts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Contract
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
    },
  })
}
