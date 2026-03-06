import { useState } from 'react'
import { PlusIcon, Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTasks, type Task } from '@/hooks/use-tasks'
import { TaskCard } from './TaskCard'
import { TaskForm } from './TaskForm'

interface ClientTaskListProps {
  clientId: number
  businessId?: string | null
}

export function ClientTaskList({ clientId, businessId }: ClientTaskListProps) {
  // If the client has a linked business, fetch tasks by business_id
  // Otherwise fall back to client_id for legacy clients
  const { data: tasks = [], isLoading } = useTasks(
    undefined,
    businessId ? undefined : clientId,
    businessId || undefined,
  )
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  function handleAdd() {
    setEditingTask(null)
    setFormOpen(true)
  }

  function handleEdit(task: Task) {
    setEditingTask(task)
    setFormOpen(true)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
        <Button size="sm" variant="outline" onClick={handleAdd}>
          <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add Task
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-6">
          <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && tasks.length === 0 && (
        <p className="text-sm text-center text-muted-foreground py-6">No tasks yet.</p>
      )}

      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onEdit={handleEdit} />
      ))}

      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editingTask}
        defaultClientId={clientId}
        defaultBusinessId={businessId || undefined}
      />
    </div>
  )
}
