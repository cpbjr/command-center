import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useBusinessActivity,
  useAddBusinessActivity,
  type BusinessActivity,
  type BusinessActivityInsert,
} from '@/hooks/use-business-activity'
import type { ActivityType } from '@/hooks/use-client-activity'
import { formatDate } from '@/lib/format'

interface BusinessCommLogWidgetProps {
  businessId: string
}

const ACTIVITY_TYPES: ActivityType[] = ['call', 'email', 'meeting', 'text', 'action', 'note']

const typeBadgeConfig: Record<ActivityType, { label: string; className: string }> = {
  call: { label: 'Call', className: 'bg-green-100 text-green-800 border-green-200' },
  email: { label: 'Email', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  meeting: { label: 'Meeting', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  text: { label: 'Text', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  action: { label: 'Action', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  note: { label: 'Note', className: 'bg-gray-100 text-gray-800 border-gray-200' },
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function BusinessCommLogWidget({ businessId }: BusinessCommLogWidgetProps) {
  const { data: activities = [] } = useBusinessActivity(businessId)
  const addActivity = useAddBusinessActivity()

  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<ActivityType>('note')
  const [summary, setSummary] = useState('')
  const [date, setDate] = useState(todayISO)

  const recent = activities.slice(0, 10)

  function resetForm() {
    setType('note')
    setSummary('')
    setDate(todayISO())
    setShowForm(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!summary.trim()) return

    const payload: BusinessActivityInsert = {
      business_id: businessId,
      type,
      summary: summary.trim(),
      occurred_at: date || todayISO(),
    }

    await addActivity.mutateAsync(payload)
    resetForm()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activity Log</span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setShowForm((v) => !v)}
        >
          + Log Activity
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border p-3 bg-muted/10">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Type</label>
              <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Date</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Summary *</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              placeholder="What happened?"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={resetForm}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={addActivity.isPending}>
              {addActivity.isPending ? 'Saving...' : 'Log'}
            </Button>
          </div>
        </form>
      )}

      {recent.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground italic">No activity logged yet</p>
      )}

      <div className="space-y-1">
        {recent.map((activity: BusinessActivity) => {
          const badge = typeBadgeConfig[activity.type] ?? typeBadgeConfig.note
          return (
            <div
              key={activity.id}
              className="flex items-start gap-2 p-2 rounded-md border bg-card"
            >
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-5 shrink-0 mt-0.5 ${badge.className}`}
              >
                {badge.label}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm line-clamp-2">{activity.summary}</p>
                <span className="text-xs text-muted-foreground">
                  {formatDate(activity.occurred_at)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
