import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Contact {
  id: number
  business_id: string | null
  client_id: number | null
  name: string
  last_name: string
  role: string
  phone: string
  email: string
  is_primary: boolean
  notes: string
  created_at: string
  updated_at: string
}

export interface ContactNote {
  id: number
  contact_id: number
  type: 'call' | 'email' | 'meeting' | 'text' | 'note'
  body: string
  occurred_at: string
  created_at: string
}

// Fetch contacts for a business (lead)
export function useBusinessContacts(businessId: string | null) {
  return useQuery({
    queryKey: ['contacts', 'business', businessId],
    queryFn: async () => {
      if (!businessId) return []
      const { data, error } = await supabase
        .from('wpa_contacts')
        .select('*')
        .eq('business_id', businessId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Contact[]
    },
    enabled: !!businessId,
  })
}

// Fetch contacts for a client
export function useClientContacts(clientId: number | null) {
  return useQuery({
    queryKey: ['contacts', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data, error } = await supabase
        .from('wpa_contacts')
        .select('*')
        .eq('client_id', clientId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Contact[]
    },
    enabled: !!clientId,
  })
}

// Add a contact
export function useAddContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('wpa_contacts')
        .insert(contact)
        .select()
        .single()
      if (error) throw error
      return data as Contact
    },
    onSuccess: (_, vars) => {
      if (vars.business_id) qc.invalidateQueries({ queryKey: ['contacts', 'business', vars.business_id] })
      if (vars.client_id) qc.invalidateQueries({ queryKey: ['contacts', 'client', vars.client_id] })
    },
  })
}

// Update a contact
export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contact> & { id: number }) => {
      const { data, error } = await supabase
        .from('wpa_contacts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Contact
    },
    onSuccess: (data) => {
      if (data.business_id) qc.invalidateQueries({ queryKey: ['contacts', 'business', data.business_id] })
      if (data.client_id) qc.invalidateQueries({ queryKey: ['contacts', 'client', data.client_id] })
    },
  })
}

// Delete a contact
export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, business_id, client_id }: { id: number; business_id?: string | null; client_id?: number | null }) => {
      const { error } = await supabase.from('wpa_contacts').delete().eq('id', id)
      if (error) throw error
      return { business_id, client_id }
    },
    onSuccess: ({ business_id, client_id }) => {
      if (business_id) qc.invalidateQueries({ queryKey: ['contacts', 'business', business_id] })
      if (client_id) qc.invalidateQueries({ queryKey: ['contacts', 'client', client_id] })
    },
  })
}

// Fetch notes for a contact
export function useContactNotes(contactId: number | null) {
  return useQuery({
    queryKey: ['contact-notes', contactId],
    queryFn: async () => {
      if (!contactId) return []
      const { data, error } = await supabase
        .from('wpa_contact_notes')
        .select('*')
        .eq('contact_id', contactId)
        .order('occurred_at', { ascending: false })
      if (error) throw error
      return data as ContactNote[]
    },
    enabled: !!contactId,
  })
}

// Add a note to a contact
export function useAddContactNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (note: Omit<ContactNote, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('wpa_contact_notes')
        .insert(note)
        .select()
        .single()
      if (error) throw error
      return data as ContactNote
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['contact-notes', data.contact_id] })
    },
  })
}

// Delete a note
export function useDeleteContactNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, contact_id }: { id: number; contact_id: number }) => {
      const { error } = await supabase.from('wpa_contact_notes').delete().eq('id', id)
      if (error) throw error
      return { contact_id }
    },
    onSuccess: ({ contact_id }) => {
      qc.invalidateQueries({ queryKey: ['contact-notes', contact_id] })
    },
  })
}
