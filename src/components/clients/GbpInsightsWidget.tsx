import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useGbpInsights,
  useUpsertGbpInsight,
  type GbpInsight,
  type GbpInsightInsert,
} from '@/hooks/use-gbp-insights'
import { formatDate } from '@/lib/format'

interface GbpInsightsWidgetProps {
  clientId: number
}

/** Returns the most recent Friday (or today if Friday) in YYYY-MM-DD format */
function lastFridayISO(): string {
  const d = new Date()
  const day = d.getDay() // 0=Sun … 6=Sat
  const daysBack = day === 5 ? 0 : ((day + 2) % 7)
  d.setDate(d.getDate() - daysBack)
  return d.toISOString().slice(0, 10)
}

type MetricField = {
  key: keyof GbpInsightInsert
  label: string
  placeholder: string
}

const METRIC_FIELDS: MetricField[] = [
  { key: 'search_views', label: 'Search views', placeholder: '0' },
  { key: 'maps_views', label: 'Maps views', placeholder: '0' },
  { key: 'profile_views', label: 'Profile views', placeholder: '0' },
  { key: 'website_clicks', label: 'Website clicks', placeholder: '0' },
  { key: 'phone_calls', label: 'Phone calls', placeholder: '0' },
  { key: 'direction_requests', label: 'Directions', placeholder: '0' },
  { key: 'photo_views', label: 'Photo views', placeholder: '0' },
  { key: 'message_count', label: 'Messages', placeholder: '0' },
]

type MetricValues = Record<string, string>

function emptyMetrics(): MetricValues {
  return Object.fromEntries(METRIC_FIELDS.map((f) => [f.key, '']))
}

function deltaArrow(curr: number | null, prev: number | null): string {
  if (curr == null || prev == null) return ''
  if (curr > prev) return ' ▲'
  if (curr < prev) return ' ▼'
  return ' —'
}

function deltaClass(curr: number | null, prev: number | null): string {
  if (curr == null || prev == null) return 'text-muted-foreground'
  if (curr > prev) return 'text-green-600 dark:text-green-400'
  if (curr < prev) return 'text-red-500 dark:text-red-400'
  return 'text-muted-foreground'
}

export function GbpInsightsWidget({ clientId }: GbpInsightsWidgetProps) {
  const { data: insights = [] } = useGbpInsights(clientId)
  const upsert = useUpsertGbpInsight()

  const [showForm, setShowForm] = useState(false)
  const [weekEnding, setWeekEnding] = useState(lastFridayISO)
  const [metrics, setMetrics] = useState<MetricValues>(emptyMetrics)
  const [notes, setNotes] = useState('')

  const recentFour = insights.slice(0, 4)

  function resetForm() {
    setWeekEnding(lastFridayISO())
    setMetrics(emptyMetrics())
    setNotes('')
    setShowForm(false)
  }

  function setMetric(key: string, value: string) {
    setMetrics((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload: GbpInsightInsert = {
      client_id: clientId,
      week_ending: weekEnding || lastFridayISO(),
      search_views: metrics.search_views !== '' ? parseInt(metrics.search_views) : null,
      maps_views: metrics.maps_views !== '' ? parseInt(metrics.maps_views) : null,
      profile_views: metrics.profile_views !== '' ? parseInt(metrics.profile_views) : null,
      website_clicks: metrics.website_clicks !== '' ? parseInt(metrics.website_clicks) : null,
      phone_calls: metrics.phone_calls !== '' ? parseInt(metrics.phone_calls) : null,
      direction_requests: metrics.direction_requests !== '' ? parseInt(metrics.direction_requests) : null,
      photo_views: metrics.photo_views !== '' ? parseInt(metrics.photo_views) : null,
      message_count: metrics.message_count !== '' ? parseInt(metrics.message_count) : null,
      notes: notes.trim() || null,
    }

    await upsert.mutateAsync(payload)
    resetForm()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">GBP Insights</span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setShowForm((v) => !v)}
        >
          + Enter Week
        </Button>
      </div>

      {insights.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground italic">No insights recorded</p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-3 bg-muted/10">
          <div className="space-y-1">
            <label className="text-xs font-medium">Week ending (Friday)</label>
            <Input
              type="date"
              value={weekEnding}
              onChange={(e) => setWeekEnding(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {METRIC_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="text-xs font-medium">{f.label}</label>
                <Input
                  type="number"
                  min="0"
                  value={metrics[f.key]}
                  onChange={(e) => setMetric(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[60px] resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={resetForm}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={upsert.isPending}>
              {upsert.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      )}

      {recentFour.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Last 4 weeks</span>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-1 pr-2 font-medium">Week</th>
                  <th className="text-right py-1 px-1 font-medium">Search</th>
                  <th className="text-right py-1 px-1 font-medium">Maps</th>
                  <th className="text-right py-1 px-1 font-medium">Clicks</th>
                  <th className="text-right py-1 px-1 font-medium">Calls</th>
                </tr>
              </thead>
              <tbody>
                {recentFour.map((row: GbpInsight, i: number) => {
                  const prev = recentFour[i + 1] ?? null
                  return (
                    <tr key={row.id} className="border-b border-muted/40">
                      <td className="py-1 pr-2 font-mono">{formatDate(row.week_ending)}</td>
                      <td className={`text-right py-1 px-1 tabular-nums ${deltaClass(row.search_views, prev?.search_views ?? null)}`}>
                        {row.search_views ?? '—'}{deltaArrow(row.search_views, prev?.search_views ?? null)}
                      </td>
                      <td className={`text-right py-1 px-1 tabular-nums ${deltaClass(row.maps_views, prev?.maps_views ?? null)}`}>
                        {row.maps_views ?? '—'}{deltaArrow(row.maps_views, prev?.maps_views ?? null)}
                      </td>
                      <td className={`text-right py-1 px-1 tabular-nums ${deltaClass(row.website_clicks, prev?.website_clicks ?? null)}`}>
                        {row.website_clicks ?? '—'}{deltaArrow(row.website_clicks, prev?.website_clicks ?? null)}
                      </td>
                      <td className={`text-right py-1 px-1 tabular-nums ${deltaClass(row.phone_calls, prev?.phone_calls ?? null)}`}>
                        {row.phone_calls ?? '—'}{deltaArrow(row.phone_calls, prev?.phone_calls ?? null)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
