import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/query-keys'

export type TaskEventKind = 'comment' | 'status_change' | 'assignment' | 'agent_run'

export interface TaskEvent {
  id: number
  task_id: number
  actor: string
  kind: TaskEventKind
  body: string
  meta: Record<string, unknown>
  created_at: string
}

export function useTaskEvents(taskId: number | null) {
  return useQuery<TaskEvent[]>({
    queryKey: queryKeys.taskEvents.byTask(taskId),
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_task_events')
        .select('*')
        .eq('task_id', taskId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as TaskEvent[]) ?? []
    },
  })
}

export function useAddTaskEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      task_id,
      body,
      kind = 'comment',
      actor = 'human',
    }: {
      task_id: number
      body: string
      kind?: TaskEventKind
      actor?: string
    }) => {
      const { data, error } = await supabase
        .from('wpa_task_events')
        .insert({ task_id, body, kind, actor })
        .select('*')
        .single()
      if (error) throw error
      return data as TaskEvent
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskEvents.byTask(vars.task_id) })
    },
  })
}
