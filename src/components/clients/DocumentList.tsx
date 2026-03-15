import { useState, useEffect } from 'react'
import { Folder, FileText, File, ChevronRight, ArrowLeft, ExternalLink, AlertCircle, FolderOpen } from 'lucide-react'
import { useFileListing, fileUrl, type FileEntry } from '@/hooks/use-file-tree'

interface DocumentListProps {
  folderPath: string | null
}

function formatSize(bytes: number): string {
  if (bytes === 0) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'md' || ext === 'txt') return <FileText className="h-4 w-4 text-blue-400 shrink-0" />
  if (ext === 'pdf') return <FileText className="h-4 w-4 text-red-400 shrink-0" />
  return <File className="h-4 w-4 text-muted-foreground shrink-0" />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2 pt-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-10 w-full rounded-md bg-muted/40 animate-pulse" />
      ))}
    </div>
  )
}

export function DocumentList({ folderPath }: DocumentListProps) {
  const [currentPath, setCurrentPath] = useState<string | null>(folderPath)

  // Reset navigation when the root folder changes (e.g. opening a different client)
  useEffect(() => {
    setCurrentPath(folderPath)
  }, [folderPath])

  const { data, isLoading, error } = useFileListing(currentPath)

  if (!folderPath) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <FolderOpen className="h-4 w-4" />
        <span>No folder linked yet</span>
      </div>
    )
  }

  if (isLoading) return <LoadingSkeleton />

  if (error) {
    const isNotFound = error.message === 'not_found'
    return (
      <div className="flex items-start gap-2 py-4 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{isNotFound ? 'No folder found on file server' : `Error: ${error.message}`}</span>
      </div>
    )
  }

  const entries = data?.entries ?? []
  const dirs = entries.filter((e) => e.type === 'directory')
  const files = entries.filter((e) => e.type === 'file')
  const isRoot = currentPath === folderPath

  // Build breadcrumb segments relative to root
  const relativeParts = currentPath && folderPath
    ? currentPath.slice(folderPath.length).split('/').filter(Boolean)
    : []

  function navigateUp() {
    if (!currentPath || isRoot) return
    const parts = currentPath.split('/')
    parts.pop()
    setCurrentPath(parts.join('/'))
  }

  function navigateInto(entry: FileEntry) {
    setCurrentPath(`${currentPath}/${entry.name}`)
  }

  return (
    <div className="space-y-1">
      {/* Breadcrumb / back navigation */}
      {!isRoot && (
        <button
          onClick={navigateUp}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 -ml-1 px-1 py-1 rounded"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="truncate max-w-[200px]">
            {relativeParts.length > 1
              ? relativeParts[relativeParts.length - 2]
              : folderPath?.split('/').pop()}
          </span>
        </button>
      )}

      {/* Current folder label when drilled in */}
      {!isRoot && relativeParts.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground pb-1 mb-1 border-b">
          <Folder className="h-3.5 w-3.5 text-amber-400" />
          <span>{relativeParts[relativeParts.length - 1]}</span>
        </div>
      )}

      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-2">Empty folder</p>
      )}

      {/* Directories first */}
      {dirs.map((entry) => (
        <button
          key={entry.name}
          onClick={() => navigateInto(entry)}
          className="w-full flex items-center gap-2.5 px-2 py-2.5 rounded-md hover:bg-muted/40 transition-colors text-left"
        >
          <Folder className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="flex-1 text-sm font-medium truncate">{entry.name}</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      ))}

      {/* Files */}
      {files.map((entry) => (
        <a
          key={entry.name}
          href={fileUrl(`${currentPath}/${entry.name}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-2 py-2.5 rounded-md hover:bg-muted/40 transition-colors"
        >
          {fileIcon(entry.name)}
          <span className="flex-1 text-sm truncate">{entry.name}</span>
          {entry.size > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">{formatSize(entry.size)}</span>
          )}
          <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
        </a>
      ))}
    </div>
  )
}
