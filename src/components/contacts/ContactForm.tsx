import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAddContact } from '@/hooks/use-contacts'

interface Props {
  businessId?: string | null
  clientId?: number | null
  onDone: () => void
}

export function ContactForm({ businessId, clientId, onDone }: Props) {
  const add = useAddContact()
  const [name, setName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await add.mutateAsync({
      business_id: businessId ?? null,
      client_id: clientId ?? null,
      name: name.trim(),
      last_name: lastName.trim(),
      role: role.trim(),
      phone: phone.trim(),
      email: email.trim(),
      is_primary: false,
      notes: '',
    })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border rounded-lg p-3 bg-muted/30">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">First Name *</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Jane" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Last Name</label>
          <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Role</label>
          <Input value={role} onChange={e => setRole(e.target.value)} placeholder="Owner" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Phone</label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(208) 555-1234" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Email</label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" className="h-8 text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={add.isPending || !name.trim()}>
          {add.isPending ? 'Saving…' : 'Add Contact'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  )
}
