import { cn } from '@/lib/utils'
import { Check, X, ArrowDown, ArrowUp, Minus } from 'lucide-react'
import {
  useLatestBaseline,
} from '@/hooks/use-client-baselines'
import { formatDate } from '@/lib/format'

interface BaselineWidgetProps {
  clientId: number
}

function MetricCell({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: React.ReactNode
  sub?: string
  color?: string
}) {
  return (
    <div className="space-y-0.5">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <p className={cn('text-sm font-semibold', color)}>{value}</p>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  )
}

function lcpColor(lcp: number): string {
  if (lcp < 3) return 'text-green-600'
  if (lcp <= 6) return 'text-yellow-600'
  return 'text-red-600'
}

function TrendArrow({ current, previous }: { current: number; previous?: number | null }) {
  if (previous == null) return <Minus className="h-3 w-3 text-muted-foreground inline ml-1" />
  if (current < previous) return <ArrowDown className="h-3 w-3 text-green-500 inline ml-1" />
  if (current > previous) return <ArrowUp className="h-3 w-3 text-red-500 inline ml-1" />
  return <Minus className="h-3 w-3 text-muted-foreground inline ml-1" />
}

export function BaselineWidget({ clientId }: BaselineWidgetProps) {
  const { data: baseline } = useLatestBaseline(clientId)

  if (!baseline) {
    return (
      <div className="space-y-2">
        <span className="text-sm font-semibold">Baseline Snapshot</span>
        <p className="text-xs text-muted-foreground italic">No baseline recorded</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Baseline Snapshot</span>
        <span className="text-xs text-muted-foreground">
          {formatDate(baseline.snapshot_date)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border bg-card">
        {baseline.gtrack_avg_position != null && (
          <MetricCell
            label="GTrack Avg Position"
            value={
              <>
                {baseline.gtrack_avg_position.toFixed(1)}
                <TrendArrow current={baseline.gtrack_avg_position} />
              </>
            }
          />
        )}

        {baseline.discovery_rank != null && (
          <MetricCell
            label="Discovery Rank"
            value={
              baseline.discovery_total
                ? `#${baseline.discovery_rank} of ${baseline.discovery_total}`
                : `#${baseline.discovery_rank}`
            }
          />
        )}

        {baseline.gbp_rating != null && (
          <MetricCell
            label="GBP Rating"
            value={`${baseline.gbp_rating.toFixed(1)} / 5`}
            sub={
              baseline.gbp_review_count != null
                ? `${baseline.gbp_review_count} review${baseline.gbp_review_count !== 1 ? 's' : ''}`
                : undefined
            }
          />
        )}

        {baseline.mobile_lcp_seconds != null && (
          <MetricCell
            label="Mobile LCP"
            value={`${baseline.mobile_lcp_seconds.toFixed(1)}s`}
            color={lcpColor(baseline.mobile_lcp_seconds)}
          />
        )}

        {baseline.has_schema != null && (
          <MetricCell
            label="Schema"
            value={
              baseline.has_schema ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <X className="h-4 w-4 text-red-500" />
              )
            }
          />
        )}
      </div>
    </div>
  )
}
