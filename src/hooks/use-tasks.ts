import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskCategory = 'Client Work' | 'WPA Own' | 'Infrastructure' | 'Marketing' | 'Backlog'
export type TaskAssignee = 'human' | 'bob'

export interface Task {
  id: number
  title: string
  description: string | null
  category: TaskCategory
  status: TaskStatus
  priority: TaskPriority
  contract_id: number | null
  business_id: string | null
  project_id: number | null
  due_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  is_template: boolean
  recurrence_rule: string | null
  last_generated_at: string | null
  tags: string[]
  notes: string | null
  assigned_to: TaskAssignee
  wpa_contracts: { id: number; wpa_businesses: { name: string } | null } | null
  wpa_businesses: { name: string } | null
}

export type TaskInsert = {
  title: string
  description?: string | null
  category: TaskCategory
  status?: TaskStatus
  priority?: TaskPriority
  contract_id?: number | null
  business_id?: string | null
  project_id?: number | null
  due_date?: string | null
  is_template?: boolean
  recurrence_rule?: string | null
  tags?: string[]
  notes?: string | null
  assigned_to?: TaskAssignee
  completed_at?: string | null
}

export type TaskUpdate = Partial<TaskInsert> & { id: number }

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function useTasks(categoryFilter?: string, contractId?: number, businessId?: string) {
  return useQuery<Task[]>({
    queryKey: ['tasks', categoryFilter, contractId, businessId],
    queryFn: async () => {
      let query = supabase
        .from('wpa_tasks')
        .select('*, wpa_contracts(id, wpa_businesses(name)), wpa_businesses(name)')
        .eq('is_template', false)

      if (categoryFilter) {
        query = query.eq('category', categoryFilter)
      }

      if (contractId) {
        query = query.eq('contract_id', contractId)
      }

      if (businessId) {
        query = query.eq('business_id', businessId)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      const tasks = (data as Task[]) ?? []

      return tasks.sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 4
        const pb = PRIORITY_ORDER[b.priority] ?? 4
        return pa - pb
      })
    },
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (task: TaskInsert) => {
      const { data, error } = await supabase
        .from('wpa_tasks')
        .insert(task)
        .select('*, wpa_contracts(id, wpa_businesses(name)), wpa_businesses(name)')
        .single()

      if (error) throw error
      return data as Task
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: TaskUpdate) => {
      const payload: Record<string, unknown> = { ...updates }

      // Auto-set completed_at when marking done
      if (updates.status === 'done' && !('completed_at' in updates)) {
        payload.completed_at = new Date().toISOString()
      } else if (updates.status && updates.status !== 'done') {
        payload.completed_at = null
      }

      const { data, error } = await supabase
        .from('wpa_tasks')
        .update(payload)
        .eq('id', id)
        .select('*, wpa_contracts(id, wpa_businesses(name)), wpa_businesses(name)')
        .single()

      if (error) throw error
      return data as Task
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('wpa_tasks')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

function shouldGenerate(t: Task): boolean {
  if (!t.recurrence_rule) return false
  const last = t.last_generated_at ? new Date(t.last_generated_at) : null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  if (!last) return true
  const lastDate = new Date(last)
  lastDate.setHours(0, 0, 0, 0)
  const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
  switch (t.recurrence_rule) {
    case 'daily': return daysSince >= 1
    case 'weekly:1': return daysSince >= 7
    case 'weekly:2': return daysSince >= 3
    case 'weekly:3': return daysSince >= 2
    case 'monthly:1': return daysSince >= 30
    default: return false
  }
}

export function useTemplateTasks() {
  return useQuery<Task[]>({
    queryKey: ['tasks', 'templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_tasks')
        .select('*, wpa_contracts(id, wpa_businesses(name)), wpa_businesses(name)')
        .eq('is_template', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as Task[]) ?? []
    },
  })
}

export function useGenerateFromTemplates() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data: templates, error: fetchError } = await supabase
        .from('wpa_tasks')
        .select('*, wpa_contracts(id, wpa_businesses(name)), wpa_businesses(name)')
        .eq('is_template', true)
        .not('recurrence_rule', 'is', null)

      if (fetchError) throw fetchError

      const tasksToGenerate = ((templates as Task[]) ?? []).filter(shouldGenerate)
      let count = 0

      for (const template of tasksToGenerate) {
        const newTask: Record<string, unknown> = {
          title: template.title,
          description: template.description,
          category: template.category,
          status: 'todo',
          priority: template.priority,
          contract_id: template.contract_id,
          business_id: template.business_id,
          project_id: template.project_id,
          due_date: template.due_date,
          tags: template.tags,
          assigned_to: template.assigned_to,
          is_template: false,
        }

        const { error: insertError } = await supabase
          .from('wpa_tasks')
          .insert(newTask)

        if (insertError) throw insertError

        const { error: updateError } = await supabase
          .from('wpa_tasks')
          .update({ last_generated_at: new Date().toISOString() })
          .eq('id', template.id)

        if (updateError) throw updateError

        count++
      }

      return count
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
