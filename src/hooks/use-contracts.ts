import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { queryKeys } from '@/lib/query-keys'

type ContractRow = Database['wpa']['Tables']['wpa_contracts']['Row']
type BusinessRow = Database['wpa']['Tables']['wpa_businesses']['Row']

export type ServiceTier = 'Lazy Ranking' | 'Core 30' | 'Geographic Expansion' | 'Quick Win'
export type ContractStatus = 'active' | 'paused' | 'churned'

export type ContractBusiness = Pick<
  BusinessRow,
  'name' | 'website_url' | 'phone' | 'address'
>

// Generated contract row with the domain enums narrowed and the selected
// wpa_businesses join added.
export type Contract = Omit<ContractRow, 'service_tier' | 'status'> & {
  service_tier: ServiceTier
  status: ContractStatus
  wpa_businesses?: ContractBusiness
}

export type ContractUpdate = Partial<Omit<Contract, 'id' | 'business_id' | 'created_at' | 'wpa_businesses'>> & { id: number }

export function useContracts() {
  return useQuery<Contract[]>({
    queryKey: queryKeys.contracts.all,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all })
    },
  })
}
