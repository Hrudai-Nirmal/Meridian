import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { buildClientReportSummary, formatReportComparisonBadge } from "@/lib/report-client-proof.mjs"
import { getPublicReport } from "@/lib/reports"
import { ReportClientProof } from "./report-client-proof"
import { PrintReportButton } from "./print-report-button"

type ReportComparisonTone = "good" | "bad" | "neutral"

function formatDateTime(value: string | null) {
  if (!value) return "No data yet"
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 3,
  }).format(value)
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en").format(value)
}

function statusVariant(status: string): "secondary" | "destructive" | "outline" {
  if (status === "DOWN") return "destructive"
  if (status === "DEGRADED") return "secondary"
  return "outline"
}

function comparisonVariant(tone: ReportComparisonTone): "secondary" | "destructive" | "outline" {
  if (tone === "good") return "secondary"
  if (tone === "bad") return "destructive"
  return "outline"
}

export default async function ReportPage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params
  const report = await getPublicReport(shareToken)

  if (!report) notFound()

  const metricCards = [
    { label: "Automation uptime", value: `${report.summary.uptimePercent}%`, note: "Active nodes / total nodes", comparison: null },
    {
      label: "Workflow runs",
      value: formatInteger(report.summary.totalRuns),
      note: "Submitted runs in period",
      comparison: report.comparison ? formatReportComparisonBadge({ current: report.summary.totalRuns, previous: report.comparison.summary.totalRuns, higherIsBetter: true }) : null,
    },
    {
      label: "Success rate",
      value: `${report.summary.successRate}%`,
      note: "Successful runs / total runs",
      comparison: report.comparison ? formatReportComparisonBadge({ current: report.summary.successRate, previous: report.comparison.summary.successRate, unit: " pts", higherIsBetter: true }) : null,
    },
    {
      label: "AI value score",
      value: `${report.summary.qualityScore}`,
      note: "Success and uptime blend",
      comparison: report.comparison ? formatReportComparisonBadge({ current: report.summary.qualityScore, previous: report.comparison.summary.qualityScore, unit: " pts", higherIsBetter: true }) : null,
    },
    {
      label: "Tracked spend",
      value: formatCurrency(report.summary.totalCostUsd),
      note: "Reported workflow cost",
      comparison: report.comparison ? formatReportComparisonBadge({ current: report.summary.totalCostUsd, previous: report.comparison.summary.totalCostUsd }) : null,
    },
    {
      label: "Token usage",
      value: formatInteger(report.summary.totalTokens),
      note: "Reported LLM tokens",
      comparison: report.comparison ? formatReportComparisonBadge({ current: report.summary.totalTokens, previous: report.comparison.summary.totalTokens }) : null,
    },
  ]
  const clientSummary = buildClientReportSummary(report)
  const executiveStatus =
    report.summary.activeAlerts > 0
      ? "Needs attention"
      : report.summary.downNodes > 0
        ? "Service risk"
        : report.summary.uptimePercent >= 80
          ? "Healthy"
          : "Review recommended"

  return (
    <main className="min-h-screen bg-zinc-100 text-foreground dark:bg-zinc-950 print:bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between print:break-after-avoid">
          <div>
            {report.brandImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Report brand images are uploaded report assets served from a protected report route.
              <img src={report.brandImageUrl} alt="Report brand" className="mb-4 max-h-14 max-w-64 object-contain object-left" />
            ) : null}
            <div className="text-sm font-medium text-muted-foreground">Meridian client report</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{report.title}</h1>
            {report.subtitle ? <div className="mt-2 text-base text-muted-foreground">{report.subtitle}</div> : null}
            <p className="mt-2 text-sm text-muted-foreground">
              {report.clientName ? `${report.clientName} / ` : ""}
              {report.organizationName} / {report.projectName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Reporting period: <span className="font-medium text-foreground">{report.period.label}</span>
              {report.comparison ? ` / compared with ${report.comparison.label}` : ""}
            </p>
            {report.preparedBy ? <p className="mt-1 text-sm text-muted-foreground">Prepared by {report.preparedBy}</p> : null}
          </div>
          <div className="grid gap-2">
            <div className="rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground">
              Generated {formatDateTime(report.generatedAt)}
            </div>
            <PrintReportButton />
          </div>
        </header>

        <section className="grid gap-4 rounded-xl border bg-background p-5 lg:grid-cols-[1fr_auto] lg:items-center print:break-inside-avoid">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={executiveStatus === "Healthy" ? "secondary" : "destructive"}>{executiveStatus}</Badge>
              <Badge variant="outline">{report.nodes.length} monitored nodes</Badge>
              <Badge variant="outline">{report.period.label}</Badge>
              <Badge variant="outline">Latest sample {formatDateTime(report.summary.latestSampleAt)}</Badge>
            </div>
            <h2 className="mt-4 text-xl font-semibold">Executive summary</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {report.executiveNote ?? "This report summarizes automation reliability, workflow volume, AI usage, cost, and open incidents for the selected project."}
              It is read-only and does not include credentials, ingestion tokens, team membership details, or private endpoint secrets.
            </p>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <span className="font-medium text-foreground">{report.summary.activeAlerts}</span> active alerts
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <span className="font-medium text-foreground">{report.summary.degradedNodes}</span> degraded nodes
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <span className="font-medium text-foreground">{report.summary.downNodes}</span> down nodes
            </div>
          </div>
        </section>

        {report.mapImageUrl ? (
          <section className="rounded-xl border bg-background p-5 print:break-inside-avoid">
            <div className="mb-3">
              <h2 className="text-xl font-semibold">Automation map</h2>
              <p className="mt-1 text-sm text-muted-foreground">Visual overview of the monitored workflow components included in this report.</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- Report maps are user-generated PNG attachments served from a protected report route. */}
            <img src={report.mapImageUrl} alt="Meridian automation map" className="max-h-[680px] w-full rounded-lg border object-contain" />
          </section>
        ) : null}

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6 print:break-inside-avoid">
          {metricCards.map((metric) => (
            <Card key={metric.label} className="print:break-inside-avoid">
              <CardHeader className="pb-2">
                <CardDescription>{metric.label}</CardDescription>
                <CardTitle className="text-2xl">{metric.value}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-xs text-muted-foreground">
                <span>{metric.note}</span>
                {metric.comparison ? (
                  <Badge variant={comparisonVariant(metric.comparison.tone)} className="w-fit">
                    {metric.comparison.label}
                  </Badge>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6">
          <Card className="print:break-inside-avoid">
            <CardHeader>
              <CardTitle>Automation nodes</CardTitle>
              <CardDescription>Operational status, usage, cost, and freshness by monitored node</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Node</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Runs</th>
                    <th className="py-2 pr-3 font-medium">Success</th>
                    <th className="py-2 pr-3 font-medium">Cost</th>
                    <th className="py-2 pr-3 font-medium">Tokens</th>
                    <th className="py-2 pr-3 font-medium">Latest activity</th>
                  </tr>
                </thead>
                <tbody>
                  {report.nodes.map((node) => (
                    <tr key={node.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-3">
                        <div className="font-medium">{node.label}</div>
                        <div className="text-xs text-muted-foreground">{node.category}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant={statusVariant(node.status)}>{node.status.toLowerCase()}</Badge>
                      </td>
                      <td className="py-3 pr-3">{formatInteger(node.runCount)}</td>
                      <td className="py-3 pr-3">{node.successRate}%</td>
                      <td className="py-3 pr-3">{formatCurrency(node.costUsd)}</td>
                      <td className="py-3 pr-3">{formatInteger(node.tokens)}</td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        {formatDateTime(node.latestRunAt ?? node.latestSampleAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
        <ReportClientProof summaryText={clientSummary} incidents={report.incidentTimeline} activeAlertCount={report.summary.activeAlerts} />
      </div>
    </main>
  )
}
