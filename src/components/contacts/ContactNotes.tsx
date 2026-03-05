import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useContactNotes, useAddContactNote, useDeleteContactNote, type ContactNote } from '@/hooks/use-contacts'
import { Phone, Mail, Users, MessageSquare, FileText, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const TYPE_ICONS: Record<ContactNote['type'], React.ReactNode> = {
  call: <Phone className="h-3 w-3" />,
  email: <Mail className="h-3 w-3" />,
  meeting: <Users className="h-3 w-3" />,
  text: <MessageSquare className="h-3 w-3" />,
  note: <FileText className="h-3 w-3" />,
}

const TYPE_COLORS: Record<ContactNote['type'], string> = {
  call: 'bg-green-100 text-green-700',
  email: 'bg-blue-100 text-blue-700',
  meeting: 'bg-purple-100 text-purple-700',
  text: 'bg-yellow-100 text-yellow-700',
  note: 'bg-gray-100 text-gray-700',
}

interface Props {
  contactId: number
}

export function ContactNotes({ contactId }: Props) {
  const { data: notes = [], isLoading } = useContactNotes(contactId)
  const addNote = useAddContactNote()
  const deleteNote = useDeleteContactNote()

  const [body, setBody] = useState('')
  const [type, setType] = useState<ContactNote['type']>('call')
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    if (!body.trim()) return
    await addNote.mutateAsync({ contact_id: contactId, type, body: body.trim(), occurred_at: new Date().toISOString() })
    setBody('')
    setAdding(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Outreach Log</span>
        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setAdding(v => !v)}>
          + Log
        </Button>
      </div>

      {adding && (
        <div className="space-y-2 border rounded p-2 bg-muted/20">
          <div className="flex gap-2">
            <Select value={type} onValueChange={v => setType(v as ContactNote['type'])}>
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="note">Note</SelectItem>
              </SelectContent>
            </Select>
            <textarea
              value={body}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
              placeholder="Left voicemail, called back in 10min…"
              className="text-xs min-h-[60px] flex-1 rounded-md border border-input bg-background px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={addNote.isPending || !body.trim()}>
              {addNote.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {notes.length === 0 && !isLoading && (
        <p className="text-xs text-muted-foreground italic">No outreach logged yet.</p>
      )}

      <div className="space-y-1">
        {notes.map(n => (
          <div key={n.id} className="flex gap-2 items-start text-xs group">
            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${TYPE_COLORS[n.type]}`}>
              {TYPE_ICONS[n.type]} {n.type}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-foreground leading-snug">{n.body}</p>
              <p className="text-muted-foreground mt-0.5">
                {formatDistanceToNow(new Date(n.occurred_at), { addSuffix: true })}
              </p>
            </div>
            <button
              onClick={() => deleteNote.mutate({ id: n.id, contact_id: contactId })}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
