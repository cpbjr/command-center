import { useState, useEffect } from 'react'
import { LeadFilters } from '@/components/leads/LeadFilters'
import { LeadTable } from '@/components/leads/LeadTable'
import { LeadCard } from '@/components/leads/LeadCard'
import { LeadDetail } from '@/components/leads/LeadDetail'
import { useBusinesses, type Business } from '@/hooks/use-businesses'
import { Loader2Icon } from 'lucide-react'

const PAGE_SIZE = 50

export default function LeadsPage() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [category, setCategory] = useState('')
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 5])
  const [noWebsite, setNoWebsite] = useState(false)
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data, isLoading, isFetching } = useBusinesses({
    page,
    pageSize: PAGE_SIZE,
    statusFilter,
    scoreRange,
    search,
    category,
    noWebsite,
  })

  const businesses = data?.data ?? []
  const total = data?.count ?? 0

  useEffect(() => {
    if (!selectedBusiness) return
    const fresh = businesses.find((b) => b.id === selectedBusiness.id)
    if (fresh) setSelectedBusiness(fresh)
  }, [businesses])

  function handleSearchChange(v: string) {
    setSearch(v)
    setPage(0)
  }

  function handleStatusFilterChange(v: string[]) {
    setStatusFilter(v)
    setPage(0)
  }

  function handleCategoryChange(v: string) {
    setCategory(v)
    setPage(0)
  }

  function handleScoreRangeChange(v: [number, number]) {
    setScoreRange(v)
    setPage(0)
  }

  function handleNoWebsiteChange(v: boolean) {
    setNoWebsite(v)
    setPage(0)
  }

  function handleSelectBusiness(b: Business) {
    setSelectedBusiness(b)
    setDetailOpen(true)
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Lead Pipeline</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading ? 'Loading...' : `${total.toLocaleString()} businesses`}
          </p>
        </div>
        {isFetching && !isLoading && (
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Filters */}
      <LeadFilters
        search={search}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        category={category}
        onCategoryChange={handleCategoryChange}
        scoreRange={scoreRange}
        onScoreRangeChange={handleScoreRangeChange}
        noWebsite={noWebsite}
        onNoWebsiteChange={handleNoWebsiteChange}
      />

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && businesses.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-lg font-medium">No leads found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your filters or search query.
          </p>
        </div>
      )}

      {/* Desktop table */}
      {!isLoading && businesses.length > 0 && (
        <div className="hidden md:block">
          <LeadTable
            businesses={businesses}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            onSelectBusiness={handleSelectBusiness}
            selectedId={selectedBusiness?.id}
          />
        </div>
      )}

      {/* Mobile cards */}
      {!isLoading && businesses.length > 0 && (
        <div className="block md:hidden space-y-2">
          {businesses.map((biz) => (
            <LeadCard
              key={biz.id}
              business={biz}
              onClick={() => handleSelectBusiness(biz)}
            />
          ))}
          {/* Mobile pagination */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded border px-3 py-1 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {Math.max(Math.ceil(total / PAGE_SIZE), 1)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= total}
              className="rounded border px-3 py-1 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
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
