import { useEffect, useState, useRef } from 'react'
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
import type { Task, TaskAssignee, TaskCategory, TaskPriority, TaskStatus } from '@/hooks/use-tasks'
import { useTaskEvents, useAddTaskEvent } from '@/hooks/use-task-events'
import { useContracts } from '@/hooks/use-contracts'
import { useBusinessesSimple } from '@/hooks/use-businesses'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { XIcon, ChevronsUpDownIcon, CheckIcon, Bot, UserIcon } from 'lucide-react'

interface TaskFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task | null
  defaultContractId?: number
  defaultBusinessId?: string
  defaultBusinessName?: string
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
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
]

interface FormState {
  title: string
  description: string
  category: TaskCategory
  priority: TaskPriority
  status: TaskStatus
  contract_id: string
  business_id: string
  due_date: string
  completed_at: string
  is_template: boolean
  recurrence_rule: string
  tags: string[]
  tagInput: string
  assigned_to: TaskAssignee
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
  contract_id: '',
  business_id: '',
  due_date: todayIso(),
  completed_at: '',
  is_template: false,
  recurrence_rule: '',
  tags: [],
  tagInput: '',
  assigned_to: 'human',
}

export function TaskForm({ open, onOpenChange, task, defaultContractId, defaultBusinessId, defaultBusinessName, defaultProjectId }: TaskFormProps) {
  const [form, setForm] = useState<FormState>(DEFAULT_STATE)
  const [leadSearch, setLeadSearch] = useState('')
  const [debouncedLeadSearch, setDebouncedLeadSearch] = useState('')
  const [leadOpen, setLeadOpen] = useState(false)
  // Remembers the name of the currently-selected lead so the trigger label stays
  // correct even when the server-side search list no longer contains that row.
  const [selectedLeadName, setSelectedLeadName] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const leadRef = useRef<HTMLDivElement>(null)
  const leadSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const { data: clients = [] } = useContracts()
  const { data: businesses = [], isLoading: businessesLoading } = useBusinessesSimple(debouncedLeadSearch)
  const { data: events = [] } = useTaskEvents(task?.id ?? null)
  const addEvent = useAddTaskEvent()

  const isEditing = !!task

  function handleAddComment() {
    const body = comment.trim()
    if (!task || !body) return
    addEvent.mutate({ task_id: task.id, body }, { onSuccess: () => setComment('') })
  }

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? '',
        category: task.category,
        priority: task.priority,
        status: task.status,
        contract_id: task.contract_id ? String(task.contract_id) : '',
        business_id: task.business_id ?? '',
        due_date: task.due_date ?? '',
        completed_at: task.completed_at ? task.completed_at.slice(0, 10) : '',
        is_template: task.is_template ?? false,
        recurrence_rule: task.recurrence_rule ?? '',
        tags: task.tags ?? [],
        tagInput: '',
        assigned_to: task.assigned_to ?? 'human',
      })
      setSelectedLeadName(task.wpa_businesses?.name ?? defaultBusinessName ?? null)
    } else {
      setForm({
        ...DEFAULT_STATE,
        due_date: todayIso(),
        contract_id: defaultContractId ? String(defaultContractId) : '',
        business_id: defaultBusinessId ?? '',
      })
      setSelectedLeadName(defaultBusinessId ? (defaultBusinessName ?? null) : null)
    }
    setLeadSearch('')
    setLeadOpen(false)
  }, [task, open, defaultContractId, defaultBusinessId, defaultBusinessName])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (leadRef.current && !leadRef.current.contains(e.target as Node)) {
        setLeadOpen(false)
      }
    }
    if (leadOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [leadOpen])

  useEffect(() => {
    if (leadSearchDebounceRef.current) clearTimeout(leadSearchDebounceRef.current)
    leadSearchDebounceRef.current = setTimeout(() => {
      setDebouncedLeadSearch(leadSearch)
    }, 300)
    return () => {
      if (leadSearchDebounceRef.current) clearTimeout(leadSearchDebounceRef.current)
    }
  }, [leadSearch])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Transition window: Bob's live skill still polls the 'bobwork' tag, so
    // keep the tag in sync with assigned_to until the skill reads assigned_to.
    const tags = form.assigned_to === 'bob'
      ? Array.from(new Set([...form.tags, 'bobwork']))
      : form.tags.filter((t) => t !== 'bobwork')

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      priority: form.priority,
      status: form.status,
      contract_id: form.contract_id ? Number(form.contract_id) : null,
      business_id: form.business_id || null,
      due_date: form.due_date || null,
      is_template: form.is_template,
      recurrence_rule: form.is_template ? form.recurrence_rule || null : null,
      tags,
      assigned_to: form.assigned_to,
      completed_at: form.status === 'done' && form.completed_at
        ? new Date(form.completed_at + 'T12:00:00').toISOString()
        : null,
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
              <Select
                value={form.status}
                onValueChange={(v) => {
                  const newStatus = v as TaskStatus
                  set('status', newStatus)
                  if (newStatus === 'done' && !form.completed_at) {
                    set('completed_at', todayIso())
                  } else if (newStatus !== 'done') {
                    set('completed_at', '')
                  }
                }}
              >
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
                value={form.contract_id}
                onValueChange={(v) => {
                  const val = v === 'none' ? '' : v
                  set('contract_id', val)
                  if (val) set('business_id', '')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.wpa_businesses?.name ?? c.business_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Assign to</label>
            <div className="flex w-fit items-center rounded-md border border-input p-0.5">
              {([
                { value: 'human', label: 'Me', icon: UserIcon },
                { value: 'bob', label: 'Bob', icon: Bot },
              ] as const).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set('assigned_to', value)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-sm transition-colors',
                    form.assigned_to === value
                      ? 'bg-pine-mid text-warmwhite font-medium'
                      : 'text-text-tertiary hover:text-text-secondary'
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>
            {form.assigned_to === 'bob' && (
              <p className="text-xs text-muted-foreground">
                Bob picks this up on his next run and moves it to Review when finished.
              </p>
            )}
          </div>

          <div className="grid gap-1.5" ref={leadRef}>
            <label className="text-sm font-medium">Lead</label>
            <div className="relative">
              <button
                type="button"
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
                onClick={() => { setLeadOpen(v => !v); setLeadSearch('') }}
              >
                <span className={form.business_id ? '' : 'text-muted-foreground'}>
                  {form.business_id
                    ? (selectedLeadName
                        ?? businesses.find(b => b.id === form.business_id)?.name
                        ?? defaultBusinessName
                        ?? 'Loading…')
                    : 'None'}
                </span>
                <ChevronsUpDownIcon className="size-4 opacity-50 shrink-0" />
              </button>

              {leadOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
                  <div className="p-1.5 border-b">
                    <Input
                      autoFocus
                      placeholder="Search leads…"
                      value={leadSearch}
                      onChange={e => setLeadSearch(e.target.value)}
                      className="h-7 text-sm"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto py-1">
                    {businessesLoading ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Loading…</p>
                    ) : (
                        <>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                          onClick={() => { set('business_id', ''); setSelectedLeadName(null); setLeadOpen(false) }}
                        >
                          {!form.business_id && <CheckIcon className="size-3.5" />}
                          <span className={!form.business_id ? 'ml-0' : 'ml-5'}>None</span>
                        </button>
                        {businesses.map(b => (
                          <button
                            key={b.id}
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                              set('business_id', b.id)
                              set('contract_id', '')
                              setSelectedLeadName(b.name)
                              setLeadOpen(false)
                            }}
                          >
                            {form.business_id === b.id
                              ? <CheckIcon className="size-3.5 shrink-0" />
                              : <span className="size-3.5 shrink-0" />}
                            <span className="truncate">{b.name}</span>
                          </button>
                        ))}
                        {businesses.length === 0 && (
                          <p className="px-3 py-2 text-sm text-muted-foreground">
                            {leadSearch ? 'No results' : 'Type to search leads'}
                          </p>
                        )}
                        </>
                      )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={form.status === 'done' ? 'grid grid-cols-2 gap-3' : ''}>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Due Date</label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => set('due_date', e.target.value)}
              />
            </div>

            {form.status === 'done' && (
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Completed Date</label>
                <Input
                  type="date"
                  value={form.completed_at}
                  onChange={(e) => set('completed_at', e.target.value)}
                />
              </div>
            )}
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
                onChange={(e) => set('is_template', e.target.checked)}
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

        {isEditing && (
          <div className="grid gap-2 border-t border-wpa-border/40 pt-3">
            <label className="text-sm font-medium">Activity</label>
            <div className="flex gap-2">
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleAddComment() }
                }}
                placeholder="Add a comment…"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddComment}
                disabled={addEvent.isPending || !comment.trim()}
              >
                Post
              </Button>
            </div>
            {events.length > 0 && (
              <div className="max-h-44 overflow-y-auto flex flex-col gap-2 pr-1">
                {events.map((event) => (
                  <div key={event.id} className="text-sm">
                    <div className="flex items-center gap-1.5">
                      {event.actor === 'bob'
                        ? <Bot className="size-3 text-pine-forest" />
                        : <UserIcon className="size-3 text-text-tertiary" />}
                      <span className="font-mono text-[10px] tracking-wider uppercase text-text-tertiary">
                        {event.actor}{event.kind !== 'comment' ? ` · ${event.kind.replace('_', ' ')}` : ''}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-text-tertiary">
                        {formatEventDate(event.created_at)}
                      </span>
                    </div>
                    {event.body && (
                      <p className="mt-0.5 text-text-secondary whitespace-pre-wrap">{event.body}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function formatEventDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateStr))
}
