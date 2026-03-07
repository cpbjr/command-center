import { useEffect, useState } from 'react'
import { TaskBoard } from '@/components/tasks/TaskBoard'
import { TaskCard } from '@/components/tasks/TaskCard'
import { TaskForm } from '@/components/tasks/TaskForm'
import { useTasks, useGenerateFromTemplates } from '@/hooks/use-tasks'
import type { Task } from '@/hooks/use-tasks'
import { cn } from '@/lib/utils'

export default function TasksPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [view, setView] = useState<'board' | 'byClient'>('board')
  const { data: tasks = [], isLoading, error } = useTasks()
  const generateTemplates = useGenerateFromTemplates()

  useEffect(() => {
    generateTemplates.mutate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAdd() {
    setEditingTask(null)
    setFormOpen(true)
  }

  function handleEdit(task: Task) {
    setEditingTask(task)
    setFormOpen(true)
  }

  function handleFormClose(open: boolean) {
    setFormOpen(open)
    if (!open) setEditingTask(null)
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-baseline gap-5">
          <div className="flex gap-4">
            <button
              onClick={() => setView('board')}
              className={cn(
                'text-sm pb-1 transition-colors',
                view === 'board'
                  ? 'text-pine-mid font-semibold border-b-2 border-pine-mid'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              Board
            </button>
            <button
              onClick={() => setView('byClient')}
              className={cn(
                'text-sm pb-0.5 transition-colors',
                view === 'byClient'
                  ? 'text-pine-mid font-medium border-b border-pine-mid'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              By Client
            </button>
          </div>
        </div>
        <span className="font-mono text-xs text-text-tertiary">{tasks.length} tasks</span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <span className="text-muted-foreground text-sm">Loading tasks…</span>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4">
          <p className="text-sm text-destructive">Failed to load tasks. Check your connection.</p>
        </div>
      )}

      {!isLoading && !error && tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-muted-foreground text-sm">No tasks yet.</p>
          <button
            onClick={handleAdd}
            className="text-sm text-primary underline underline-offset-4 hover:no-underline"
          >
            Create your first task
          </button>
        </div>
      )}

      {!isLoading && !error && tasks.length > 0 && view === 'board' && (
        <TaskBoard tasks={tasks} onAdd={handleAdd} onEdit={handleEdit} />
      )}

      {!isLoading && !error && tasks.length > 0 && view === 'byClient' && (
        <div className="space-y-6">
          {Object.entries(
            tasks.reduce<Record<string, Task[]>>((acc, task) => {
              const key = task.wpa_clients?.name ?? 'Unassigned'
              ;(acc[key] ??= []).push(task)
              return acc
            }, {})
          )
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([clientName, clientTasks]) => (
              <div key={clientName}>
                <h3 className="font-serif text-sm font-bold text-text-secondary mb-1.5 pt-1">
                  {clientName}{' '}
                  <span className="font-sans font-mono font-normal text-xs text-text-tertiary">{clientTasks.length}</span>
                </h3>
                <div>
                  {clientTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onEdit={handleEdit} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      <TaskForm open={formOpen} onOpenChange={handleFormClose} task={editingTask} />
    </div>
  )
}
