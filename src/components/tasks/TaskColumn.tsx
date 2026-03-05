import { TaskCard } from './TaskCard'
import type { Task, TaskStatus } from '@/hooks/use-tasks'
import { cn } from '@/lib/utils'

interface TaskColumnProps {
  status: TaskStatus
  label: string
  tasks: Task[]
  onEdit: (task: Task) => void
}

const COLUMN_CONFIG: Record<TaskStatus, {
  topBorder: string
  labelColor: string
  bg: string
  countColor: string
}> = {
  todo: {
    topBorder: 'border-t-2 border-pine-mid',
    labelColor: 'text-pine-mid',
    bg: 'bg-warmwhite',
    countColor: 'text-pine-mid/60',
  },
  in_progress: {
    topBorder: 'border-t-2 border-pine-forest',
    labelColor: 'text-pine-forest',
    bg: 'bg-pine-forest/[0.04]',
    countColor: 'text-pine-forest/60',
  },
  blocked: {
    topBorder: 'border-t-2 border-bark',
    labelColor: 'text-bark',
    bg: 'bg-bark/[0.04]',
    countColor: 'text-bark/60',
  },
  done: {
    topBorder: 'border-t border-stone',
    labelColor: 'text-stone',
    bg: 'bg-transparent',
    countColor: 'text-stone/60',
  },
}

export function TaskColumn({ status, label, tasks, onEdit }: TaskColumnProps) {
  const config = COLUMN_CONFIG[status]

  return (
    <div className={cn('flex flex-col min-w-0 rounded-sm', config.bg, config.topBorder)}>
      {/* Column header */}
      <div className="flex items-baseline justify-between px-3 pt-2.5 pb-2">
        <span className={cn('text-label-serif', config.labelColor)}>
          {label}
        </span>
        <span className={cn('font-mono text-xs', config.countColor)}>
          {tasks.length}
        </span>
      </div>

      {/* Task list */}
      <div className="flex flex-col pb-2">
        {tasks.length === 0 ? (
          <div className="px-3 py-5 text-center">
            <p className="font-mono text-[10px] tracking-wide text-text-tertiary">empty</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={onEdit} />
          ))
        )}
      </div>
    </div>
  )
}
