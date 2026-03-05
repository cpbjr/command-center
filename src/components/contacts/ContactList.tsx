import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Phone, Mail, ChevronDown, ChevronUp, Star, Trash2 } from 'lucide-react'
import { useBusinessContacts, useClientContacts, useDeleteContact, useUpdateContact, type Contact } from '@/hooks/use-contacts'
import { ContactForm } from './ContactForm'
import { ContactNotes } from './ContactNotes'

interface Props {
  businessId?: string | null
  clientId?: number | null
}

function ContactRow({ contact }: { contact: Contact }) {
  const [expanded, setExpanded] = useState(false)
  const deleteContact = useDeleteContact()
  const updateContact = useUpdateContact()

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-2 bg-card hover:bg-muted/30 transition-colors">
        {/* Primary star */}
        <button
          onClick={() => updateContact.mutate({ id: contact.id, is_primary: !contact.is_primary, business_id: contact.business_id, client_id: contact.client_id })}
          className={contact.is_primary ? 'text-yellow-500' : 'text-muted-foreground/30 hover:text-yellow-400'}
          title={contact.is_primary ? 'Primary contact' : 'Set as primary'}
        >
          <Star className="h-3.5 w-3.5 fill-current" />
        </button>

        {/* Name + role */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium">{contact.name}{contact.last_name ? ` ${contact.last_name}` : ''}</span>
            {contact.role && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{contact.role}</Badge>}
          </div>
          <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:text-foreground" onClick={e => e.stopPropagation()}>
                <Phone className="h-3 w-3" /> {contact.phone}
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1 hover:text-foreground" onClick={e => e.stopPropagation()}>
                <Mail className="h-3 w-3" /> {contact.email}
              </a>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => deleteContact.mutate({ id: contact.id, business_id: contact.business_id, client_id: contact.client_id })}
            className="text-muted-foreground/40 hover:text-destructive p-1"
            title="Delete contact"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-muted-foreground hover:text-foreground p-1"
            title="View outreach log"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-3 border-t bg-muted/10">
          <ContactNotes contactId={contact.id} />
        </div>
      )}
    </div>
  )
}

export function ContactList({ businessId, clientId }: Props) {
  const [showForm, setShowForm] = useState(false)

  const businessQuery = useBusinessContacts(businessId ?? null)
  const clientQuery = useClientContacts(clientId ?? null)

  const { data: contacts = [], isLoading } = businessId ? businessQuery : clientQuery

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Contacts</span>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowForm(v => !v)}>
          + Add Contact
        </Button>
      </div>

      {showForm && (
        <ContactForm businessId={businessId} clientId={clientId} onDone={() => setShowForm(false)} />
      )}

      {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {!isLoading && contacts.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground italic">No contacts yet. Add one above.</p>
      )}

      <div className="space-y-1.5">
        {contacts.map(c => <ContactRow key={c.id} contact={c} />)}
      </div>
    </div>
  )
}
