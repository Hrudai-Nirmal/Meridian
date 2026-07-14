"use client"

/*
 * Client-only enhancements for public reports: copyable client summary and
 * incident timeline filtering. It receives already-safe public report fields.
 */

import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getFilteredIncidentTimeline } from "@/lib/report-client-proof.mjs"

type IncidentTimelineFilter = "all" | "active" | "resolved"

type PublicIncident = {
  id: string
  title: string
  severity: string
  nodeLabel: string | null
  message: string
  createdAt: string
  resolvedAt: string | null
  status: "active" | "resolved"
}

function formatDateTime(value: string | null) {
  if (!value) return "No data yet"
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function ReportClientProof({
  summaryText,
  incidents,
  activeAlertCount,
}: {
  summaryText: string
  incidents: PublicIncident[]
  activeAlertCount: number
}) {
  const [filter, setFilter] = useState<IncidentTimelineFilter>("all")
  const [copyMessage, setCopyMessage] = useState("")
  const filteredIncidents = useMemo(() => getFilteredIncidentTimeline(incidents, filter), [filter, incidents])

  const copySummary = async () => {
    await navigator.clipboard.writeText(summaryText)
    setCopyMessage("Client summary copied.")
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.75fr_1fr] print:break-inside-avoid">
      <Card className="print:break-inside-avoid">
        <CardHeader>
          <CardTitle>Client summary</CardTitle>
          <CardDescription>Plain-language proof text for emails, status notes, and handoff docs.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="rounded-lg border bg-muted/20 p-3 text-sm leading-6 text-muted-foreground">{summaryText}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={copySummary}>
              Copy client summary
            </Button>
            {copyMessage ? <span className="text-xs text-muted-foreground">{copyMessage}</span> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="print:break-inside-avoid">
        <CardHeader>
          <CardTitle>Incident timeline</CardTitle>
          <CardDescription>{activeAlertCount} active alerts in this report period</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-2 print:hidden">
            {(["all", "active", "resolved"] as IncidentTimelineFilter[]).map((item) => (
              <Button key={item} variant={filter === item ? "default" : "outline"} size="sm" onClick={() => setFilter(item)}>
                {item === "all" ? "All incidents" : item === "active" ? "Active only" : "Resolved only"}
              </Button>
            ))}
          </div>
          {filteredIncidents.length ? (
            filteredIncidents.map((alert) => (
              <div key={alert.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{alert.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {alert.nodeLabel ?? "Project"} / {formatDateTime(alert.createdAt)}
                      {alert.resolvedAt ? ` / resolved ${formatDateTime(alert.resolvedAt)}` : ""}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{alert.message}</p>
                  </div>
                  <Badge variant={alert.status === "resolved" ? "secondary" : "destructive"}>
                    {alert.status === "resolved" ? "resolved" : alert.severity.toLowerCase()}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No {filter === "all" ? "" : `${filter} `}alert events have been recorded for this report.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
