/**
 * Builds Meridian's project-scoped global search index from already-safe client
 * state. Search results intentionally carry labels and ids only, never raw
 * destination URLs, tokens, signing secrets, or credential payloads.
 */

const DEFAULT_RESULT_LIMIT = 12
const MAX_RESULT_LIMIT = 25

const typePriority = {
  section: 10,
  action: 9,
  node: 8,
  alert: 7,
  job: 6,
  run: 5,
  report: 4,
  integration: 3,
}

/**
 * @typedef {"section" | "action" | "node" | "alert" | "run" | "report" | "job" | "integration"} GlobalSearchResultType
 * @typedef {object} GlobalSearchResult
 * @property {string} id
 * @property {GlobalSearchResultType} type
 * @property {string} title
 * @property {string} description
 * @property {string} section
 * @property {string=} entityId
 * @property {string=} nodeId
 * @property {string=} logType
 * @property {string=} jobStatus
 * @property {string=} action
 * @property {number=} priority
 * @property {string=} searchText
 */

/**
 * Normalizes text so search can match user-facing labels consistently.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9._#/@:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Returns a bounded array without trusting caller-provided shapes.
 *
 * @param {unknown} value
 * @returns {unknown[]}
 */
function safeArray(value) {
  return Array.isArray(value) ? value : []
}

/**
 * Builds a result and its private searchable haystack.
 *
 * @param {Omit<GlobalSearchResult, "searchText"> & { keywords?: unknown[] }} result
 * @returns {GlobalSearchResult}
 */
function createSearchResult(result) {
  const keywords = safeArray(result.keywords)
  const searchableValues = [
    result.type,
    result.title,
    result.description,
    result.section,
    result.entityId,
    result.nodeId,
    result.logType,
    result.jobStatus,
    result.action,
    ...keywords,
  ]

  return {
    ...result,
    searchText: normalizeSearchText(searchableValues.join(" ")),
  }
}

/**
 * Builds global search results from project dashboard state.
 *
 * @param {object} input
 * @param {{ id: string, label: string, description?: string }[]} input.sections
 * @param {Array<Record<string, unknown>>} input.nodes
 * @param {Array<Record<string, unknown>>} input.alerts
 * @param {Array<Record<string, unknown>>} input.runs
 * @param {Array<Record<string, unknown>>} input.reports
 * @param {Array<Record<string, unknown>>} input.jobs
 * @param {boolean} input.canEditProject
 * @param {boolean} input.canManageOrganization
 * @returns {GlobalSearchResult[]}
 */
export function buildGlobalSearchIndex(input) {
  const sections = safeArray(input?.sections)
  const nodes = safeArray(input?.nodes)
  const alerts = safeArray(input?.alerts)
  const runs = safeArray(input?.runs)
  const reports = safeArray(input?.reports)
  const jobs = safeArray(input?.jobs)
  const canEditProject = Boolean(input?.canEditProject)
  const canManageOrganization = Boolean(input?.canManageOrganization)

  const results = [
    ...sections.map((section) =>
      createSearchResult({
        id: `section:${section.id}`,
        type: "section",
        title: String(section.label ?? section.id ?? "Section"),
        description: String(section.description ?? "Open dashboard section"),
        section: String(section.id ?? "control-room"),
        priority: typePriority.section,
        keywords: ["open", "go", "navigate"],
      })
    ),
    createSearchResult({
      id: "action:open-dify",
      type: "integration",
      title: "Dify workflow setup",
      description: "Open provider setup guidance for Dify telemetry.",
      section: "integrations",
      action: "open-dify",
      priority: typePriority.integration,
      keywords: ["chatbot", "workflow", "telemetry", "token", "http"],
    }),
    createSearchResult({
      id: "integration:api-setup",
      type: "integration",
      title: "API setup",
      description: "Configure endpoint polling, JSONPath mapping, and thresholds.",
      section: "map",
      action: "open-api-setup",
      priority: typePriority.integration,
      keywords: ["metric", "jsonpath", "poll", "custom rest"],
    }),
    createSearchResult({
      id: "action:open-failed-logs",
      type: "action",
      title: "Open failed jobs in Logs",
      description: "Jump to notification job failures and delivery evidence.",
      section: "logs",
      jobStatus: "failed",
      priority: typePriority.action,
      keywords: ["failed", "failure", "logs", "notification jobs", "retry"],
    }),
  ]

  if (canEditProject) {
    results.push(
      createSearchResult({
        id: "action:create-token",
        type: "action",
        title: "Create telemetry token",
        description: "Open Integrations to create a project ingestion token.",
        section: "integrations",
        action: "create-token",
        priority: typePriority.action,
        keywords: ["ingestion", "sdk", "dify", "n8n", "api key"],
      }),
      createSearchResult({
        id: "action:manual-poll",
        type: "action",
        title: "Run manual poll",
        description: "Open Testing to trigger a project polling check.",
        section: "testing",
        action: "manual-poll",
        priority: typePriority.action,
        keywords: ["test", "polling", "freshness", "endpoint"],
      })
    )
  }

  if (canManageOrganization) {
    results.push(
      createSearchResult({
        id: "action:create-report",
        type: "action",
        title: "Create client report",
        description: "Open Reports to preview, export, and share client proof.",
        section: "reports",
        action: "create-report",
        priority: typePriority.action,
        keywords: ["pdf", "print", "share", "client", "csv"],
      }),
      createSearchResult({
        id: "action:test-slack",
        type: "action",
        title: "Test Slack alerts",
        description: "Open Testing to send a Slack destination test job.",
        section: "testing",
        action: "test-slack",
        priority: typePriority.action,
        keywords: ["integration", "notification", "delivery"],
      })
    )
  }

  for (const node of nodes) {
    results.push(
      createSearchResult({
        id: `node:${node.id}`,
        type: "node",
        title: String(node.label ?? "Workflow node"),
        description: `${String(node.vendor ?? "Workflow")} node · ${String(node.status ?? "unknown")}`,
        section: "map",
        entityId: String(node.id ?? ""),
        nodeId: String(node.id ?? ""),
        priority: typePriority.node,
        keywords: [node.vendor, node.status, node.freshnessLabel],
      })
    )
  }

  for (const alert of alerts) {
    results.push(
      createSearchResult({
        id: `alert:${alert.id}`,
        type: "alert",
        title: String(alert.title ?? "Alert"),
        description: `${String(alert.severity ?? "alert")} · ${String(alert.nodeLabel ?? "Project alert")}`,
        section: "alerts",
        entityId: String(alert.id ?? ""),
        nodeId: alert.nodeId ? String(alert.nodeId) : undefined,
        logType: "alerts",
        priority: typePriority.alert,
        keywords: [alert.status, alert.message, alert.ruleName],
      })
    )
  }

  for (const job of jobs) {
    results.push(
      createSearchResult({
        id: `job:${job.id}`,
        type: "job",
        title: `${String(job.channel ?? "notification")} ${String(job.eventType ?? "job")}`,
        description: `${String(job.status ?? "queued")} · ${String(job.recipient ?? "destination")}`,
        section: "testing",
        entityId: String(job.id ?? ""),
        logType: "deliveries",
        jobStatus: normalizeSearchText(job.status).replace(/_/g, "-"),
        priority: typePriority.job,
        keywords: [job.status, job.recipient, "notification job"],
      })
    )
  }

  for (const run of runs) {
    results.push(
      createSearchResult({
        id: `run:${run.id ?? run.externalId}`,
        type: "run",
        title: String(run.externalId ?? run.id ?? "Workflow run"),
        description: `${String(run.status ?? "run")} · ${String(run.nodeLabel ?? "Workflow node")}`,
        section: "runs",
        entityId: String(run.id ?? run.externalId ?? ""),
        nodeId: run.nodeId ? String(run.nodeId) : undefined,
        logType: "runs",
        priority: typePriority.run,
        keywords: [run.status, run.nodeLabel],
      })
    )
  }

  for (const report of reports) {
    results.push(
      createSearchResult({
        id: `report:${report.id}`,
        type: "report",
        title: String(report.title ?? "Client report"),
        description: String(report.clientName ?? "Shared client proof link"),
        section: "reports",
        entityId: String(report.id ?? ""),
        priority: typePriority.report,
        keywords: [report.subtitle, report.preparedBy, report.revokedAt ? "revoked" : "active"],
      })
    )
  }

  return results.filter((result) => result.entityId !== "")
}

/**
 * Searches the global index using all query terms and a bounded result limit.
 *
 * @param {GlobalSearchResult[]} index
 * @param {unknown} query
 * @param {number=} limit
 * @returns {GlobalSearchResult[]}
 */
export function searchGlobalIndex(index, query, limit = DEFAULT_RESULT_LIMIT) {
  const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? Math.floor(limit) : DEFAULT_RESULT_LIMIT, 1), MAX_RESULT_LIMIT)
  const results = safeArray(index)
  const normalizedQuery = normalizeSearchText(query)

  if (!normalizedQuery) {
    const sections = results.filter((result) => result.type === "section")
    const quickActions = results.filter((result) => result.type === "action" || result.type === "integration")
    const remainingResults = results.filter((result) => result.type !== "section" && result.type !== "action" && result.type !== "integration")

    return [...sections.slice(0, 2), ...quickActions, ...sections.slice(2), ...remainingResults]
      .sort((firstResult, secondResult) => {
        const firstRank = firstResult.type === "section" ? 1 : firstResult.type === "action" || firstResult.type === "integration" ? 0 : 2
        const secondRank = secondResult.type === "section" ? 1 : secondResult.type === "action" || secondResult.type === "integration" ? 0 : 2
        if (firstRank !== secondRank && firstResult.type !== "section" && secondResult.type !== "section") return firstRank - secondRank
        return 0
      })
      .slice(0, safeLimit)
  }

  const terms = normalizedQuery.split(" ").filter(Boolean)

  return results
    .filter((result) => terms.every((term) => normalizeSearchText(result.searchText).includes(term)))
    .sort((firstResult, secondResult) => {
      const priorityDelta = (secondResult.priority ?? 0) - (firstResult.priority ?? 0)
      if (priorityDelta !== 0) return priorityDelta
      return firstResult.title.localeCompare(secondResult.title)
    })
    .slice(0, safeLimit)
}
