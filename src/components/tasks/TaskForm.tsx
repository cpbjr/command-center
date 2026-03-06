import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateTask, useUpdateTask, useDeleteTask } from '@/hooks/use-tasks'
import type { Task, TaskCategory, TaskPriority, TaskStatus } from '@/hooks/use-tasks'
import { useClients } from '@/hooks/use-clients'
import { useBusinessesSimple } from '@/hooks/use-businesses'
import { Badge } from '@/components/ui/badge'
import { XIcon } from 'lucide-react'

interface TaskFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task | null
  defaultClientId?: number
  defaultBusinessId?: string
  defaultProjectId?: number
}

const CATEGORIES: TaskCategory[] = ['Client Work', 'WPA Own', 'Infrastructure', 'Marketing', 'Backlog']
const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]
const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
]

interface FormState {
  title: string
  description: string
  category: TaskCategory
  priority: TaskPriority
  status: TaskStatus
  client_id: string
  business_id: string
  due_date: string
  is_template: boolean
  recurrence_rule: string
  tags: string[]
  tagInput: string
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

const DEFAULT_STATE: FormState = {
  title: '',
  description: '',
  category: 'WPA Own',
  priority: 'medium',
  status: 'todo',
  client_id: '',
  business_id: '',
  due_date: todayIso(),
  is_template: false,
  recurrence_rule: '',
  tags: [],
  tagInput: '',
}

export function TaskForm({ open, onOpenChange, task, defaultClientId, defaultBusinessId, defaultProjectId }: TaskFormProps) {
  const [form, setForm] = useState<FormState>(DEFAULT_STATE)
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const { data: clients = [] } = useClients()
  const { data: businesses = [] } = useBusinessesSimple()

  const isEditing = !!task

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? '',
        category: task.category,
        priority: task.priority,
        status: task.status,
        client_id: task.client_id ? String(task.client_id) : '',
        business_id: task.business_id ?? '',
        due_date: task.due_date ?? '',
        is_template: task.is_template ?? false,
        recurrence_rule: task.recurrence_rule ?? '',
        tags: task.tags ?? [],
        tagInput: '',
      })
    } else {
      setForm({
        ...DEFAULT_STATE,
        due_date: todayIso(),
        client_id: defaultClientId ? String(defaultClientId) : '',
        business_id: defaultBusinessId ?? '',
      })
    }
  }, [task, open, defaultClientId, defaultBusinessId])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      priority: form.priority,
      status: form.status,
      client_id: form.client_id ? Number(form.client_id) : null,
      business_id: form.business_id || null,
      due_date: form.due_date || null,
      is_template: form.is_template,
      recurrence_rule: form.is_template ? form.recurrence_rule || null : null,
      tags: form.tags,
    }

    if (isEditing && task) {
      await updateTask.mutateAsync({ id: task.id, ...payload })
    } else {
      await createTask.mutateAsync({ ...payload, project_id: defaultProjectId ?? null })
    }

    onOpenChange(false)
  }

  const isPending = createTask.isPending || updateTask.isPending || deleteTask.isPending

  function addTag() {
    const tag = form.tagInput.trim().toLowerCase().replace(/^#/, '')
    if (tag && !form.tags.includes(tag)) {
      set('tags', [...form.tags, tag])
    }
    set('tagInput', '')
  }

  function removeTag(tag: string) {
    set('tags', form.tags.filter((t) => t !== tag))
  }

  async function handleDelete() {
    if (!task) return
    await deleteTask.mutateAsync(task.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Title *</label>
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Task title"
              required
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Optional details…"
              rows={3}
              className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Category</label>
              <Select value={form.category} onValueChange={(v) => set('category', v as TaskCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Priority</label>
              <Select value={form.priority} onValueChange={(v) => set('priority', v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Status</label>
              <Select value={form.status} onValueChange={(v) => set('status', v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Client</label>
              <Select
                value={form.client_id}
                onValueChange={(v) => {
                  const val = v === 'none' ? '' : v
                  set('client_id', val)
                  if (val) set('business_id', '')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Lead</label>
            <Select
              value={form.business_id}
              onValueChange={(v) => {
                const val = v === 'none' ? '' : v
                set('business_id', val)
                if (val) set('client_id', '')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Due Date</label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => set('due_date', e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Tags</label>
            <div className="flex gap-2">
              <Input
                value={form.tagInput}
                onChange={(e) => set('tagInput', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addTag() }
                }}
                placeholder="e.g. bobwork, urgent"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {form.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="rounded-full p-0.5 hover:bg-black/10">
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_template"
                checked={form.is_template}
                onChange={(e) => set('is_template', e.target.checked as any)}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="is_template" className="text-sm font-medium">Make Recurring</label>
            </div>
            {form.is_template && (
              <Select value={form.recurrence_rule} onValueChange={(v) => set('recurrence_rule', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly:1">Weekly</SelectItem>
                  <SelectItem value="weekly:2">2x / week</SelectItem>
                  <SelectItem value="weekly:3">3x / week</SelectItem>
                  <SelectItem value="monthly:1">Monthly</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <div>
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isPending}
                  onClick={handleDelete}
                >
                  Delete Task
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">Close</Button>
              </DialogClose>
              <Button type="submit" disabled={isPending || !form.title.trim()}>
                {isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Task'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
