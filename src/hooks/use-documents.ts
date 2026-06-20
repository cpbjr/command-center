import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type DocumentType = 'receipt' | 'pdf' | 'image' | 'link' | 'note' | 'plan'

export interface WpaDocument {
  id: number
  contract_id: number | null
  business_id: string | null
  title: string
  type: DocumentType
  file_path: string | null
  url: string | null
  notes: string | null
  created_at: string
}

export type DocumentInsert = Omit<WpaDocument, 'id' | 'created_at'>

export interface WpaDocumentWithClient extends WpaDocument {
  client_name?: string | null
}

export function useAllDocuments(typeFilter?: DocumentType) {
  return useQuery<WpaDocumentWithClient[]>({
    queryKey: ['documents', 'all', typeFilter],
    queryFn: async () => {
      let query = supabase
        .from('wpa_documents')
        .select('*, wpa_contracts(id, wpa_businesses(name))')
        .order('created_at', { ascending: false })

      if (typeFilter) {
        query = query.eq('type', typeFilter)
      }

      const { data, error } = await query
      if (error) throw error

      return (data ?? []).map((d: any) => ({
        ...d,
        client_name: d.wpa_contracts?.wpa_businesses?.name ?? null,
        wpa_contracts: undefined,
      }))
    },
  })
}

export function useContractDocuments(contractId: number | null) {
  return useQuery<WpaDocument[]>({
    queryKey: ['documents', 'contract', contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_documents')
        .select('*')
        .eq('contract_id', contractId!)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as WpaDocument[]) ?? []
    },
  })
}

export function useAddDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (doc: DocumentInsert) => {
      const { data, error } = await supabase
        .from('wpa_documents')
        .insert(doc)
        .select()
        .single()

      if (error) throw error
      return data as WpaDocument
    },
    onSuccess: (data) => {
      if (data.contract_id) {
        queryClient.invalidateQueries({ queryKey: ['documents', 'contract', data.contract_id] })
      }
      if (data.business_id) {
        queryClient.invalidateQueries({ queryKey: ['documents', 'business', data.business_id] })
      }
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const { data, error } = await supabase
        .from('wpa_documents')
        .delete()
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as WpaDocument
    },
    onSuccess: (data) => {
      if (data.contract_id) {
        queryClient.invalidateQueries({ queryKey: ['documents', 'contract', data.contract_id] })
      }
      if (data.business_id) {
        queryClient.invalidateQueries({ queryKey: ['documents', 'business', data.business_id] })
      }
    },
  })
}
