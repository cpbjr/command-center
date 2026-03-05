import { cn } from '@/lib/utils'

interface ScoreBarProps {
  score: number | null
  className?: string
}

function getBarColor(score: number): string {
  if (score <= 1) return 'bg-red-500'
  if (score <= 3) return 'bg-amber-500'
  return 'bg-green-500'
}

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
  const colorClass = getBarColor(score)

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
