import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type DocumentType = 'receipt' | 'pdf' | 'image' | 'link' | 'note' | 'plan'

export interface WpaDocument {
  id: number
  client_id: number | null
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
        .select('*, wpa_clients(name)')
        .order('created_at', { ascending: false })

      if (typeFilter) {
        query = query.eq('type', typeFilter)
      }

      const { data, error } = await query
      if (error) throw error

      return (data ?? []).map((d: any) => ({
        ...d,
        client_name: d.wpa_clients?.name ?? null,
        wpa_clients: undefined,
      }))
    },
  })
}

export function useClientDocuments(clientId: number | null) {
  return useQuery<WpaDocument[]>({
    queryKey: ['documents', 'client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_documents')
        .select('*')
        .eq('client_id', clientId!)
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
      if (data.client_id) {
        queryClient.invalidateQueries({ queryKey: ['documents', 'client', data.client_id] })
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
      if (data.client_id) {
        queryClient.invalidateQueries({ queryKey: ['documents', 'client', data.client_id] })
      }
      if (data.business_id) {
        queryClient.invalidateQueries({ queryKey: ['documents', 'business', data.business_id] })
      }
    },
  })
}
