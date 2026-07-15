import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBusinessCategories } from '@/hooks/use-businesses'
import { LEAD_DROPDOWN_STAGES, STAGE_LABELS, type LifecycleStage } from '@/lib/lifecycle'
import { XIcon, SearchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LeadFiltersProps {
  search: string
  onSearchChange: (v: string) => void
  stageFilter: LifecycleStage[]
  onStageFilterChange: (v: LifecycleStage[]) => void
  category: string
  onCategoryChange: (v: string) => void
  scoreRange: [number, number]
  onScoreRangeChange: (v: [number, number]) => void
  noWebsite: boolean
  onNoWebsiteChange: (v: boolean) => void
}

export function LeadFilters({
  search,
  onSearchChange,
  stageFilter,
  onStageFilterChange,
  category,
  onCategoryChange,
  scoreRange,
  onScoreRangeChange,
  noWebsite,
  onNoWebsiteChange,
}: LeadFiltersProps) {
  const { data: categories = [] } = useBusinessCategories()



  function clearAll() {
    onSearchChange('')
    onStageFilterChange([])
    onCategoryChange('')
    onScoreRangeChange([0, 5])
    onNoWebsiteChange(false)
  }

  const hasActiveFilters =
    search.trim() !== '' ||
    stageFilter.length > 0 ||
    category !== '' ||
    scoreRange[0] !== 0 ||
    scoreRange[1] !== 5 ||
    noWebsite

  return (
    <div className="space-y-3 w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center w-full">
        {/* Search */}
        <div className="relative flex-1 md:min-w-[200px]">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or address..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status */}
        <Select
          value={stageFilter.length === 1 ? stageFilter[0] : '__all__'}
          onValueChange={(v) => onStageFilterChange(v === '__all__' ? [] : [v as LifecycleStage])}
        >
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {LEAD_DROPDOWN_STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {STAGE_LABELS[stage]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category */}
        <Select value={category || '__all__'} onValueChange={(v) => onCategoryChange(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Score range */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Score</span>
          <Select
            value={String(scoreRange[0])}
            onValueChange={(v) => onScoreRangeChange([Number(v), scoreRange[1]])}
          >
            <SelectTrigger className="w-16" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">–</span>
          <Select
            value={String(scoreRange[1])}
            onValueChange={(v) => onScoreRangeChange([scoreRange[0], Number(v)])}
          >
            <SelectTrigger className="w-16" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* No Website button */}
        <button
          onClick={() => onNoWebsiteChange(!noWebsite)}
          className={cn(
            'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
            noWebsite
              ? 'border-amber-500 bg-amber-500 text-white'
              : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          No Website
        </button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1 text-muted-foreground ml-auto">
            <XIcon className="size-3.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
