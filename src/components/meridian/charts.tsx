"use client"

import ReactECharts from "echarts-for-react"

import type { EndpointNodeData } from "@/lib/meridian-data"

const axisLabel = { color: "#64748b", fontSize: 10 }
const grid = { left: 32, right: 12, top: 22, bottom: 26 }

function formatSeriesTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp))
}

export function LatencyChart({ node }: { node: EndpointNodeData }) {
  const realSeries =
    node.realRollupSeries?.find((series) => series.points.length) ??
    node.realSampleSeries?.find((series) => series.points.length)
  const xAxisData = realSeries
    ? realSeries.points.map((point) => formatSeriesTimestamp(point.timestamp))
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Now"]
  const seriesData = realSeries ? realSeries.points.map((point) => point.value) : node.latencySeries

  return (
    <ReactECharts
      className="h-44 w-full"
      option={{
        color: ["#0f766e"],
        grid,
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: xAxisData, axisLabel },
        yAxis: { type: "value", axisLabel },
        series: [
          {
            name: realSeries ? `${realSeries.label}${realSeries.unit ? ` (${realSeries.unit})` : ""}` : "Latency",
            type: "line",
            smooth: true,
            areaStyle: { opacity: 0.12 },
            data: seriesData,
          },
        ],
      }}
      notMerge
      lazyUpdate
    />
  )
}

export function CostQualityChart({ node }: { node: EndpointNodeData }) {
  return (
    <ReactECharts
      className="h-44 w-full"
      option={{
        color: ["#2563eb", "#7c3aed"],
        grid,
        tooltip: { trigger: "axis" },
        legend: { top: 0, textStyle: { color: "#64748b", fontSize: 10 } },
        xAxis: { type: "category", data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Now"], axisLabel },
        yAxis: { type: "value", axisLabel },
        series: [
          { name: "Cost", type: "bar", data: node.costSeries, barMaxWidth: 18 },
          { name: "Quality", type: "line", smooth: true, data: node.qualitySeries },
        ],
      }}
      notMerge
      lazyUpdate
    />
  )
}

export function IncidentHeatmap({ node }: { node: EndpointNodeData }) {
  return (
    <ReactECharts
      className="h-36 w-full"
      option={{
        tooltip: {},
        grid: { left: 32, right: 12, top: 8, bottom: 22 },
        xAxis: { type: "category", data: ["00", "04", "08", "12", "16", "20"], axisLabel },
        yAxis: { type: "category", data: ["Alerts"], axisLabel },
        visualMap: { show: false, min: 0, max: 18, inRange: { color: ["#ecfeff", "#facc15", "#ef4444"] } },
        series: [{ type: "heatmap", data: node.heatmap, label: { show: false } }],
      }}
      notMerge
      lazyUpdate
    />
  )
}

export function RelationshipSankey() {
  return (
    <ReactECharts
      className="h-40 w-full"
      option={{
        tooltip: { trigger: "item" },
        series: [
          {
            type: "sankey",
            layout: "none",
            emphasis: { focus: "adjacency" },
            data: [{ name: "Gmail" }, { name: "AI Agent" }, { name: "Vector DB" }, { name: "CRM" }, { name: "Slack" }],
            links: [
              { source: "Gmail", target: "AI Agent", value: 42 },
              { source: "AI Agent", target: "Vector DB", value: 38 },
              { source: "AI Agent", target: "CRM", value: 17 },
              { source: "CRM", target: "Slack", value: 6 },
            ],
          },
        ],
      }}
      notMerge
      lazyUpdate
    />
  )
}
