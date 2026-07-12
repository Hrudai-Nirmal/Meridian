import type { EndpointNodeData } from "@/lib/meridian-data"

export type RealWorkflowRunRecord = EndpointNodeData["runs"][number] & {
  nodeId: string
  nodeLabel: string
}

export type RealMetricSummaryRecord = NonNullable<EndpointNodeData["realMetrics"]>[number] & {
  nodeId: string
  nodeLabel: string
}

export function getRealWorkflowRuns(nodes: EndpointNodeData[]): RealWorkflowRunRecord[]

export function getRealMetricSummaries(nodes: EndpointNodeData[]): RealMetricSummaryRecord[]
