import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts'
import type { DailyCost } from '@/hooks/use-costs'
import { formatCurrency } from '@/lib/format'

interface ChartRow {
  date: string
  dateLabel: string
  openai: number
  anthropic: number
  moonshot: number
}

function buildChartData(costs: DailyCost[]): ChartRow[] {
  // Last 30 days, ascending order for chart
  const now = new Date()
  const rows: ChartRow[] = []

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const match = costs.find((c) => c.date === dateStr)

    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    rows.push({
      date: dateStr,
      dateLabel: label,
      openai: Number(match?.openai_cost ?? 0),
      anthropic: Number(match?.anthropic_cost ?? 0),
      moonshot: Number(match?.moonshot_cost ?? 0),
    })
  }

  return rows
}

interface CustomTooltipProps extends TooltipProps<number, string> {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const total = payload.reduce((sum, p) => sum + (p.value ?? 0), 0)

  return (
    <div className="rounded-lg border border-wpa-border bg-parchment px-4 py-3 shadow-md text-sm">
      <p className="font-semibold text-text-primary mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-text-secondary">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            {p.name}
          </span>
          <span className="font-mono text-text-primary">{formatCurrency(p.value ?? 0)}</span>
        </div>
      ))}
      <div className="mt-2 border-t border-wpa-border pt-2 flex items-center justify-between">
        <span className="text-text-secondary">Total</span>
        <span className="font-mono font-semibold text-text-primary">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}

interface CostChartProps {
  costs: DailyCost[]
}

export default function CostChart({ costs }: CostChartProps) {
  const data = buildChartData(costs)

  // Show every 5th label to avoid crowding
  const tickFormatter = (_: string, index: number) => {
    if (index % 5 !== 0) return ''
    return data[index]?.dateLabel ?? ''
  }

  return (
    <div className="w-full" style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="gradOpenAI" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradAnthropic" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#C17F4E" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#C17F4E" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradMoonshot" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5B8C5A" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#5B8C5A" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E0DAD0" vertical={false} />
          <XAxis
            dataKey="dateLabel"
            tickFormatter={tickFormatter}
            tick={{ fontSize: 11, fill: '#7A7A7A' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            tick={{ fontSize: 11, fill: '#7A7A7A' }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="openai"
            name="OpenAI"
            stackId="1"
            stroke="#3B82F6"
            strokeWidth={1.5}
            fill="url(#gradOpenAI)"
          />
          <Area
            type="monotone"
            dataKey="anthropic"
            name="Anthropic"
            stackId="1"
            stroke="#C17F4E"
            strokeWidth={1.5}
            fill="url(#gradAnthropic)"
          />
          <Area
            type="monotone"
            dataKey="moonshot"
            name="Moonshot"
            stackId="1"
            stroke="#5B8C5A"
            strokeWidth={1.5}
            fill="url(#gradMoonshot)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
