import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { queryKeys } from '@/lib/query-keys'

// Rows from the wpa_businesses_with_score view (base business columns + latest_score).
export type DiscoveryBusiness = Database['wpa']['Views']['wpa_businesses_with_score']['Row']

export interface DiscoveryStats {
  totalDiscovered: number
  totalAudited: number
  avgScore: number | null
  newCount: number
}

export function useDiscoveryStats() {
  return useQuery<DiscoveryStats>({
    queryKey: queryKeys.discovery.stats(),
    queryFn: async () => {
      // Total businesses
      const { count: totalDiscovered, error: e1 } = await supabase
        .from('wpa_businesses')
        .select('*', { count: 'exact', head: true })
      if (e1) throw e1

      // Total with at least one audit (a non-null latest_score means the
      // business has been audited at least once).
      const { count: totalAudited, error: e2 } = await supabase
        .from('wpa_businesses_with_score')
        .select('*', { count: 'exact', head: true })
        .not('latest_score', 'is', null)
      if (e2) throw e2

      // Avg score across audited businesses
      const { data: scoreData, error: e3 } = await supabase
        .from('wpa_businesses_with_score')
        .select('latest_score')
        .not('latest_score', 'is', null)
      if (e3) throw e3

      const scores = (scoreData ?? [])
        .map((r) => r.latest_score)
        .filter((s): s is number => s !== null)
      const avgScore =
        scores.length > 0
          ? scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length
          : null

      // Unreviewed count: IDENTIFIED = discovered by Bob, not yet promoted to pipeline
      const { count: newCount, error: e4 } = await supabase
        .from('wpa_businesses')
        .select('*', { count: 'exact', head: true })
        .eq('contact_status', 'IDENTIFIED')
      if (e4) throw e4

      return {
        totalDiscovered: totalDiscovered ?? 0,
        totalAudited: totalAudited ?? 0,
        avgScore: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
        newCount: newCount ?? 0,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useDiscoverySearch(query: string) {
  const trimmed = query.trim()
  return useQuery<DiscoveryBusiness[]>({
    queryKey: queryKeys.discovery.search(trimmed),
    queryFn: async () => {
      let q = supabase
        .from('wpa_businesses_with_score')
        .select('*')
        .limit(50)

      if (trimmed) {
        q = q.or(
          `name.ilike.%${trimmed}%,address.ilike.%${trimmed}%,search_query.ilike.%${trimmed}%`
        )
      } else {
        q = q.order('discovered_at', { ascending: false })
      }

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    staleTime: 1 * 60 * 1000,
  })
}
