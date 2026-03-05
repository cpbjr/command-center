import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Business } from '@/hooks/use-businesses'

interface StatusBadgeProps {
  status: Business['contact_status']
  className?: string
}

const statusConfig: Record<
  Business['contact_status'],
  { label: string; className: string }
> = {
  NEW: {
    label: 'New',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  IDENTIFIED: {
    label: 'Identified',
    className: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  CONTACTED: {
    label: 'Contacted',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  REPLIED: {
    label: 'Replied',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  CLOSED: {
    label: 'Closed',
    className: 'bg-slate-200 text-slate-600 border-slate-300',
  },
  'CLOSED-WON': {
    label: 'Closed-Won',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.NEW
  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  )
}
