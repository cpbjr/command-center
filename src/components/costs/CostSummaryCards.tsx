import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { CostSummary } from '@/hooks/use-costs'

interface SummaryCardProps {
  label: string
  amount: number
}

function SummaryCard({ label, amount }: SummaryCardProps) {
  return (
    <Card className="gap-3 py-5">
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-pine-deep">
          {label}
        </span>
        <span className="text-2xl font-semibold text-text-primary tabular-nums">
          {formatCurrency(amount)}
        </span>
      </CardContent>
    </Card>
  )
}

interface CostSummaryCardsProps {
  summary: CostSummary
}

export default function CostSummaryCards({ summary }: CostSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <SummaryCard label="Today's Cost" amount={summary.today} />
      <SummaryCard label="This Week" amount={summary.thisWeek} />
      <SummaryCard label="This Month" amount={summary.thisMonth} />
      <SummaryCard label="Rolling 30-Day" amount={summary.rolling30Day} />
    </div>
  )
}
