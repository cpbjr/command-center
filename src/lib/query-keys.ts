// Centralized React Query key factory.
//
// Every queryKey in the app is produced here so the keys used for reads and the
// keys used for invalidation can never drift apart. Each entity exposes an `all`
// root (used for broad invalidation) plus the specific keys its hooks read under.
//
// `as const` keeps the tuples literally-typed, which lets invalidateQueries match
// by prefix (e.g. queryKeys.tasks.all invalidates every tasks key).

export const queryKeys = {
  businesses: {
    all: ['businesses'] as const,
    list: (options: unknown) => ['businesses', options] as const,
    categories: () => ['business-categories'] as const,
    audit: (businessId: string | null) => ['business-audit', businessId] as const,
    simpleRoot: ['businesses-simple'] as const,
    simple: (search = '') => ['businesses-simple', search] as const,
  },

  discovery: {
    stats: () => ['discovery-stats'] as const,
    recent: (limit: number) => ['discovery-recent', limit] as const,
    search: (query: string) => ['discovery-search', query] as const,
  },

  tasks: {
    all: ['tasks'] as const,
    list: (categoryFilter?: string, contractId?: number, businessId?: string) =>
      ['tasks', categoryFilter, contractId, businessId] as const,
    byProject: (projectId: number | null) => ['tasks', { projectId }] as const,
    templates: () => ['tasks', 'templates'] as const,
    openCountsByContract: () => ['tasks', 'open-counts-by-contract'] as const,
  },

  taskEvents: {
    byTask: (taskId: number | null) => ['task-events', taskId] as const,
  },

  projects: {
    all: ['projects'] as const,
    list: (filters: unknown) => ['projects', filters] as const,
    detail: (id: number | null) => ['projects', id] as const,
  },

  projectUpdates: {
    byProject: (projectId: number | null) => ['project-updates', projectId] as const,
  },

  contracts: {
    all: ['contracts'] as const,
  },

  clientBaselines: {
    byClient: (clientId: number | null) => ['client-baselines', clientId] as const,
    latest: (clientId: number | null) => ['client-baselines', clientId, 'latest'] as const,
  },

  contacts: {
    byBusiness: (businessId: string | null) => ['contacts', 'business', businessId] as const,
    notes: (contactId: number | null) => ['contact-notes', contactId] as const,
  },

  documents: {
    all: (typeFilter?: string) => ['documents', 'all', typeFilter] as const,
    byContract: (contractId: number | null) => ['documents', 'contract', contractId] as const,
    byBusiness: (businessId: string | null) => ['documents', 'business', businessId] as const,
  },

  fileTree: {
    listing: (path: string | null) => ['file-listing', path] as const,
  },

  activity: {
    byBusiness: (businessId: string | null) => ['activity', businessId] as const,
  },

  gbpScores: {
    byClient: (clientId: number | null) => ['gbp-scores', clientId] as const,
  },

  gbpInsights: {
    byClient: (clientId: number | null) => ['gbp-insights', clientId] as const,
  },

  gbpAnalytics: {
    all: ['gbp-analytics'] as const,
    forPeriod: (clientId: number | null, periodStart: string, periodEnd: string) =>
      ['gbp-analytics', clientId, periodStart, periodEnd] as const,
    prior: (clientId: number | null, periodStart: string) =>
      ['gbp-analytics-prior', clientId, periodStart] as const,
    byClient: (clientId: number) => ['gbp-analytics', clientId] as const,
    priorByClient: (clientId: number) => ['gbp-analytics-prior', clientId] as const,
  },

  costs: {
    since: (dateStr: string) => ['costs', dateStr] as const,
  },
} as const

// Business rows are read under all of these roots (Leads page + Discovery page),
// so every business mutation must invalidate the full set.
export const businessCacheRoots = [
  queryKeys.businesses.all,
  ['discovery-recent'],
  ['discovery-search'],
  queryKeys.discovery.stats(),
] as const
