// Shared domain constants.

// Sort weight for the four priority levels (lower sorts first). TaskPriority and
// ProjectPriority share these exact members, so both hooks index this map.
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}
