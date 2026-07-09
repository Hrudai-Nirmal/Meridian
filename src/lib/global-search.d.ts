export type GlobalSearchResultType = "section" | "action" | "node" | "alert" | "run" | "report" | "job" | "integration"

export type GlobalSearchResult = {
  id: string
  type: GlobalSearchResultType
  title: string
  description: string
  section: string
  entityId?: string
  nodeId?: string
  logType?: string
  jobStatus?: string
  action?: string
  priority?: number
  searchText?: string
}

export function buildGlobalSearchIndex(input: {
  sections: { id: string; label: string; description?: string }[]
  nodes: Record<string, unknown>[]
  alerts: Record<string, unknown>[]
  runs: Record<string, unknown>[]
  reports: Record<string, unknown>[]
  jobs: Record<string, unknown>[]
  canEditProject: boolean
  canManageOrganization: boolean
}): GlobalSearchResult[]

export function searchGlobalIndex(index: GlobalSearchResult[], query: unknown, limit?: number): GlobalSearchResult[]
