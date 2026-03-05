import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useGbpScores,
  useAddGbpScore,
  type GbpScore,
  type GbpScoreInsert,
} from '@/hooks/use-gbp-scores'
import { formatDate } from '@/lib/format'

interface GbpScoreWidgetProps {
  clientId: number
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function GbpScoreWidget({ clientId }: GbpScoreWidgetProps) {
  const { data: scores = [] } = useGbpScores(clientId)
  const addScore = useAddGbpScore()

  const [showForm, setShowForm] = useState(false)
  const [score, setScore] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(todayISO)

  const latest = scores[0] ?? null
  const recentFive = scores.slice(0, 5)

  function resetForm() {
    setScore('')
    setNotes('')
    setDate(todayISO())
    setShowForm(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const val = parseFloat(score)
    if (isNaN(val) || val < 0 || val > 10) return

    const payload: GbpScoreInsert = {
      client_id: clientId,
      score: val,
      notes: notes.trim() || null,
      recorded_at: date || todayISO(),
    }

    await addScore.mutateAsync(payload)
    resetForm()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">GBP Score</span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setShowForm((v) => !v)}
        >
          + Record Score
        </Button>
      </div>

      {latest ? (
        <div className="text-center py-2">
          <span className="text-4xl font-bold text-text-primary">
            {latest.score.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground ml-1">/10</span>
          <p className="text-xs text-muted-foreground mt-1">
            Last recorded {formatDate(latest.recorded_at)}
          </p>
        </div>
      ) : (
        !showForm && (
          <p className="text-xs text-muted-foreground italic">No scores recorded</p>
        )
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border p-3 bg-muted/10">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Score (0-10) *</label>
              <Input
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                min="0"
                max="10"
                step="0.1"
                placeholder="7.5"
                className="h-8 text-sm"
                required
              />
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
            <label className="text-xs font-medium">Notes</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              className="h-8 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={resetForm}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={addScore.isPending}>
              {addScore.isPending ? 'Saving...' : 'Record'}
            </Button>
          </div>
        </form>
      )}

      {recentFive.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">History</span>
          {recentFive.map((s: GbpScore) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-1.5 rounded border bg-card text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium">{s.score.toFixed(1)}</span>
                {s.notes && (
                  <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                    {s.notes}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatDate(s.recorded_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
