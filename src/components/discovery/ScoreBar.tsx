import { cn } from '@/lib/utils'
import { scoreTier } from '@/lib/score'

interface ScoreBarProps {
  score: number | null
  className?: string
}

const BAR_COLORS = {
  low: 'bg-red-500',
  mid: 'bg-amber-500',
  high: 'bg-green-500',
} as const

export function ScoreBar({ score, className }: ScoreBarProps) {
  if (score === null || score === undefined) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <div className="h-1.5 w-16 rounded-full bg-muted" />
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    )
  }

  const pct = Math.min(Math.max((score / 5) * 100, 0), 100)
  const colorClass = BAR_COLORS[scoreTier(score)]

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono tabular-nums text-muted-foreground">{score}/5</span>
    </div>
  )
}
