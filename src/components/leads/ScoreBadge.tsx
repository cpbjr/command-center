import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { scoreTier } from '@/lib/score'

interface ScoreBadgeProps {
  score: number | null
  className?: string
}

const BADGE_COLORS = {
  low: 'bg-red-100 text-red-700 border-red-200',
  mid: 'bg-amber-100 text-amber-700 border-amber-200',
  high: 'bg-green-100 text-green-700 border-green-200',
} as const

function getScoreConfig(score: number | null): { label: string; className: string } {
  if (score === null || score === undefined) {
    return { label: 'N/A', className: 'bg-gray-100 text-gray-500 border-gray-200' }
  }
  return { label: String(score), className: BADGE_COLORS[scoreTier(score)] }
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  const config = getScoreConfig(score)
  return (
    <Badge
      variant="outline"
      className={cn('font-mono font-semibold', config.className, className)}
    >
      {config.label}
    </Badge>
  )
}
