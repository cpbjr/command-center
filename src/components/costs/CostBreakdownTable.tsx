import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/format'
import type { DailyCost } from '@/hooks/use-costs'

interface CostBreakdownTableProps {
  costs: DailyCost[]
}

export default function CostBreakdownTable({ costs }: CostBreakdownTableProps) {
  // Newest first, last 30 entries
  const rows = costs.slice(0, 30)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">OpenAI</TableHead>
          <TableHead className="text-right">Anthropic</TableHead>
          <TableHead className="text-right">Moonshot</TableHead>
          <TableHead className="text-right font-semibold">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="text-text-secondary">{formatDate(row.date)}</TableCell>
            <TableCell className="text-right font-mono text-sm">
              {row.openai_cost != null ? formatCurrency(Number(row.openai_cost)) : '—'}
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {row.anthropic_cost != null ? formatCurrency(Number(row.anthropic_cost)) : '—'}
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {row.moonshot_cost != null ? formatCurrency(Number(row.moonshot_cost)) : '—'}
            </TableCell>
            <TableCell className="text-right font-mono text-sm font-semibold text-text-primary">
              {row.total_cost != null ? formatCurrency(Number(row.total_cost)) : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
