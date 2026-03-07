import { StatusBadge } from './StatusBadge'
import { ScoreBadge } from './ScoreBadge'
import { type Business } from '@/hooks/use-businesses'
import { StarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

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
      className="w-full bg-card p-4 text-left transition-all duration-300 active:bg-accent rounded-[var(--radius-lg)] border border-border-light hover:border-wpa-border hover:shadow-[0_4px_24px_rgba(26,51,40,0.04)] box-border overflow-hidden"
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
        <StatusBadge status={business.contact_status} className="shrink-0 scale-90 origin-top-left" />
        {business.rating != null && (
          <span className={cn(
            'inline-flex items-center gap-1 text-xs text-muted-foreground',
            'flex-1 text-sm truncate min-w-0'
          )}>
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
