import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useClients } from '@/hooks/use-clients'
import { useCreateProject, useUpdateProject } from '@/hooks/use-projects'
import type {
  Project,
  ProjectInsert,
  ProjectStatus,
  ProjectPriority,
  ProjectCategory,
} from '@/hooks/use-projects'
import { XIcon } from 'lucide-react'

interface ProjectFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project | null
}

const EMPTY_FORM: ProjectInsert & { tagInput: string } = {
  name: '',
  description: '',
  status: 'active',
  progress_pct: 0,
  next_milestone: '',
  client_id: null,
  due_date: null,
  start_date: null,
  budget_cents: 0,
  priority: 'medium',
  category: 'Client Work',
  owner: 'Christopher',
  tags: [],
  tagInput: '',
}

type FormState = typeof EMPTY_FORM

export function ProjectForm({ open, onOpenChange, project }: ProjectFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const { data: clients } = useClients()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()

  const isEditing = !!project
  const isPending = createProject.isPending || updateProject.isPending

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name,
        description: project.description ?? '',
        status: project.status,
        progress_pct: project.progress_pct,
        next_milestone: project.next_milestone ?? '',
        client_id: project.client_id ?? null,
        due_date: project.due_date ?? null,
        start_date: project.start_date ?? null,
        budget_cents: project.budget_cents ?? 0,
        priority: project.priority ?? 'medium',
        category: project.category ?? 'Client Work',
        owner: project.owner ?? 'Christopher',
        tags: project.tags ?? [],
        tagInput: '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [project, open])

  function handleChange(field: keyof FormState, value: string | number | null | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function addTag() {
    const tag = form.tagInput.trim()
    if (tag && !(form.tags ?? []).includes(tag)) {
      handleChange('tags', [...(form.tags ?? []), tag])
    }
    handleChange('tagInput', '')
  }

  function removeTag(tag: string) {
    handleChange('tags', (form.tags ?? []).filter((t) => t !== tag))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const { tagInput: _, ...rest } = form
    const payload: ProjectInsert = {
      ...rest,
      description: form.description || null,
      next_milestone: form.next_milestone || null,
      due_date: form.due_date || null,
      start_date: form.start_date || null,
    }

    if (isEditing && project) {
      await updateProject.mutateAsync({ id: project.id, ...payload })
    } else {
      await createProject.mutateAsync(payload)
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Project' : 'New Project'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-primary">Name</label>
            <Input
              required
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Project name"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-primary">Description</label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description"
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>

          {/* Row: Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Status</label>
              <Select
                value={form.status}
                onValueChange={(val) => handleChange('status', val as ProjectStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Priority</label>
              <Select
                value={form.priority ?? 'medium'}
                onValueChange={(val) => handleChange('priority', val as ProjectPriority)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row: Category + Owner */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Category</label>
              <Select
                value={form.category ?? 'Client Work'}
                onValueChange={(val) => handleChange('category', val as ProjectCategory)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Client Work">Client Work</SelectItem>
                  <SelectItem value="WPA Own">WPA Own</SelectItem>
                  <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Owner</label>
              <Input
                value={form.owner ?? ''}
                onChange={(e) => handleChange('owner', e.target.value)}
                placeholder="Christopher"
              />
            </div>
          </div>

          {/* Row: Start Date + Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Start Date</label>
              <Input
                type="date"
                value={form.start_date ?? ''}
                onChange={(e) => handleChange('start_date', e.target.value || null)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Due Date</label>
              <Input
                type="date"
                value={form.due_date ?? ''}
                onChange={(e) => handleChange('due_date', e.target.value || null)}
              />
            </div>
          </div>

          {/* Budget */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-primary">Budget ($)</label>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.budget_cents ? (form.budget_cents / 100).toFixed(2) : ''}
              onChange={(e) =>
                handleChange('budget_cents', Math.round(Number(e.target.value) * 100))
              }
              placeholder="0.00"
            />
          </div>

          {/* Client */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-primary">Client</label>
            <Select
              value={form.client_id != null ? String(form.client_id) : 'none'}
              onValueChange={(val) =>
                handleChange('client_id', val === 'none' ? null : Number(val))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No client</SelectItem>
                {(clients ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-primary">
              Progress — {form.progress_pct}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={form.progress_pct}
              onChange={(e) => handleChange('progress_pct', Number(e.target.value))}
              className="w-full accent-pine-mid"
            />
          </div>

          {/* Next Milestone */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-primary">Next Milestone</label>
            <Input
              value={form.next_milestone ?? ''}
              onChange={(e) => handleChange('next_milestone', e.target.value)}
              placeholder="e.g. Launch homepage"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-primary">Tags</label>
            <div className="flex gap-2">
              <Input
                value={form.tagInput}
                onChange={(e) => handleChange('tagInput', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder="Add tag and press Enter"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>
                Add
              </Button>
            </div>
            {(form.tags ?? []).length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(form.tags ?? []).map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="rounded-full p-0.5 hover:bg-black/10"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
