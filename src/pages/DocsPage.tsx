import { useState } from 'react'
import { FileText, File, Image, Link, Receipt, MapPin, ChevronRight } from 'lucide-react'
import { useAllDocuments, type DocumentType } from '@/hooks/use-documents'
import { cn } from '@/lib/utils'

const TYPE_META: Record<DocumentType, { label: string; icon: React.ElementType; color: string }> = {
  plan:    { label: 'Plans',    icon: MapPin,    color: 'text-pine-light bg-pine-light/10' },
  note:    { label: 'Notes',    icon: FileText,  color: 'text-sand bg-sand/10' },
  pdf:     { label: 'PDFs',     icon: File,      color: 'text-red-400 bg-red-400/10' },
  image:   { label: 'Images',   icon: Image,     color: 'text-blue-400 bg-blue-400/10' },
  link:    { label: 'Links',    icon: Link,      color: 'text-purple-400 bg-purple-400/10' },
  receipt: { label: 'Receipts', icon: Receipt,   color: 'text-amber-400 bg-amber-400/10' },
}

const ALL_TYPES = Object.keys(TYPE_META) as DocumentType[]

function TypeBadge({ type }: { type: DocumentType }) {
  const meta = TYPE_META[type]
  const Icon = meta.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', meta.color)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  )
}

function DocRow({ doc }: { doc: ReturnType<typeof useAllDocuments>['data'] extends (infer T)[] | undefined ? T : never }) {
  const href = doc.url ?? (doc.file_path ? `#${doc.file_path}` : undefined)

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-surface-hover transition-colors group">
      <div className="mt-0.5">
        <TypeBadge type={doc.type} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary truncate">{doc.title}</span>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-pine-light"
              title="Open"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {doc.client_name && (
            <span className="text-xs text-text-tertiary">{doc.client_name}</span>
          )}
          {doc.notes && (
            <span className="text-xs text-text-tertiary truncate max-w-sm">{doc.notes}</span>
          )}
        </div>
        {doc.file_path && (
          <span className="text-xs text-text-tertiary/60 font-mono truncate block mt-0.5">{doc.file_path}</span>
        )}
      </div>
      <span className="text-xs text-text-tertiary shrink-0 mt-0.5">
        {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </span>
    </div>
  )
}

export default function DocsPage() {
  const [activeType, setActiveType] = useState<DocumentType | undefined>(undefined)
  const { data: docs = [], isLoading } = useAllDocuments(activeType)

  const countsByType = docs.reduce<Record<string, number>>((acc, d) => {
    acc[d.type] = (acc[d.type] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border-subtle">
        <h1 className="text-xl font-serif font-bold text-text-primary">Docs</h1>
        <p className="text-sm text-text-tertiary mt-0.5">Plans, notes, files, and links across all clients.</p>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar filter */}
        <div className="w-44 shrink-0 border-r border-border-subtle py-4 px-3 flex flex-col gap-1">
          <button
            onClick={() => setActiveType(undefined)}
            className={cn(
              'flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors w-full text-left',
              activeType === undefined
                ? 'bg-pine-light/10 text-pine-light font-medium'
                : 'text-text-secondary hover:bg-surface-hover'
            )}
          >
            <span>All</span>
            <span className="text-xs text-text-tertiary">{docs.length}</span>
          </button>

          {ALL_TYPES.map((type) => {
            const meta = TYPE_META[type]
            const Icon = meta.icon
            const count = countsByType[type] ?? 0
            if (count === 0 && activeType !== type) return null
            return (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors w-full text-left gap-2',
                  activeType === type
                    ? 'bg-pine-light/10 text-pine-light font-medium'
                    : 'text-text-secondary hover:bg-surface-hover'
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" />
                  {meta.label}
                </span>
                <span className="text-xs text-text-tertiary">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Doc list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-text-tertiary text-sm">
              Loading…
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <FileText className="h-10 w-10 text-text-tertiary" />
              <p className="text-sm text-text-tertiary">No documents yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {docs.map((doc) => (
                <DocRow key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
