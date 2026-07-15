import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { STAGE_LABELS, STAGE_BADGE_CLASSES, type LifecycleStage } from '@/lib/lifecycle'

interface StatusBadgeProps {
  stage: LifecycleStage | string | null | undefined
  className?: string
}

export function StatusBadge({ stage, className }: StatusBadgeProps) {
  const key = (stage && stage in STAGE_LABELS ? stage : 'identified') as LifecycleStage
  return (
    <Badge variant="outline" className={cn(STAGE_BADGE_CLASSES[key], className)}>
      {STAGE_LABELS[key]}
    </Badge>
  )
}
