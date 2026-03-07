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

  const inner = (
    <div className="flex-1 min-w-0 flex flex-col gap-1">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-text-primary break-words whitespace-normal leading-snug pt-0.5">{doc.title}</span>
        <div className="flex flex-col items-end shrink-0 gap-1.5 mt-0.5">
          <span className="text-xs text-text-tertiary whitespace-nowrap">
            {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {href && (
            <ChevronRight className="h-4 w-4 text-text-tertiary opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity mt-1" />
          )}
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-3 mt-1">
        <TypeBadge type={doc.type} />
        {doc.client_name && (
          <span className="text-[13px] font-medium text-text-secondary">{doc.client_name}</span>
        )}
      </div>

      {doc.notes && (
        <span className="text-xs text-text-tertiary line-clamp-2 max-w-sm mt-1">{doc.notes}</span>
      )}
      {doc.file_path && (
        <span className="text-xs text-text-tertiary/60 font-mono break-all mt-1">{doc.file_path}</span>
      )}
    </div>
  )

  const className = "flex items-start gap-4 px-4 py-4 hover:bg-surface-hover transition-colors group cursor-pointer"

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    )
  }

  return <div className={className}>{inner}</div>
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
      <div className="px-6 py-3 border-b border-border-subtle">
        <p className="text-sm text-text-tertiary">Plans, notes, files, and links across all clients.</p>
      </div>

      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Sidebar filter */}
        <div className="w-full md:w-44 shrink-0 border-b md:border-b-0 md:border-r border-border-subtle py-3 px-4 md:py-4 md:px-3 flex flex-row md:flex-col overflow-x-auto md:overflow-visible gap-2 md:gap-1 scrollbar-hide">
          <button
            onClick={() => setActiveType(undefined)}
            className={cn(
              'flex items-center justify-between px-3 h-9 md:h-auto md:py-2 rounded-[var(--radius-md)] text-sm transition-colors whitespace-nowrap min-w-fit md:w-full md:min-w-0 md:text-left gap-2',
              activeType === undefined
                ? 'bg-pine-light/10 text-pine-light font-medium'
                : 'text-text-secondary hover:bg-surface-hover bg-muted/20 md:bg-transparent'
            )}
          >
            <span>All</span>
            <span className="text-xs text-text-tertiary ml-2 md:ml-0">{docs.length}</span>
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
                  'flex items-center justify-between px-3 h-9 md:h-auto md:py-2 rounded-[var(--radius-md)] text-sm transition-colors whitespace-nowrap min-w-fit md:w-full md:min-w-0 md:text-left gap-2',
                  activeType === type
                    ? 'bg-pine-light/10 text-pine-light font-medium'
                    : 'text-text-secondary hover:bg-surface-hover bg-muted/20 md:bg-transparent'
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 md:h-3.5 md:w-3.5 shrink-0" />
                  {meta.label}
                </span>
                <span className="text-xs text-text-tertiary ml-2 md:ml-0">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Doc list */}
        <div className="flex-1 overflow-y-auto w-full">
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
