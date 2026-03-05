import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type ProjectStatus = 'active' | 'on_hold' | 'completed'
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ProjectCategory = 'Client Work' | 'WPA Own' | 'Infrastructure' | 'Marketing'
export type AgentStatus = 'idle' | 'working' | 'waiting_review' | 'error' | 'completed'

export interface Project {
  id: number
  name: string
  description: string | null
  status: ProjectStatus
  progress_pct: number
  next_milestone: string | null
  client_id: number | null
  due_date: string | null
  start_date: string | null
  budget_cents: number
  budget_spent_cents: number
  priority: ProjectPriority
  category: ProjectCategory
  owner: string
  tags: string[]
  metadata: Record<string, unknown>
  agent_status: AgentStatus
  agent_notes: string | null
  last_agent_activity: string | null
  created_at: string
  updated_at: string
  wpa_clients: { name: string } | null
}

export type ProjectInsert = {
  name: string
  description?: string | null
  status: ProjectStatus
  progress_pct: number
  next_milestone?: string | null
  client_id?: number | null
  due_date?: string | null
  start_date?: string | null
  budget_cents?: number
  budget_spent_cents?: number
  priority?: ProjectPriority
  category?: ProjectCategory
  owner?: string
  tags?: string[]
  metadata?: Record<string, unknown>
  agent_status?: AgentStatus
  agent_notes?: string | null
}

export type ProjectUpdate = Partial<ProjectInsert> & { id: number }

const STATUS_ORDER: Record<ProjectStatus, number> = {
  active: 0,
  on_hold: 1,
  completed: 2,
}

const PRIORITY_ORDER: Record<ProjectPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function useProjects(filters?: {
  status?: ProjectStatus
  category?: ProjectCategory
  priority?: ProjectPriority
  clientId?: number
}) {
  return useQuery<Project[]>({
    queryKey: ['projects', filters],
    queryFn: async () => {
      let query = supabase
        .from('wpa_projects')
        .select('*, wpa_clients(name)')
        .order('name', { ascending: true })

      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.category) query = query.eq('category', filters.category)
      if (filters?.priority) query = query.eq('priority', filters.priority)
      if (filters?.clientId) query = query.eq('client_id', filters.clientId)

      const { data, error } = await query
      if (error) throw error

      const sorted = ((data as Project[]) ?? []).sort((a, b) => {
        const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        if (statusDiff !== 0) return statusDiff
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      })

      return sorted
    },
  })
}

export function useProject(id: number | null) {
  return useQuery<Project | null>({
    queryKey: ['projects', id],
    enabled: id != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_projects')
        .select('*, wpa_clients(name)')
        .eq('id', id!)
        .single()

      if (error) throw error
      return data as Project
    },
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (project: ProjectInsert) => {
      const { data, error } = await supabase
        .from('wpa_projects')
        .insert(project)
        .select('*, wpa_clients(name)')
        .single()

      if (error) throw error
      return data as Project
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: ProjectUpdate) => {
      const { data, error } = await supabase
        .from('wpa_projects')
        .update(updates)
        .eq('id', id)
        .select('*, wpa_clients(name)')
        .single()

      if (error) throw error
      return data as Project
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('wpa_projects')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

// --- Project Tasks (tasks linked to a project) ---

export function useProjectTasks(projectId: number | null) {
  return useQuery({
    queryKey: ['tasks', { projectId }],
    enabled: projectId != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_tasks')
        .select('*, wpa_clients(name), wpa_businesses(name)')
        .eq('project_id', projectId!)
        .eq('is_template', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

// --- Project Updates (activity timeline) ---

export type ProjectUpdateType =
  | 'status_change'
  | 'note'
  | 'milestone'
  | 'budget_update'
  | 'task_completed'
  | 'agent_update'
  | 'progress_update'

export interface ProjectActivityUpdate {
  id: number
  project_id: number
  author: string
  type: ProjectUpdateType
  summary: string
  details: Record<string, unknown>
  created_at: string
}

export type ProjectActivityInsert = {
  project_id: number
  author?: string
  type: ProjectUpdateType
  summary: string
  details?: Record<string, unknown>
}

export function useProjectUpdates(projectId: number | null) {
  return useQuery<ProjectActivityUpdate[]>({
    queryKey: ['project-updates', projectId],
    enabled: projectId != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_project_updates')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return (data as ProjectActivityUpdate[]) ?? []
    },
  })
}

export function useCreateProjectUpdate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (update: ProjectActivityInsert) => {
      const { data, error } = await supabase
        .from('wpa_project_updates')
        .insert(update)
        .select()
        .single()

      if (error) throw error
      return data as ProjectActivityUpdate
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-updates', variables.project_id] })
    },
  })
}
