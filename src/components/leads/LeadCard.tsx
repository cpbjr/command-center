import { StatusBadge } from './StatusBadge'
import { ScoreBadge } from './ScoreBadge'
import { type Business } from '@/hooks/use-businesses'
import { StarIcon } from 'lucide-react'

interface LeadCardProps {
  business: Business
  onClick: () => void
}

export function LeadCard({ business, onClick }: LeadCardProps) {
  const category =
    Array.isArray(business.gbp_categories) && business.gbp_categories.length > 0
      ? business.gbp_categories[0]
      : business.search_query || null

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/50 active:bg-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight truncate">{business.name}</p>
          {category && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{category}</p>
          )}
        </div>
        <ScoreBadge score={business.latest_score} className="shrink-0" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={business.contact_status} />
        {business.rating != null && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <StarIcon className="size-3 fill-amber-400 text-amber-400" />
            {business.rating.toFixed(1)}
            {business.user_rating_count != null && (
              <span>({business.user_rating_count.toLocaleString()})</span>
            )}
          </span>
        )}
      </div>
    </button>
  )
}
