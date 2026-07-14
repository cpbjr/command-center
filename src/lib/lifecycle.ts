// Single source of truth for the lifecycle_stage pipeline vocabulary (see CONTEXT.md).
export type LifecycleStage =
  | 'identified' | 'new_prospect' | 'lead'
  | 'client' | 'dropped' | 'relationship_ended'

// Stages a user can pick directly in the Leads status dropdown.
export const LEAD_DROPDOWN_STAGES = ['identified', 'new_prospect', 'lead', 'dropped'] as const

export const STAGE_LABELS: Record<LifecycleStage, string> = {
  identified: 'Identified',
  new_prospect: 'New Prospect',
  lead: 'Lead',
  client: 'Client',
  dropped: 'Dropped',
  relationship_ended: 'Relationship Ended',
}

export const STAGE_BADGE_CLASSES: Record<LifecycleStage, string> = {
  identified:         'bg-violet-100 text-violet-700 border-violet-200',
  new_prospect:       'bg-orange-100 text-orange-700 border-orange-200',
  lead:               'bg-amber-100 text-amber-700 border-amber-200',
  client:             'bg-green-100 text-green-700 border-green-200',
  dropped:            'bg-slate-200 text-slate-600 border-slate-300',
  relationship_ended: 'bg-slate-100 text-slate-500 border-slate-200',
}

export const DROPPED_REASONS = [
  { value: 'declined', label: 'Declined' },
  { value: 'not_a_fit', label: 'Not a fit' },
  { value: 'no_response', label: 'No response' },
] as const

export const CLOSE_REASONS = [
  { value: 'work_completed', label: 'Work Completed' },
  { value: 'parted_ways', label: 'Parted Ways' },
] as const
