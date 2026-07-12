/*
 * Meridian telemetry evidence helpers keep instructional sample rows separate
 * from persisted workflow and metric evidence used for onboarding progress.
 */

/**
 * @typedef {object} EvidenceNode
 * @property {string} id
 * @property {string} label
 * @property {boolean=} hasPersistedRuns
 * @property {unknown[]=} runs
 * @property {unknown[]=} realMetrics
 */

/**
 * Returns workflow runs that came from persisted ingestion, excluding seeded
 * fallback rows that exist only to make empty nodes easier to understand.
 *
 * @param {EvidenceNode[]} nodes
 * @returns {unknown[]}
 */
export function getRealWorkflowRuns(nodes) {
  if (!Array.isArray(nodes)) return []

  return nodes
    .flatMap((node) => {
      if (!node?.hasPersistedRuns || !Array.isArray(node.runs)) return []

      return node.runs.map((run) => ({
        ...run,
        nodeId: node.id,
        nodeLabel: node.label,
      }))
    })
    .sort((leftRun, rightRun) => {
      const leftStartedAt = typeof leftRun.startedAt === "string" ? new Date(leftRun.startedAt).getTime() : 0
      const rightStartedAt = typeof rightRun.startedAt === "string" ? new Date(rightRun.startedAt).getTime() : 0
      return rightStartedAt - leftStartedAt
    })
}

/**
 * Returns metric summaries produced from persisted samples, enriched with node
 * labels for project-level tables and reports.
 *
 * @param {EvidenceNode[]} nodes
 * @returns {unknown[]}
 */
export function getRealMetricSummaries(nodes) {
  if (!Array.isArray(nodes)) return []

  return nodes.flatMap((node) => {
    if (!Array.isArray(node?.realMetrics)) return []

    return node.realMetrics.map((metric) => ({
      ...metric,
      nodeId: node.id,
      nodeLabel: node.label,
    }))
  })
}
