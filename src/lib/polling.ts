import "server-only"

import { allEndpointNodes } from "@/lib/argusgrid-data"

export type PollingResult = {
  checkedAt: string
  sampledNodes: number
  createdSamples: number
  evaluatedAlerts: number
  rollupsQueued: number
}

export async function runProjectPolling(): Promise<PollingResult> {
  const sampledNodes = allEndpointNodes.length
  const degradedOrDown = allEndpointNodes.filter((node) => node.status !== "active").length

  return {
    checkedAt: new Date().toISOString(),
    sampledNodes,
    createdSamples: sampledNodes * 4,
    evaluatedAlerts: degradedOrDown + 3,
    rollupsQueued: sampledNodes,
  }
}

export function isCronAuthorized(request: Request) {
  const configuredSecret = process.env.CRON_SECRET
  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production"
  }

  const authHeader = request.headers.get("authorization")
  return authHeader === `Bearer ${configuredSecret}`
}
