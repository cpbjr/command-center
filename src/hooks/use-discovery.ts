import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Business } from '@/hooks/use-businesses'

// Extend Business with view-added columns that may not be present in base type
export type DiscoveryBusiness = Business & {
  audit_count: number | null
  last_audited_at: string | null
}

export interface DiscoveryStats {
  totalDiscovered: number
  totalAudited: number
  avgScore: number | null
  newCount: number
}

export function useDiscoveryStats() {
  return useQuery<DiscoveryStats>({
    queryKey: ['discovery-stats'],
    queryFn: async () => {
      // Total businesses
      const { count: totalDiscovered, error: e1 } = await supabase
        .from('wpa_businesses')
        .select('*', { count: 'exact', head: true })
      if (e1) throw e1

      // Total with at least one audit
      const { count: totalAudited, error: e2 } = await supabase
        .from('wpa_businesses_with_score')
        .select('*', { count: 'exact', head: true })
        .not('last_audited_at', 'is', null)
      if (e2) throw e2

      // Avg score across audited businesses
      const { data: scoreData, error: e3 } = await supabase
        .from('wpa_businesses_with_score')
        .select('latest_score')
        .not('latest_score', 'is', null)
      if (e3) throw e3

      const scores = (scoreData ?? []).map((r: { latest_score: number }) => r.latest_score)
      const avgScore =
        scores.length > 0
          ? scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length
          : null

      // New (uncontacted) count
      const { count: newCount, error: e4 } = await supabase
        .from('wpa_businesses')
        .select('*', { count: 'exact', head: true })
        .eq('contact_status', 'NEW')
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

export function useRecentDiscoveries(limit: number) {
  return useQuery<DiscoveryBusiness[]>({
    queryKey: ['discovery-recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wpa_businesses_with_score')
        .select('*')
        .order('discovered_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return (data ?? []) as DiscoveryBusiness[]
    },
    staleTime: 2 * 60 * 1000,
  })
}

export function useDiscoverySearch(query: string) {
  const trimmed = query.trim()
  return useQuery<DiscoveryBusiness[]>({
    queryKey: ['discovery-search', trimmed],
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
      return (data ?? []) as DiscoveryBusiness[]
    },
    staleTime: 1 * 60 * 1000,
  })
}
