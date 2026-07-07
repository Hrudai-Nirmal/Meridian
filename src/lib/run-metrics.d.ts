import type { EndpointMetric, EndpointRun } from "./meridian-data"

export function buildRunDerivedMetricCards(
  runs: Pick<EndpointRun, "status" | "startedAt" | "finishedAt" | "durationMs" | "costUsd">[],
  options?: { now?: Date }
): EndpointMetric[]
