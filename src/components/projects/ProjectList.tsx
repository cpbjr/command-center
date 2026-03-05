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
import { ProjectCard } from './ProjectCard'
import { ProjectForm } from './ProjectForm'
import { ProjectDetail } from './ProjectDetail'
import { useProjects } from '@/hooks/use-projects'
import type { Project, ProjectStatus, ProjectCategory } from '@/hooks/use-projects'

export function ProjectList() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)

  const { data: projects, isLoading } = useProjects({
    status: statusFilter !== 'all' ? (statusFilter as ProjectStatus) : undefined,
    category: categoryFilter !== 'all' ? (categoryFilter as ProjectCategory) : undefined,
  })

  function handleAdd() {
    setSelectedProject(null)
    setFormOpen(true)
  }

  function handleCardClick(project: Project) {
    setDetailId(project.id)
  }

  function handleEditFromDetail() {
    const p = (projects ?? []).find((p) => p.id === detailId)
    if (p) {
      setSelectedProject(p)
      setFormOpen(true)
    }
  }

  function handleFormClose(open: boolean) {
    setFormOpen(open)
    if (!open) setSelectedProject(null)
  }

  // Detail view
  if (detailId != null) {
    return (
      <>
        <ProjectDetail
          projectId={detailId}
          onBack={() => setDetailId(null)}
          onEditProject={handleEditFromDetail}
        />
        <ProjectForm
          open={formOpen}
          onOpenChange={handleFormClose}
          project={selectedProject}
        />
      </>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-text-primary">Projects</h2>
        </div>
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-border" />
          ))}
        </div>
      </div>
    )
  }

  const activeCount = (projects ?? []).filter((p) => p.status === 'active').length
  const totalCount = (projects ?? []).length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary">Projects</h2>
          <p className="text-sm text-text-tertiary">
            {activeCount} active / {totalCount} total
          </p>
        </div>
        <Button onClick={handleAdd} size="sm">
          <PlusIcon className="mr-1 size-4" />
          Add Project
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="Client Work">Client Work</SelectItem>
            <SelectItem value="WPA Own">WPA Own</SelectItem>
            <SelectItem value="Infrastructure">Infrastructure</SelectItem>
            <SelectItem value="Marketing">Marketing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(!projects || projects.length === 0) ? (
        <div className="mt-12 text-center">
          <p className="text-text-secondary">
            {statusFilter !== 'all' || categoryFilter !== 'all'
              ? 'No projects match your filters.'
              : 'No projects yet. Create your first project.'}
          </p>
          <Button onClick={handleAdd} className="mt-4" variant="outline">
            <PlusIcon className="mr-1 size-4" />
            Add Project
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onClick={handleCardClick} />
          ))}
        </div>
      )}

      <ProjectForm
        open={formOpen}
        onOpenChange={handleFormClose}
        project={selectedProject}
      />
    </div>
  )
}
