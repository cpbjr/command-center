import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  useGbpAnalytics,
  useGbpAnalyticsPrior,
  useAddGbpAnalytics,
  type GbpAnalytics,
  type GbpAnalyticsInsert,
} from '@/hooks/use-gbp-analytics'

interface AnalyticsWidgetProps {
  clientId: number
  clientName: string
}

type PeriodOption = 'this-week' | 'this-month' | 'last-month'

interface PeriodRange {
  label: string
  periodType: 'week' | 'month'
  periodStart: string
  periodEnd: string
}

function getPeriodRange(option: PeriodOption): PeriodRange {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  if (option === 'this-week') {
    const dow = now.getDay() // 0=Sun
    const mon = new Date(now)
    mon.setDate(now.getDate() - ((dow + 6) % 7))
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    return {
      label: 'This Week',
      periodType: 'week',
      periodStart: toISO(mon),
      periodEnd: toISO(sun),
    }
  }

  if (option === 'this-month') {
    return {
      label: 'This Month',
      periodType: 'month',
      periodStart: toISO(new Date(y, m, 1)),
      periodEnd: toISO(new Date(y, m + 1, 0)),
    }
  }

  // last-month
  return {
    label: 'Last Month',
    periodType: 'month',
    periodStart: toISO(new Date(y, m - 1, 1)),
    periodEnd: toISO(new Date(y, m, 0)),
  }
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function monthLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleString('default', { month: 'long', year: 'numeric' })
}

function delta(current: number | null | undefined, prior: number | null | undefined): number | null {
  if (current == null || prior == null) return null
  return current - prior
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value == null) return null
  if (value === 0) return <span className="text-xs text-muted-foreground ml-1">—</span>
  const positive = value > 0
  return (
    <span className={`text-xs font-medium ml-1 ${positive ? 'text-green-600' : 'text-red-500'}`}>
      {positive ? '↑' : '↓'} {Math.abs(value).toLocaleString()}
    </span>
  )
}

function StatTile({
  label,
  value,
  subtitle,
  deltaValue,
}: {
  label: string
  value: string | number | null
  subtitle?: string | null
  deltaValue?: number | null
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-0.5">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <div className="flex items-baseline gap-1 flex-wrap">
        <span className="text-2xl font-bold">
          {value != null ? value.toLocaleString() : '—'}
        </span>
        {deltaValue !== undefined && <DeltaBadge value={deltaValue ?? null} />}
      </div>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

// ── Inline add-data form ──────────────────────────────────────────────────────

interface AddDataFormProps {
  clientId: number
  periodType: 'week' | 'month'
  periodStart: string
  periodEnd: string
  onSaved: () => void
  onCancel: () => void
}

type FormState = {
  total_searches: string
  direct_searches: string
  discovery_searches: string
  calls: string
  website_clicks: string
  direction_requests: string
  photo_views: string
  review_count: string
  avg_rating: string
  new_reviews: string
  citation_count: string
  notes: string
}

function emptyForm(): FormState {
  return {
    total_searches: '',
    direct_searches: '',
    discovery_searches: '',
    calls: '',
    website_clicks: '',
    direction_requests: '',
    photo_views: '',
    review_count: '',
    avg_rating: '',
    new_reviews: '',
    citation_count: '',
    notes: '',
  }
}

function num(s: string): number | null {
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      {children}
    </div>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  step,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  step?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-0.5">
      <label className="text-xs font-medium">{label}</label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={step ?? '1'}
        min="0"
        placeholder={placeholder ?? '0'}
        className="h-8 text-sm"
      />
    </div>
  )
}

function AddDataForm({ clientId, periodType, periodStart, periodEnd, onSaved, onCancel }: AddDataFormProps) {
  const [form, setForm] = useState<FormState>(emptyForm())
  const addAnalytics = useAddGbpAnalytics()

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload: GbpAnalyticsInsert = {
      client_id: clientId,
      period_type: periodType,
      period_start: periodStart,
      period_end: periodEnd,
      total_searches: num(form.total_searches),
      direct_searches: num(form.direct_searches),
      discovery_searches: num(form.discovery_searches),
      calls: num(form.calls),
      website_clicks: num(form.website_clicks),
      direction_requests: num(form.direction_requests),
      photo_views: num(form.photo_views),
      review_count: num(form.review_count),
      avg_rating: num(form.avg_rating),
      new_reviews: num(form.new_reviews),
      citation_count: num(form.citation_count),
      notes: form.notes.trim() || null,
    }

    await addAnalytics.mutateAsync(payload)
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-4 bg-muted/10 space-y-4 mt-3">
      <FormSection title="Search">
        <div className="grid grid-cols-2 gap-2">
          <LabeledInput label="Total Searches" value={form.total_searches} onChange={(v) => setField('total_searches', v)} />
          <LabeledInput label="Direct Searches" value={form.direct_searches} onChange={(v) => setField('direct_searches', v)} />
        </div>
        <LabeledInput label="Discovery Searches" value={form.discovery_searches} onChange={(v) => setField('discovery_searches', v)} />
      </FormSection>

      <FormSection title="Actions">
        <div className="grid grid-cols-2 gap-2">
          <LabeledInput label="Calls" value={form.calls} onChange={(v) => setField('calls', v)} />
          <LabeledInput label="Website Clicks" value={form.website_clicks} onChange={(v) => setField('website_clicks', v)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <LabeledInput label="Direction Requests" value={form.direction_requests} onChange={(v) => setField('direction_requests', v)} />
          <LabeledInput label="Photo Views" value={form.photo_views} onChange={(v) => setField('photo_views', v)} />
        </div>
      </FormSection>

      <FormSection title="Reviews">
        <div className="grid grid-cols-3 gap-2">
          <LabeledInput label="Review Count" value={form.review_count} onChange={(v) => setField('review_count', v)} />
          <LabeledInput label="Avg Rating" value={form.avg_rating} onChange={(v) => setField('avg_rating', v)} step="0.1" placeholder="4.8" />
          <LabeledInput label="New Reviews" value={form.new_reviews} onChange={(v) => setField('new_reviews', v)} />
        </div>
      </FormSection>

      <FormSection title="Other">
        <LabeledInput label="Citation Count" value={form.citation_count} onChange={(v) => setField('citation_count', v)} />
        <div className="space-y-0.5">
          <label className="text-xs font-medium">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            rows={2}
            placeholder="Optional notes..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
        </div>
      </FormSection>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={addAnalytics.isPending}>
          {addAnalytics.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  )
}

// ── Report generation ─────────────────────────────────────────────────────────

function trendArrow(current: number | null | undefined, prior: number | null | undefined): string {
  const d = delta(current, prior)
  if (d == null) return '—'
  if (d > 0) return '↑'
  if (d < 0) return '↓'
  return '→'
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString()
}

function buildWeeklySnapshot(
  clientName: string,
  periodStart: string,
  current: GbpAnalytics,
  prior: GbpAnalytics | null,
): string {
  return `# ${clientName} -- Week of ${periodStart}
**Tier**: | **Week**:

## Quick Numbers
| Metric | This Week | Last Week | Trend |
|--------|-----------|-----------|-------|
| GBP Views | ${fmt(current.total_searches)} | ${fmt(prior?.total_searches)} | ${trendArrow(current.total_searches, prior?.total_searches)} |
| Calls | ${fmt(current.calls)} | ${fmt(prior?.calls)} | ${trendArrow(current.calls, prior?.calls)} |
| Direction Requests | ${fmt(current.direction_requests)} | ${fmt(prior?.direction_requests)} | ${trendArrow(current.direction_requests, prior?.direction_requests)} |
| Website Clicks | ${fmt(current.website_clicks)} | ${fmt(prior?.website_clicks)} | ${trendArrow(current.website_clicks, prior?.website_clicks)} |
| New Reviews | ${fmt(current.new_reviews)} | ${fmt(prior?.new_reviews)} | ${trendArrow(current.new_reviews, prior?.new_reviews)} |

## What Changed
- ${current.notes ?? ''}

## Next Week
-

## Flags
- `
}

function buildMonthlyReport(
  clientName: string,
  periodStart: string,
  current: GbpAnalytics,
  prior: GbpAnalytics | null,
): string {
  const month = monthLabel(periodStart)
  const priorMonth = prior ? monthLabel(prior.period_start) : 'Prior Month'

  const callsDelta = delta(current.calls, prior?.calls)
  const searchesDelta = delta(current.total_searches, prior?.total_searches)

  const searchSummary = current.total_searches != null
    ? `${fmt(current.total_searches)} people found ${clientName} on Google this month${searchesDelta != null && searchesDelta !== 0 ? `, ${searchesDelta > 0 ? 'up' : 'down'} ${Math.abs(searchesDelta).toLocaleString()} from last month` : ''}.`
    : ''
  const callSummary = current.calls != null
    ? ` Google generated ${fmt(current.calls)} phone call${current.calls !== 1 ? 's' : ''}${callsDelta != null && callsDelta !== 0 ? ` (${callsDelta > 0 ? '+' : ''}${callsDelta} vs prior month)` : ''}.`
    : ''

  return `# ${clientName} -- ${month} Performance Report

## Results This Month

${searchSummary}${callSummary} Direction requests and website visits reflect continued visibility in local search.

### Key Numbers
| Metric | ${month} | ${priorMonth} | Change |
|--------|---------|-------------|--------|
| People who found you on Google | ${fmt(current.total_searches)} | ${fmt(prior?.total_searches)} | ${trendArrow(current.total_searches, prior?.total_searches)} |
| Phone calls from Google | ${fmt(current.calls)} | ${fmt(prior?.calls)} | ${trendArrow(current.calls, prior?.calls)} |
| Direction requests | ${fmt(current.direction_requests)} | ${fmt(prior?.direction_requests)} | ${trendArrow(current.direction_requests, prior?.direction_requests)} |
| Website visits from Google | ${fmt(current.website_clicks)} | ${fmt(prior?.website_clicks)} | ${trendArrow(current.website_clicks, prior?.website_clicks)} |
| New reviews | ${fmt(current.new_reviews)} | ${fmt(prior?.new_reviews)} | ${trendArrow(current.new_reviews, prior?.new_reviews)} |
| Average rating | ${current.avg_rating?.toFixed(1) ?? '—'} | ${prior?.avg_rating?.toFixed(1) ?? '—'} | ${trendArrow(current.avg_rating, prior?.avg_rating)} |

### What I Worked On
-

### What's Next
-

### Recommendation


Cheers,
Christopher
White Pine Agency`
}

// ── Report dialog ─────────────────────────────────────────────────────────────

function ReportDialog({
  open,
  onClose,
  clientName,
  periodStart,
  current,
  prior,
}: {
  open: boolean
  onClose: () => void
  clientName: string
  periodStart: string
  current: GbpAnalytics
  prior: GbpAnalytics | null
}) {
  const [copiedTab, setCopiedTab] = useState<string | null>(null)

  const weekly = buildWeeklySnapshot(clientName, periodStart, current, prior)
  const monthly = buildMonthlyReport(clientName, periodStart, current, prior)

  function copyText(text: string, tab: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedTab(tab)
      setTimeout(() => setCopiedTab(null), 1800)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Generate Report — {clientName}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="weekly" className="flex flex-col flex-1 min-h-0">
          <TabsList className="shrink-0">
            <TabsTrigger value="weekly">Weekly Snapshot</TabsTrigger>
            <TabsTrigger value="monthly">Monthly Report</TabsTrigger>
          </TabsList>
          <TabsContent value="weekly" className="flex-1 flex flex-col gap-2 min-h-0">
            <div className="flex-1 overflow-auto rounded border bg-muted/20 p-3">
              <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">{weekly}</pre>
            </div>
            <div className="flex justify-end shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => copyText(weekly, 'weekly')}
              >
                {copiedTab === 'weekly' ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="monthly" className="flex-1 flex flex-col gap-2 min-h-0">
            <div className="flex-1 overflow-auto rounded border bg-muted/20 p-3">
              <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">{monthly}</pre>
            </div>
            <div className="flex justify-end shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => copyText(monthly, 'monthly')}
              >
                {copiedTab === 'monthly' ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function AnalyticsWidget({ clientId, clientName }: AnalyticsWidgetProps) {
  const [period, setPeriod] = useState<PeriodOption>('this-week')
  const [showForm, setShowForm] = useState(false)
  const [showReport, setShowReport] = useState(false)

  const range = getPeriodRange(period)

  const { data: current, isLoading } = useGbpAnalytics(clientId, range.periodStart, range.periodEnd)
  const { data: prior } = useGbpAnalyticsPrior(clientId, range.periodStart)

  const customerActions =
    (current?.calls ?? 0) + (current?.website_clicks ?? 0) + (current?.direction_requests ?? 0)
  const priorActions =
    (prior?.calls ?? 0) + (prior?.website_clicks ?? 0) + (prior?.direction_requests ?? 0)
  const hasActions = current?.calls != null || current?.website_clicks != null || current?.direction_requests != null
  const hasPriorActions = prior?.calls != null || prior?.website_clicks != null || prior?.direction_requests != null

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-semibold">GBP Analytics</span>
        <Select value={period} onValueChange={(v) => { setPeriod(v as PeriodOption); setShowForm(false) }}>
          <SelectTrigger className="h-7 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this-week">This Week</SelectItem>
            <SelectItem value="this-month">This Month</SelectItem>
            <SelectItem value="last-month">Last Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-xs text-muted-foreground italic">Loading...</p>
      )}

      {/* No data state */}
      {!isLoading && !current && !showForm && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-4">
          <p className="text-sm text-muted-foreground">No data for this period.</p>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowForm(true)}>
            Add Data
          </Button>
        </div>
      )}

      {/* Scorecard */}
      {!isLoading && current && !showForm && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatTile
              label="Total Searches"
              value={current.total_searches}
              deltaValue={delta(current.total_searches, prior?.total_searches)}
            />
            <StatTile
              label="Customer Actions"
              value={hasActions ? customerActions : null}
              deltaValue={hasActions && hasPriorActions ? customerActions - priorActions : null}
            />
            <StatTile
              label="Reviews"
              value={current.review_count}
              subtitle={current.avg_rating != null ? `Avg ${current.avg_rating.toFixed(1)} ★` : null}
              deltaValue={current.new_reviews != null ? current.new_reviews : null}
            />
            <StatTile
              label="Citations"
              value={current.citation_count}
              deltaValue={delta(current.citation_count, prior?.citation_count)}
            />
          </div>

          {/* Add data button when data exists */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => setShowForm(true)}
          >
            + Update Data
          </Button>
        </>
      )}

      {/* Inline form */}
      {showForm && (
        <AddDataForm
          clientId={clientId}
          periodType={range.periodType}
          periodStart={range.periodStart}
          periodEnd={range.periodEnd}
          onSaved={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Generate Report button — only when data exists and form is not showing */}
      {current && !showForm && (
        <div className="pt-1 border-t">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs w-full"
            onClick={() => setShowReport(true)}
          >
            Generate Report
          </Button>
        </div>
      )}

      {/* Report dialog */}
      {showReport && current && (
        <ReportDialog
          open={showReport}
          onClose={() => setShowReport(false)}
          clientName={clientName}
          periodStart={range.periodStart}
          current={current}
          prior={prior ?? null}
        />
      )}
    </div>
  )
}
