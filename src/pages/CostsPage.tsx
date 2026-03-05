import { useCostSummary } from '@/hooks/use-costs'
import CostSummaryCards from '@/components/costs/CostSummaryCards'
import CostChart from '@/components/costs/CostChart'
import CostBreakdownTable from '@/components/costs/CostBreakdownTable'

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-muted" />
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-lg font-medium text-text-secondary">No cost data yet.</p>
      <p className="mt-1 text-sm text-text-tertiary">
        Run the sync script to populate the <code className="font-mono">daily_costs</code> table.
      </p>
    </div>
  )
}

export default function CostsPage() {
  const { summary, costs, isLoading, isError } = useCostSummary()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-text-primary">AI Cost Tracker</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Daily spend across OpenAI, Anthropic, and Moonshot.
        </p>
      </div>

      {isLoading && <LoadingSkeleton />}

      {isError && (
        <p className="text-sm text-destructive">
          Failed to load cost data. Check your Supabase connection.
        </p>
      )}

      {!isLoading && !isError && (!costs || costs.length === 0) && <EmptyState />}

      {!isLoading && !isError && costs && costs.length > 0 && (
        <>
          <CostSummaryCards summary={summary} />

          <div className="rounded-xl border border-wpa-border bg-card p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-pine-deep">
              30-Day Trend
            </h3>
            <CostChart costs={costs} />
          </div>

          <div className="rounded-xl border border-wpa-border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-wpa-border">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-pine-deep">
                Recent Breakdown
              </h3>
            </div>
            <CostBreakdownTable costs={costs} />
          </div>
        </>
      )}
    </div>
  )
}
