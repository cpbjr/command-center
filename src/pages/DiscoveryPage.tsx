import { useState, useEffect, useRef } from 'react'
import { Loader2Icon, TelescopeIcon, StarIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScoreBadge } from '@/components/leads/ScoreBadge'
import { StatusBadge } from '@/components/leads/StatusBadge'
import { ScoreBar } from '@/components/discovery/ScoreBar'
import { LeadDetail } from '@/components/leads/LeadDetail'
import {
  useDiscoveryStats,
  useRecentDiscoveries,
  useDiscoverySearch,
  type DiscoveryBusiness,
} from '@/hooks/use-discovery'
import type { Business } from '@/hooks/use-businesses'
import { formatDate } from '@/lib/format'

const RECENT_LIMIT = 50

function parseCityFromAddress(address: string | null | undefined): string {
  if (!address) return '—'
  // Address is typically: "123 Main St, Cityname, ST 00000, Country"
  const parts = address.split(',')
  if (parts.length >= 2) {
    return parts[1].trim()
  }
  return '—'
}

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <Card className="border-wpa-border shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export default function DiscoveryPage() {
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchInput])

  const { data: stats, isLoading: statsLoading } = useDiscoveryStats()
  const { data: recent, isLoading: recentLoading } = useRecentDiscoveries(RECENT_LIMIT)
  const { data: searchResults, isLoading: searchLoading } = useDiscoverySearch(debouncedSearch)

  const isSearching = debouncedSearch.trim().length > 0
  const businesses: DiscoveryBusiness[] = isSearching
    ? (searchResults ?? [])
    : (recent ?? [])
  const isLoading = isSearching ? searchLoading : recentLoading

  function handleRowClick(biz: DiscoveryBusiness) {
    setSelectedBusiness(biz as Business)
    setDetailOpen(true)
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <TelescopeIcon className="size-6 text-pine-deep shrink-0" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Discovery</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Businesses Bud discovered and audited overnight
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {statsLoading ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </>
        ) : (
          <>
            <StatCard
              label="Total Discovered"
              value={(stats?.totalDiscovered ?? 0).toLocaleString()}
              sub="all time"
            />
            <StatCard
              label="Total Audited"
              value={(stats?.totalAudited ?? 0).toLocaleString()}
              sub="have audit data"
            />
            <StatCard
              label="Avg Score"
              value={stats?.avgScore != null ? `${stats.avgScore}/5` : '—'}
              sub="across audited"
            />
            <StatCard
              label="New"
              value={(stats?.newCount ?? 0).toLocaleString()}
              sub="uncontacted"
            />
          </>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by name, address, or category…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-md"
        />
        {(isLoading) && (
          <Loader2Icon className="size-4 animate-spin text-muted-foreground shrink-0" />
        )}
        {!isLoading && (
          <span className="text-xs text-muted-foreground shrink-0">
            {businesses.length.toLocaleString()} result{businesses.length !== 1 ? 's' : ''}
            {isSearching ? '' : ' (recent)'}
          </span>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && businesses.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <TelescopeIcon className="size-10 text-muted-foreground/40 mb-3" />
          <p className="text-base font-medium">No businesses found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {isSearching
              ? 'Try a different search term.'
              : 'Bud hasn\'t discovered any businesses yet.'}
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && businesses.length > 0 && (
        <div className="rounded-xl border border-wpa-border overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="hidden sm:table-cell font-semibold">City</TableHead>
                <TableHead className="hidden md:table-cell font-semibold">Category</TableHead>
                <TableHead className="font-semibold">Score</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="hidden lg:table-cell font-semibold">Rating</TableHead>
                <TableHead className="hidden lg:table-cell font-semibold">Audited</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {businesses.map((biz) => {
                const category = Array.isArray(biz.gbp_categories) && biz.gbp_categories.length > 0
                  ? biz.gbp_categories[0]
                  : '—'
                const city = parseCityFromAddress(biz.address)
                const auditedAt = biz.last_audited_at ? formatDate(biz.last_audited_at) : '—'

                return (
                  <TableRow
                    key={biz.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => handleRowClick(biz)}
                  >
                    <TableCell>
                      <div className="font-medium leading-tight line-clamp-1">{biz.name}</div>
                      {/* show city inline on mobile */}
                      <div className="text-xs text-muted-foreground sm:hidden">{city}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {city}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[160px] truncate">
                      {category}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <ScoreBadge score={biz.latest_score} />
                        <ScoreBar score={biz.latest_score} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={biz.contact_status} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {biz.rating != null ? (
                        <div className="flex items-center gap-1 text-sm">
                          <StarIcon className="size-3.5 fill-amber-400 text-amber-400 shrink-0" />
                          <span>{biz.rating.toFixed(1)}</span>
                          {biz.user_rating_count != null && (
                            <span className="text-muted-foreground text-xs">
                              ({biz.user_rating_count.toLocaleString()})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {auditedAt}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail sheet */}
      <LeadDetail
        business={selectedBusiness}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}
