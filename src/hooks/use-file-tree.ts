import { useQuery } from '@tanstack/react-query'

const FILE_SERVER_BASE = import.meta.env.VITE_FILE_SERVER_BASE_URL as string
const API_KEY = import.meta.env.VITE_FILE_SERVER_API_KEY as string

export interface FileEntry {
  name: string
  type: 'file' | 'directory'
  size: number
  modified: string
}

export interface FileListing {
  path: string
  entries: FileEntry[]
}

async function fetchListing(path: string): Promise<FileListing> {
  const url = `${FILE_SERVER_BASE}/${path}`
  const res = await fetch(url, {
    headers: { 'X-Api-Key': API_KEY },
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error('not_found')
    throw new Error(`File server error: ${res.status}`)
  }
  return res.json()
}

export function useFileListing(path: string | null) {
  return useQuery<FileListing, Error>({
    queryKey: ['file-listing', path],
    queryFn: () => fetchListing(path!),
    enabled: !!path && !!FILE_SERVER_BASE && !!API_KEY,
    retry: false,
    staleTime: 30_000,
  })
}

export function fileUrl(path: string): string {
  return `${FILE_SERVER_BASE}/${path}?key=${encodeURIComponent(API_KEY)}`
}
