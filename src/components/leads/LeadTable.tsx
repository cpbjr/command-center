import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ScoreBadge } from './ScoreBadge'
import { ConvertToClientDialog } from './ConvertToClientDialog'
import { type Business, useUpdateBusinessStatus } from '@/hooks/use-businesses'
import { ChevronLeftIcon, ChevronRightIcon, StarIcon, GlobeIcon, PhoneIcon, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

function extractCity(address: string): string {
  if (!address) return '—'
  // "123 Main St, Boise, ID 83702" → "Boise"
  const parts = address.split(',')
  if (parts.length >= 2) {
    return parts[parts.length - 2].trim()
  }
  return address
}

interface LeadTableProps {
  businesses: Business[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onSelectBusiness: (b: Business) => void
  selectedId?: string | null
}

export function LeadTable({
  businesses,
  total,
  page,
  pageSize,
  onPageChange,
  onSelectBusiness,
  selectedId,
}: LeadTableProps) {
  type SortField = 'name' | 'city' | 'category' | 'status' | 'score'
  type SortDir = 'asc' | 'desc'
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function getCategory(biz: Business): string {
    return Array.isArray(biz.gbp_categories) && biz.gbp_categories.length > 0
      ? biz.gbp_categories[0]
      : biz.search_query || '—'
  }

  const sorted = useMemo(() => {
    return [...businesses].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = (a.name ?? '').localeCompare(b.name ?? ''); break
        case 'city': cmp = extractCity(a.address).localeCompare(extractCity(b.address)); break
        case 'category': cmp = getCategory(a).localeCompare(getCategory(b)); break
        case 'status': cmp = (a.contact_status ?? '').localeCompare(b.contact_status ?? ''); break
        case 'score': cmp = (a.latest_score ?? 0) - (b.latest_score ?? 0); break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [businesses, sortField, sortDir])

  function SortHeader({ field, label }: { field: SortField; label: string }) {
    return (
      <TableHead
        className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
        onClick={() => toggleSort(field)}
      >
        <div className="flex items-center gap-1">
          {label}
          {sortField === field ? (
            sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />
          )}
        </div>
      </TableHead>
    )
  }

  const updateStatus = useUpdateBusinessStatus()
  const totalPages = Math.ceil(total / pageSize)
  const start = page * pageSize + 1
  const end = Math.min((page + 1) * pageSize, total)

  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [pendingBusiness, setPendingBusiness] = useState<Business | null>(null)

  function handleStatusChange(biz: Business, status: Business['contact_status']) {
    if (status === 'CLOSED-WON') {
      setPendingBusiness(biz)
      setConvertDialogOpen(true)
    } else {
      updateStatus.mutate({ id: biz.id, contact_status: status })
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader field="name" label="Name" />
                <SortHeader field="city" label="City" />
                <SortHeader field="category" label="Category" />
                <SortHeader field="score" label="Score" />
                <SortHeader field="status" label="Status" />
                <TableHead className="w-[80px] text-center">Rating</TableHead>
                <TableHead className="w-[130px]">Phone</TableHead>
                <TableHead className="w-[60px] text-center">Web</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {businesses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                    No leads found
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((biz) => {
                const category = getCategory(biz)

                return (
                  <TableRow
                    key={biz.id}
                    onClick={() => onSelectBusiness(biz)}
                    className={cn(
                      'cursor-pointer',
                      selectedId === biz.id && 'bg-accent'
                    )}
                  >
                    <TableCell className="truncate max-w-[220px]">
                      {biz.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {extractCity(biz.address)}
                    </TableCell>
                    <TableCell className="text-sm truncate max-w-[160px] text-muted-foreground">
                      {category}
                    </TableCell>
                    <TableCell className="text-center">
                      <ScoreBadge score={biz.latest_score} />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={biz.contact_status}
                        onValueChange={(v) =>
                          handleStatusChange(biz, v as Business['contact_status'])
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          className="h-7 w-[110px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(['NEW', 'IDENTIFIED', 'TARGETED', 'CONTACTED', 'REPLIED', 'CLOSED', 'CLOSED-WON'] as const).map((s) => (
                            <SelectItem key={s} value={s}>
                              {s === 'CLOSED-WON' ? 'Closed-Won' : s.charAt(0) + s.slice(1).toLowerCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      {biz.rating != null ? (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <StarIcon className="size-3 fill-amber-400 text-amber-400" />
                          {biz.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {biz.phone ? (
                        <a
                          href={`tel:${biz.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          <PhoneIcon className="size-3" />
                          {biz.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {biz.website_url ? (
                        <a
                          href={biz.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                        >
                          <GlobeIcon className="size-4" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-muted-foreground">
            {total === 0 ? 'No results' : `${start}–${end} of ${total}`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 0}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="px-2 text-sm">
              {page + 1} / {Math.max(totalPages, 1)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <ConvertToClientDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        business={pendingBusiness}
      />
    </>
  )
}
