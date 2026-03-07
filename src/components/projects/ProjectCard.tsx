import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import type { Project, ProjectStatus, ProjectPriority, AgentStatus } from '@/hooks/use-projects'
import {
  CalendarIcon,
  DollarSignIcon,
  BotIcon,
  UserIcon,
} from 'lucide-react'

interface ProjectCardProps {
  project: Project
  onClick: (project: Project) => void
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
}

const STATUS_CLASSES: Record<ProjectStatus, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  on_hold: 'bg-amber-100 text-amber-800 border-amber-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
}

const PRIORITY_CLASSES: Record<ProjectPriority, string> = {
  urgent: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-slate-100 text-slate-700 border-slate-200',
  low: 'bg-slate-50 text-slate-500 border-slate-200',
}

const AGENT_LABELS: Record<AgentStatus, string> = {
  idle: 'Idle',
  working: 'Working',
  waiting_review: 'Needs Review',
  error: 'Error',
  completed: 'Done',
}

const AGENT_CLASSES: Record<AgentStatus, string> = {
  idle: 'bg-slate-100 text-slate-600 border-slate-200',
  working: 'bg-purple-100 text-purple-800 border-purple-200 animate-pulse',
  waiting_review: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dueDate) < today
}

function daysUntil(dueDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const overdue = project.status !== 'completed' && isOverdue(project.due_date)
  const budgetDollars = project.budget_cents ? project.budget_cents / 100 : 0
  const spentDollars = project.budget_spent_cents ? project.budget_spent_cents / 100 : 0
  const budgetPct = budgetDollars > 0 ? Math.round((spentDollars / budgetDollars) * 100) : 0
  const showAgent = project.agent_status !== 'idle'

  return (
    <Card
      className={`cursor-pointer ${overdue ? 'border-red-300' : ''}`}
      onClick={() => onClick(project)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base text-text-primary">{project.name}</CardTitle>
            {project.wpa_clients?.name && (
              <p className="text-xs text-text-tertiary">{project.wpa_clients.name}</p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            <Badge variant="outline" className={STATUS_CLASSES[project.status]}>
              {STATUS_LABELS[project.status]}
            </Badge>
            {project.priority !== 'medium' && (
              <Badge variant="outline" className={PRIORITY_CLASSES[project.priority]}>
                {project.priority}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {project.description && (
          <p className="line-clamp-2 text-sm text-text-secondary">{project.description}</p>
        )}

        {/* Progress bar */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-text-tertiary">Progress</span>
            <span className="text-xs font-medium text-text-secondary">
              {project.progress_pct}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-pine-mid transition-all"
              style={{ width: `${project.progress_pct}%` }}
            />
          </div>
        </div>

        {/* Meta row: due date, budget, owner, agent */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
          {project.due_date && (
            <span className={`flex items-center gap-1 ${overdue ? 'font-medium text-red-600' : ''}`}>
              <CalendarIcon className="size-3" />
              {overdue
                ? `${Math.abs(daysUntil(project.due_date))}d overdue`
                : daysUntil(project.due_date) <= 7
                  ? `${daysUntil(project.due_date)}d left`
                  : formatDate(project.due_date)}
            </span>
          )}

          {budgetDollars > 0 && (
            <span className={`flex items-center gap-1 ${budgetPct > 90 ? 'text-red-600' : ''}`}>
              <DollarSignIcon className="size-3" />
              ${spentDollars.toFixed(0)} / ${budgetDollars.toFixed(0)}
            </span>
          )}

          {project.owner && (
            <span className="flex items-center gap-1">
              <UserIcon className="size-3" />
              {project.owner}
            </span>
          )}

          {showAgent && (
            <Badge variant="outline" className={`gap-1 text-[10px] ${AGENT_CLASSES[project.agent_status]}`}>
              <BotIcon className="size-3" />
              {AGENT_LABELS[project.agent_status]}
            </Badge>
          )}
        </div>

        {project.next_milestone && (
          <div>
            <span className="text-xs text-text-tertiary">Next: </span>
            <span className="text-xs text-text-secondary">{project.next_milestone}</span>
          </div>
        )}

        {(project.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {project.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
