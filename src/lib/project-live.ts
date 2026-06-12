import "server-only"

import { getPrisma } from "@/lib/prisma"

export type ProjectLiveArea = "runs" | "alerts" | "metrics" | "nodes" | "poll"

export type ProjectLiveSnapshot = {
  cursor: string
  checkedAt: string
  areas: Record<ProjectLiveArea, string>
}

function timestampValue(value?: Date | null) {
  return value ? String(value.getTime()) : "0"
}

function maxTimestamp(...values: (Date | null | undefined)[]) {
  return values.reduce<Date | null>((latest, value) => {
    if (!value) return latest
    if (!latest || value.getTime() > latest.getTime()) return value
    return latest
  }, null)
}

function buildCursor(areas: ProjectLiveSnapshot["areas"]) {
  return (Object.keys(areas) as ProjectLiveArea[]).map((area) => `${area}:${areas[area]}`).join("|")
}

export function diffProjectLiveAreas(previous: ProjectLiveSnapshot, current: ProjectLiveSnapshot) {
  return (Object.keys(current.areas) as ProjectLiveArea[]).filter((area) => current.areas[area] !== previous.areas[area])
}

export async function getProjectLiveSnapshot(projectId: string): Promise<ProjectLiveSnapshot> {
  const prisma = getPrisma()
  const [nodeAggregate, runAggregate, sampleAggregate, alertAggregate, pollAggregate] = await Promise.all([
    prisma.endpointNode.aggregate({
      where: { projectId },
      _max: { updatedAt: true },
    }),
    prisma.workflowRun.aggregate({
      where: {
        node: { projectId },
      },
      _max: {
        startedAt: true,
        finishedAt: true,
      },
    }),
    prisma.metricSample.aggregate({
      where: {
        node: { projectId },
      },
      _max: { sampledAt: true },
    }),
    prisma.alertEvent.aggregate({
      where: {
        OR: [{ node: { projectId } }, { rule: { projectId } }],
      },
      _max: {
        createdAt: true,
        resolvedAt: true,
      },
    }),
    prisma.pollExecution.aggregate({
      _max: {
        startedAt: true,
        finishedAt: true,
        createdAt: true,
      },
    }),
  ])
  const areas: ProjectLiveSnapshot["areas"] = {
    nodes: timestampValue(nodeAggregate._max.updatedAt),
    runs: timestampValue(maxTimestamp(runAggregate._max.startedAt, runAggregate._max.finishedAt)),
    metrics: timestampValue(sampleAggregate._max.sampledAt),
    alerts: timestampValue(maxTimestamp(alertAggregate._max.createdAt, alertAggregate._max.resolvedAt)),
    poll: timestampValue(maxTimestamp(pollAggregate._max.startedAt, pollAggregate._max.finishedAt, pollAggregate._max.createdAt)),
  }

  return {
    areas,
    checkedAt: new Date().toISOString(),
    cursor: buildCursor(areas),
  }
}
