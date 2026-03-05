import { useState } from 'react'
import { TaskForm } from '@/components/tasks/TaskForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatDate } from '@/lib/format'
import {
  useProject,
  useProjectTasks,
  useProjectUpdates,
  useCreateProjectUpdate,
  useDeleteProject,
} from '@/hooks/use-projects'
import type {
  ProjectStatus,
  ProjectPriority,
  AgentStatus,
  ProjectUpdateType,
} from '@/hooks/use-projects'
import {
  ArrowLeftIcon,
  CalendarIcon,
  DollarSignIcon,
  UserIcon,
  BotIcon,
  PlusIcon,
  CheckCircleIcon,
  CircleIcon,
  AlertCircleIcon,
  ClockIcon,
  TrashIcon,
  MessageSquareIcon,
  FlagIcon,
  TrendingUpIcon,
  WrenchIcon,
} from 'lucide-react'

interface ProjectDetailProps {
  projectId: number
  onBack: () => void
  onEditProject: () => void
}

const STATUS_CLASSES: Record<ProjectStatus, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  on_hold: 'bg-amber-100 text-amber-800 border-amber-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
}

const PRIORITY_LABELS: Record<ProjectPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const AGENT_LABELS: Record<AgentStatus, string> = {
  idle: 'Idle',
  working: 'Working',
  waiting_review: 'Needs Review',
  error: 'Error',
  completed: 'Done',
}

const AGENT_CLASSES: Record<AgentStatus, string> = {
  idle: 'text-slate-500',
  working: 'text-purple-600',
  waiting_review: 'text-yellow-600',
  error: 'text-red-600',
  completed: 'text-green-600',
}

const TASK_STATUS_ICONS = {
  todo: CircleIcon,
  in_progress: ClockIcon,
  blocked: AlertCircleIcon,
  done: CheckCircleIcon,
}

const TASK_STATUS_CLASSES = {
  todo: 'text-slate-400',
  in_progress: 'text-blue-500',
  blocked: 'text-red-500',
  done: 'text-green-500',
}

const UPDATE_TYPE_ICONS: Record<ProjectUpdateType, typeof MessageSquareIcon> = {
  status_change: WrenchIcon,
  note: MessageSquareIcon,
  milestone: FlagIcon,
  budget_update: DollarSignIcon,
  task_completed: CheckCircleIcon,
  agent_update: BotIcon,
  progress_update: TrendingUpIcon,
}

function isOverdue(dueDate: string | null, status: ProjectStatus): boolean {
  if (!dueDate || status === 'completed') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dueDate) < today
}

export function ProjectDetail({ projectId, onBack, onEditProject }: ProjectDetailProps) {
  const { data: project, isLoading } = useProject(projectId)
  const { data: tasks } = useProjectTasks(projectId)
  const { data: updates } = useProjectUpdates(projectId)
  const createUpdate = useCreateProjectUpdate()
  const deleteProject = useDeleteProject()
  const [noteText, setNoteText] = useState('')
  const [taskFormOpen, setTaskFormOpen] = useState(false)

  if (isLoading || !project) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 gap-1">
          <ArrowLeftIcon className="size-4" /> Back
        </Button>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-border" />
          ))}
        </div>
      </div>
    )
  }

  const overdue = isOverdue(project.due_date, project.status)
  const budgetDollars = project.budget_cents / 100
  const spentDollars = project.budget_spent_cents / 100
  const budgetPct = budgetDollars > 0 ? Math.round((spentDollars / budgetDollars) * 100) : 0

  const taskCounts = (tasks ?? []).reduce(
    (acc, t) => {
      acc.total++
      if (t.status === 'done') acc.done++
      return acc
    },
    { total: 0, done: 0 }
  )
  const taskPct = taskCounts.total > 0 ? Math.round((taskCounts.done / taskCounts.total) * 100) : 0

  async function addNote() {
    if (!noteText.trim()) return
    await createUpdate.mutateAsync({
      project_id: projectId,
      author: 'Christopher',
      type: 'note',
      summary: noteText.trim(),
    })
    setNoteText('')
  }

  async function handleDelete() {
    if (!window.confirm('Delete this project? Tasks will be unlinked, not deleted.')) return
    await deleteProject.mutateAsync(projectId)
    onBack()
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 gap-1 -ml-2">
            <ArrowLeftIcon className="size-4" /> Projects
          </Button>
          <h2 className="text-2xl font-semibold text-text-primary">{project.name}</h2>
          {project.wpa_clients?.name && (
            <p className="text-sm text-text-tertiary">{project.wpa_clients.name}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEditProject}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-500 hover:text-red-700">
            <TrashIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Status */}
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-text-tertiary">Status</p>
            <Badge variant="outline" className={`mt-1 ${STATUS_CLASSES[project.status]}`}>
              {project.status.replace('_', ' ')}
            </Badge>
          </CardContent>
        </Card>

        {/* Priority */}
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-text-tertiary">Priority</p>
            <p className="mt-1 text-sm font-medium capitalize">{PRIORITY_LABELS[project.priority]}</p>
          </CardContent>
        </Card>

        {/* Due Date */}
        <Card className={overdue ? 'border-red-300' : ''}>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-text-tertiary">Due Date</p>
            <p className={`mt-1 flex items-center justify-center gap-1 text-sm ${overdue ? 'font-medium text-red-600' : ''}`}>
              <CalendarIcon className="size-3" />
              {project.due_date ? formatDate(project.due_date) : 'Not set'}
            </p>
          </CardContent>
        </Card>

        {/* Agent Status */}
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-text-tertiary">Agent</p>
            <p className={`mt-1 flex items-center justify-center gap-1 text-sm font-medium ${AGENT_CLASSES[project.agent_status]}`}>
              <BotIcon className="size-3" />
              {AGENT_LABELS[project.agent_status]}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress + Budget row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {/* Overall Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-xs text-text-tertiary">
              <span>Manual: {project.progress_pct}%</span>
              <span>Tasks: {taskCounts.done}/{taskCounts.total} ({taskPct}%)</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-pine-mid transition-all"
                style={{ width: `${project.progress_pct}%` }}
              />
            </div>
            {project.next_milestone && (
              <p className="text-xs text-text-secondary">
                <span className="text-text-tertiary">Next milestone: </span>
                {project.next_milestone}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Budget */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Budget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {budgetDollars > 0 ? (
              <>
                <div className="flex items-center justify-between text-xs text-text-tertiary">
                  <span className="flex items-center gap-1">
                    <DollarSignIcon className="size-3" />
                    ${spentDollars.toFixed(2)} spent
                  </span>
                  <span>${budgetDollars.toFixed(2)} budget</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className={`h-full rounded-full transition-all ${budgetPct > 90 ? 'bg-red-500' : budgetPct > 70 ? 'bg-amber-500' : 'bg-pine-mid'}`}
                    style={{ width: `${Math.min(budgetPct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-text-tertiary">{budgetPct}% utilized</p>
              </>
            ) : (
              <p className="text-xs text-text-tertiary">No budget set</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metadata row */}
      <div className="mb-6 flex flex-wrap gap-3 text-sm text-text-secondary">
        <span className="flex items-center gap-1">
          <UserIcon className="size-3.5 text-text-tertiary" />
          {project.owner}
        </span>
        <span className="text-text-tertiary">|</span>
        <span>{project.category}</span>
        {project.start_date && (
          <>
            <span className="text-text-tertiary">|</span>
            <span>Started {formatDate(project.start_date)}</span>
          </>
        )}
        {(project.tags ?? []).length > 0 && (
          <>
            <span className="text-text-tertiary">|</span>
            <div className="flex gap-1">
              {project.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Agent Notes */}
      {project.agent_notes && (
        <Card className="mb-6 border-purple-200 bg-purple-50/50">
          <CardContent className="p-3">
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-purple-700">
              <BotIcon className="size-3" /> Agent Notes
              {project.last_agent_activity && (
                <span className="ml-auto text-[10px] font-normal text-purple-500">
                  {formatDate(project.last_agent_activity)}
                </span>
              )}
            </p>
            <p className="text-sm text-purple-900">{project.agent_notes}</p>
          </CardContent>
        </Card>
      )}

      <Separator className="mb-4" />

      {/* Tabs: Tasks + Activity */}
      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">
            Tasks ({taskCounts.total})
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activity ({(updates ?? []).length})
          </TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => setTaskFormOpen(true)}>
              <PlusIcon className="mr-1 size-3" /> Add Task
            </Button>
          </div>
          {(tasks ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-text-tertiary">
              No tasks linked to this project yet.
            </p>
          ) : (
            <div className="space-y-1">
              {(tasks ?? []).map((task) => {
                const Icon = TASK_STATUS_ICONS[task.status as keyof typeof TASK_STATUS_ICONS] ?? CircleIcon
                const iconClass = TASK_STATUS_CLASSES[task.status as keyof typeof TASK_STATUS_CLASSES] ?? 'text-slate-400'
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent"
                  >
                    <Icon className={`size-4 shrink-0 ${iconClass}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${task.status === 'done' ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                        {task.title}
                      </p>
                      {task.due_date && (
                        <p className="text-xs text-text-tertiary">{formatDate(task.due_date)}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {task.priority}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-4">
          {/* Add note */}
          <div className="mb-4 flex gap-2">
            <Input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  addNote()
                }
              }}
              placeholder="Add a note..."
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={addNote}
              disabled={!noteText.trim() || createUpdate.isPending}
            >
              <PlusIcon className="mr-1 size-3" /> Add
            </Button>
          </div>

          {(updates ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-text-tertiary">
              No activity recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {(updates ?? []).map((update) => {
                const Icon = UPDATE_TYPE_ICONS[update.type] ?? MessageSquareIcon
                const isAgent = update.author !== 'Christopher' && update.author !== 'system'
                return (
                  <div key={update.id} className="flex gap-3">
                    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-border">
                      <Icon className="size-3.5 text-text-tertiary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xs font-medium ${isAgent ? 'text-purple-700' : 'text-text-primary'}`}>
                          {isAgent && <BotIcon className="mr-0.5 inline size-3" />}
                          {update.author}
                        </span>
                        <span className="text-[10px] text-text-tertiary">
                          {formatDate(update.created_at)}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {update.type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-text-secondary">{update.summary}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TaskForm
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        defaultProjectId={projectId}
        defaultClientId={project.client_id ?? undefined}
      />
    </div>
  )
}
