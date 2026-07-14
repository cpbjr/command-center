import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { queryKeys } from '@/lib/query-keys'

export type Contact = Database['wpa']['Tables']['wpa_contacts']['Row']

export type ContactNote = Omit<
  Database['wpa']['Tables']['wpa_contact_notes']['Row'],
  'type'
> & {
  type: 'call' | 'email' | 'meeting' | 'text' | 'note'
}

// Fetch contacts for a business (lead)
export function useBusinessContacts(businessId: string | null) {
  return useQuery({
    queryKey: queryKeys.contacts.byBusiness(businessId),
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
      if (vars.business_id) qc.invalidateQueries({ queryKey: queryKeys.contacts.byBusiness(vars.business_id) })
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
      if (data.business_id) qc.invalidateQueries({ queryKey: queryKeys.contacts.byBusiness(data.business_id) })
    },
  })
}

// Delete a contact
export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, business_id }: { id: number; business_id?: string | null }) => {
      const { error } = await supabase.from('wpa_contacts').delete().eq('id', id)
      if (error) throw error
      return { business_id }
    },
    onSuccess: ({ business_id }) => {
      if (business_id) qc.invalidateQueries({ queryKey: queryKeys.contacts.byBusiness(business_id) })
    },
  })
}

// Fetch notes for a contact
export function useContactNotes(contactId: number | null) {
  return useQuery({
    queryKey: queryKeys.contacts.notes(contactId),
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
      qc.invalidateQueries({ queryKey: queryKeys.contacts.notes(data.contact_id) })
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
      qc.invalidateQueries({ queryKey: queryKeys.contacts.notes(contact_id) })
    },
  })
}
