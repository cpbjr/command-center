import { Bot } from 'lucide-react'
import { useUpdateTask } from '@/hooks/use-tasks'
import type { Task, TaskStatus } from '@/hooks/use-tasks'
import { cn } from '@/lib/utils'

interface TaskCardProps {
  task: Task
  onEdit?: (task: Task) => void
}

// ── Priority left-accent strip colors (WPA earth palette) ─────────────────
const PRIORITY_ACCENT: Record<string, string> = {
  urgent: 'bg-bark',        // #6B4E3D — serious without generic red
  high:   'bg-pine-forest', // #24453A — deeper pine, secondary to urgent
  medium: 'bg-pine-mid',    // #355E4C — brand default
  low:    'bg-sand',        // #C4B5A3 — recedes visually
}

// ── Priority → title typography weight ────────────────────────────────────
const PRIORITY_TITLE_STYLE: Record<string, string> = {
  urgent: 'font-semibold text-text-primary',
  high:   'font-medium text-text-primary',
  medium: 'font-normal text-text-primary',
  low:    'font-normal text-text-secondary',
}

// ── Category short labels for mono metadata treatment ─────────────────────
const CATEGORY_MONO: Record<string, string> = {
  'Client Work':    'CLIENT',
  'WPA Own':        'WPA',
  'Marketing':      'MKTG',
  'Infrastructure': 'INFRA',
  'Backlog':        'BACKLOG',
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo',        label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked',     label: 'Blocked' },
  { value: 'review',      label: 'Review' },
  { value: 'done',        label: 'Done' },
]

function isOverdue(dueDateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr)
  due.setHours(0, 0, 0, 0)
  return due < today
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TaskCard({ task, onEdit }: TaskCardProps) {
  const updateTask = useUpdateTask()

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation()
    updateTask.mutate({ id: task.id, status: e.target.value as TaskStatus })
  }

  const overdue = task.due_date && task.status !== 'done' && isOverdue(task.due_date)
  const accentClass = task.status === 'blocked'
    ? 'bg-bark'
    : PRIORITY_ACCENT[task.priority] ?? 'bg-sand'

  // ── Desktop card (sm+) ────────────────────────────────────────────────────
  const desktopCard = (
    <div
      className={cn(
        'hidden sm:flex items-stretch gap-0 cursor-pointer',
        'border-b border-wpa-border/40',
        'hover:bg-cream/60 transition-colors duration-100',
        task.status === 'done' && 'opacity-55',
      )}
      onClick={() => onEdit?.(task)}
    >
      {/* Left accent strip */}
      <div className={cn('w-[3px] shrink-0 self-stretch', accentClass)} />

      {/* Card body */}
      <div className="flex flex-col gap-1 px-3 py-2.5 min-w-0 flex-1">
        {/* Title */}
        <span className={cn(
          'text-sm leading-snug line-clamp-2',
          task.status === 'done'
            ? 'line-through text-text-tertiary font-normal'
            : task.status === 'blocked'
              ? 'text-bark font-medium'
              : PRIORITY_TITLE_STYLE[task.priority] ?? 'font-normal text-text-primary',
        )}>
          {task.title}
        </span>

        {/* Metadata row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category — mono uppercase */}
          <span className="font-mono text-[10px] tracking-wider text-text-tertiary uppercase">
            {CATEGORY_MONO[task.category] ?? task.category}
          </span>

          {/* Bob assignment badge */}
          {task.assigned_to === 'bob' && (
            <span
              className="flex items-center gap-0.5 font-mono text-[10px] tracking-wider text-pine-forest uppercase"
              title="Assigned to Bob"
            >
              <Bot className="h-3 w-3" />
              bob
            </span>
          )}

          {/* Client name */}
          {task.wpa_contracts?.wpa_businesses?.name && (
            <>
              <span className="text-wpa-border text-[10px]">·</span>
              <span className="text-[11px] italic text-text-secondary">
                {task.wpa_contracts.wpa_businesses!.name}
              </span>
            </>
          )}

          {/* Blocked label */}
          {task.status === 'blocked' && (
            <>
              <span className="text-wpa-border text-[10px]">·</span>
              <span className="font-mono text-[10px] tracking-wider text-bark uppercase">
                blocked
              </span>
            </>
          )}

          {/* Due date — right-aligned */}
          {task.due_date && (
            <span className={cn(
              'ml-auto font-mono text-[11px]',
              overdue ? 'text-bark font-medium' : 'text-text-tertiary',
            )}>
              {overdue ? '! ' : ''}{formatDate(task.due_date)}
            </span>
          )}

          {/* Status — native select, minimal styling, stop propagation */}
          <div
            className={cn('shrink-0', !task.due_date && 'ml-auto')}
            onClick={(e) => e.stopPropagation()}
          >
            <select
              value={task.status}
              onChange={handleStatusChange}
              className="appearance-none bg-transparent border-none font-mono text-[11px] text-text-tertiary cursor-pointer hover:text-text-secondary outline-none py-0 pl-0 pr-0"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Mobile row (< sm) ─────────────────────────────────────────────────────
  const mobileRow = (
    <div
      className="sm:hidden flex items-stretch gap-2.5 py-2.5 px-2 border-b border-wpa-border/40 cursor-pointer active:bg-cream/70 transition-colors min-w-0 w-full"
      onClick={() => onEdit?.(task)}
    >
      {/* Thin vertical priority strip */}
      <div className={cn('w-0.5 shrink-0 self-stretch rounded-full', accentClass)} />

      {/* Title */}
      <span className={cn(
        'flex-1 text-sm truncate min-w-0',
        task.status === 'done' && 'line-through text-text-tertiary',
        task.status === 'blocked' && 'text-bark',
        task.status !== 'done' && task.status !== 'blocked' && (PRIORITY_TITLE_STYLE[task.priority] ?? 'font-normal text-text-primary'),
      )}>
        {task.title}
      </span>

      {/* Bob assignment badge */}
      {task.assigned_to === 'bob' && (
        <Bot className="h-3 w-3 shrink-0 self-center text-pine-forest" aria-label="Assigned to Bob" />
      )}

      {/* Category — mono text, no chip */}
      <span className="shrink-0 font-mono text-[10px] tracking-wider text-text-tertiary uppercase self-center">
        {CATEGORY_MONO[task.category] ?? task.category}
      </span>

      {/* Due date */}
      {task.due_date && (
        <span className={cn(
          'shrink-0 font-mono text-[11px] self-center',
          overdue ? 'text-bark font-medium' : 'text-text-tertiary',
        )}>
          {formatDate(task.due_date)}
        </span>
      )}
    </div>
  )

  return (
    <>
      {desktopCard}
      {mobileRow}
    </>
  )
}
