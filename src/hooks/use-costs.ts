import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface DailyCost {
  id: number
  date: string
  openai_tokens: number | null
  openai_cost: number | null
  anthropic_tokens: number | null
  anthropic_cost: number | null
  moonshot_tokens: number | null
  moonshot_cost: number | null
  total_cost: number | null
  raw_data: Record<string, unknown> | null
}

export interface CostSummary {
  today: number
  thisWeek: number
  thisMonth: number
  rolling30Day: number
}

function getDateBounds() {
  const now = new Date()

  const todayStr = now.toISOString().slice(0, 10)

  // Start of current week (Monday)
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon...
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - daysFromMonday)
  const weekStartStr = weekStart.toISOString().slice(0, 10)

  // Start of current month
  const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  // 90 days ago
  const ninetyDaysAgo = new Date(now)
  ninetyDaysAgo.setDate(now.getDate() - 89)
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().slice(0, 10)

  // 30 days ago
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(now.getDate() - 29)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10)

  return { todayStr, weekStartStr, monthStartStr, ninetyDaysAgoStr, thirtyDaysAgoStr }
}

export function useCosts() {
  const { ninetyDaysAgoStr } = getDateBounds()

  return useQuery<DailyCost[]>({
    queryKey: ['costs', ninetyDaysAgoStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_daily_costs')
        .select('*')
        .gte('date', ninetyDaysAgoStr)
        .order('date', { ascending: false })

      if (error) throw error
      return (data as DailyCost[]) ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCostSummary() {
  const { data: costs, ...rest } = useCosts()

  const summary: CostSummary = (() => {
    if (!costs || costs.length === 0) {
      return { today: 0, thisWeek: 0, thisMonth: 0, rolling30Day: 0 }
    }

    const { todayStr, weekStartStr, monthStartStr, thirtyDaysAgoStr } = getDateBounds()

    let today = 0
    let thisWeek = 0
    let thisMonth = 0
    let rolling30Day = 0

    for (const row of costs) {
      const cost = Number(row.total_cost ?? 0)
      if (row.date === todayStr) today += cost
      if (row.date >= weekStartStr) thisWeek += cost
      if (row.date >= monthStartStr) thisMonth += cost
      if (row.date >= thirtyDaysAgoStr) rolling30Day += cost
    }

    return { today, thisWeek, thisMonth, rolling30Day }
  })()

  return { summary, costs, ...rest }
}
