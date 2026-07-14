import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TaskColumn } from './TaskColumn'
import type { Task, TaskStatus, TaskCategory, TaskAssignee } from '@/hooks/use-tasks'
import { cn } from '@/lib/utils'

interface TaskBoardProps {
  tasks: Task[]
  onAdd: () => void
  onEdit: (task: Task) => void
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'blocked', label: 'Blocked' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' },
]

const CATEGORIES: TaskCategory[] = ['Client Work', 'WPA Own', 'Infrastructure', 'Marketing', 'Backlog']

const ASSIGNEE_FILTERS: { value: TaskAssignee | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'human', label: 'Mine' },
  { value: 'bob', label: 'Bob' },
]

export function TaskBoard({ tasks, onAdd, onEdit }: TaskBoardProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<TaskAssignee | 'all'>('all')

  const filtered = tasks.filter((t) =>
    (categoryFilter === 'all' || t.category === categoryFilter) &&
    (assigneeFilter === 'all' || t.assigned_to === assigneeFilter)
  )

  function tasksForStatus(status: TaskStatus) {
    return filtered.filter((t) => t.status === status)
  }

  return (
    <div className="relative flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Assignee filter */}
          <div className="flex items-center rounded-md border border-wpa-border/60 p-0.5">
            {ASSIGNEE_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setAssigneeFilter(value)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-sm transition-colors',
                  assigneeFilter === value
                    ? 'bg-pine-mid text-warmwhite font-medium'
                    : 'text-text-tertiary hover:text-text-secondary'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Button size="sm" onClick={onAdd} className="hidden sm:flex gap-1.5">
          <PlusIcon className="size-4" />
          Add Task
        </Button>
      </div>

      {/* Desktop: 5-column board */}
      <div className="hidden sm:grid grid-cols-5 gap-4 pb-4">
        {COLUMNS.map(({ status, label }) => (
          <TaskColumn
            key={status}
            status={status}
            label={label}
            tasks={tasksForStatus(status)}
            onEdit={onEdit}
          />
        ))}
      </div>

      {/* Mobile: Tabs */}
      <div className="sm:hidden flex-1 min-w-0 overflow-hidden w-full">
        <Tabs defaultValue="todo" className="w-full">
          <TabsList className="w-full flex overflow-x-auto scrollbar-hide h-auto justify-start p-1 touch-pan-x">
            {COLUMNS.map(({ status, label }) => (
              <TabsTrigger key={status} value={status} className="text-xs px-2.5 py-1.5 whitespace-nowrap shrink-0">
                {label}
                <span className="ml-1 opacity-60 text-[10px]">
                  ({tasksForStatus(status).length})
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          {COLUMNS.map(({ status, label }) => (
            <TabsContent key={status} value={status} className="mt-3">
              <TaskColumn
                status={status}
                label={label}
                tasks={tasksForStatus(status)}
                onEdit={onEdit}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Mobile FAB */}
      <button
        onClick={onAdd}
        className="sm:hidden fixed bottom-6 right-6 z-10 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-transform"
        aria-label="Add task"
      >
        <PlusIcon className="size-6" />
      </button>
    </div>
  )
}
