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
import type { Task, TaskStatus, TaskCategory } from '@/hooks/use-tasks'

interface TaskBoardProps {
  tasks: Task[]
  onAdd: () => void
  onEdit: (task: Task) => void
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'blocked', label: 'Blocked' },
  { status: 'done', label: 'Done' },
]

const CATEGORIES: TaskCategory[] = ['Client Work', 'WPA Own', 'Infrastructure', 'Marketing', 'Backlog']

export function TaskBoard({ tasks, onAdd, onEdit }: TaskBoardProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const filtered = categoryFilter === 'all'
    ? tasks
    : tasks.filter((t) => t.category === categoryFilter)

  function tasksForStatus(status: TaskStatus) {
    return filtered.filter((t) => t.status === status)
  }

  return (
    <div className="relative flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
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

        <Button size="sm" onClick={onAdd} className="hidden sm:flex gap-1.5">
          <PlusIcon className="size-4" />
          Add Task
        </Button>
      </div>

      {/* Desktop: 4-column board */}
      <div className="hidden sm:grid grid-cols-4 gap-4 pb-4">
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
      <div className="sm:hidden flex-1">
        <Tabs defaultValue="todo">
          <TabsList className="w-full grid grid-cols-4 h-auto">
            {COLUMNS.map(({ status, label }) => (
              <TabsTrigger key={status} value={status} className="text-xs px-1">
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
