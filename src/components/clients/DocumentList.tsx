import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  FileText,
  Image,
  Link,
  FileSpreadsheet,
  StickyNote,
  MapPin,
  Trash2,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react'
import {
  useClientDocuments,
  useAddDocument,
  useDeleteDocument,
  type WpaDocument,
  type DocumentInsert,
  type DocumentType,
} from '@/hooks/use-documents'

interface DocumentListProps {
  clientId: number
}

const DOCUMENT_TYPES: DocumentType[] = ['receipt', 'pdf', 'image', 'link', 'note', 'plan']

const typeIcons: Record<DocumentType, React.ReactNode> = {
  pdf: <FileText className="h-4 w-4 text-red-500" />,
  image: <Image className="h-4 w-4 text-blue-500" />,
  link: <Link className="h-4 w-4 text-green-500" />,
  receipt: <FileSpreadsheet className="h-4 w-4 text-amber-500" />,
  note: <StickyNote className="h-4 w-4 text-gray-500" />,
  plan: <MapPin className="h-4 w-4 text-pine-light" />,
}

function DocDetailSheet({ doc, onClose }: { doc: WpaDocument | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function copyPath() {
    if (doc?.file_path) {
      navigator.clipboard.writeText(doc.file_path)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Sheet open={!!doc} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {doc && (
          <>
            <SheetHeader className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="shrink-0">{typeIcons[doc.type] ?? typeIcons.note}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">{doc.type}</span>
              </div>
              <SheetTitle className="text-left leading-snug">{doc.title}</SheetTitle>
              <p className="text-xs text-muted-foreground">
                {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </SheetHeader>

            {doc.notes && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Summary</p>
                <p className="text-sm text-foreground leading-relaxed">{doc.notes}</p>
              </div>
            )}

            {doc.file_path && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">File Path</p>
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <code className="text-xs text-foreground flex-1 break-all">{doc.file_path}</code>
                  <button
                    onClick={copyPath}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy path"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {doc.url && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Link</p>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-500 hover:underline break-all"
                >
                  {doc.url}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function DocumentList({ clientId }: DocumentListProps) {
  const { data: documents = [] } = useClientDocuments(clientId)
  const addDocument = useAddDocument()
  const deleteDocument = useDeleteDocument()

  const [selectedDoc, setSelectedDoc] = useState<WpaDocument | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<DocumentType>('pdf')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')

  function resetForm() {
    setTitle('')
    setType('pdf')
    setUrl('')
    setNotes('')
    setShowForm(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    const payload: DocumentInsert = {
      client_id: clientId,
      business_id: null,
      title: title.trim(),
      type,
      file_path: null,
      url: url.trim() || null,
      notes: notes.trim() || null,
    }

    await addDocument.mutateAsync(payload)
    resetForm()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Documents</span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setShowForm((v) => !v)}
        >
          + Add Document
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border p-3 bg-muted/10">
          <div className="space-y-1">
            <label className="text-xs font-medium">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className="h-8 text-sm"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Type</label>
              <Select value={type} onValueChange={(v) => setType(v as DocumentType)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">URL</label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Notes</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              className="h-8 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={resetForm}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={addDocument.isPending}>
              {addDocument.isPending ? 'Saving...' : 'Add'}
            </Button>
          </div>
        </form>
      )}

      {documents.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground italic">No documents yet</p>
      )}

      <div className="space-y-1">
        {documents.map((doc: WpaDocument) => (
          <div
            key={doc.id}
            onClick={() => setSelectedDoc(doc)}
            className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
          >
            <span className="shrink-0">{typeIcons[doc.type] ?? typeIcons.note}</span>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block">{doc.title}</span>
              {doc.notes && (
                <span className="text-xs text-muted-foreground truncate block">{doc.notes}</span>
              )}
            </div>
            {doc.url && (
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground p-1"
                onClick={(e) => e.stopPropagation()}
                title="Open link"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); deleteDocument.mutate(doc.id) }}
              className="text-muted-foreground/40 hover:text-destructive p-1"
              title="Delete document"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <DocDetailSheet doc={selectedDoc} onClose={() => setSelectedDoc(null)} />
    </div>
  )
}
