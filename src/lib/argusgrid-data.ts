import {
  Bot,
  CalendarClock,
  Cloud,
  Database,
  GitBranch,
  HardDrive,
  Mail,
  MessageSquare,
  RadioTower,
  Server,
  ShieldCheck,
  SquareActivity,
  Webhook,
} from "lucide-react"

export type NodeStatus = "active" | "degraded" | "down" | "unknown"
export type IconKind =
  | "ai"
  | "gmail"
  | "webhook"
  | "database"
  | "vector"
  | "scheduler"
  | "slack"
  | "crm"
  | "storage"
  | "api"
  | "security"
  | "workflow"

export type EndpointMetric = {
  label: string
  value: string
  delta: string
  tone: "good" | "warn" | "bad" | "neutral"
}

export type EndpointRun = {
  id: string
  status: "success" | "degraded" | "failed"
  started: string
  latency: string
  cost: string
  quality: string
}

export type EndpointAlert = {
  title: string
  severity: "info" | "warning" | "critical"
  time: string
}

export type EndpointNodeData = {
  id: string
  label: string
  description: string
  icon: IconKind
  status: NodeStatus
  statusReason: string
  override?: NodeStatus
  category: string
  customIconUrl?: string
  apiUrl: string
  cadence: string
  auth: string
  position: { x: number; y: number }
  metrics: EndpointMetric[]
  runs: EndpointRun[]
  alerts: EndpointAlert[]
  latencySeries: number[]
  costSeries: number[]
  qualitySeries: number[]
  heatmap: number[][]
  parameters: {
    label: string
    path: string
    transform: string
    unit: string
  }[]
}

export const statusCopy: Record<NodeStatus, string> = {
  active: "Active",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
}

export const statusStyles: Record<NodeStatus, string> = {
  active:
    "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-[0_0_26px_rgba(16,185,129,0.28)] dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-300",
  degraded:
    "border-amber-300 bg-amber-50 text-amber-700 shadow-[0_0_26px_rgba(245,158,11,0.28)] dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-300",
  down:
    "border-rose-300 bg-rose-50 text-rose-700 shadow-[0_0_26px_rgba(244,63,94,0.28)] dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-300",
  unknown:
    "border-slate-300 bg-slate-50 text-slate-600 shadow-[0_0_18px_rgba(100,116,139,0.18)] dark:border-slate-500/50 dark:bg-slate-500/10 dark:text-slate-300",
}

export const iconRegistry = {
  ai: Bot,
  gmail: Mail,
  webhook: Webhook,
  database: Database,
  vector: GitBranch,
  scheduler: CalendarClock,
  slack: MessageSquare,
  crm: RadioTower,
  storage: HardDrive,
  api: Server,
  security: ShieldCheck,
  workflow: SquareActivity,
  cloud: Cloud,
}

export const projectCategories = [
  "Execution Health",
  "Cost & Usage",
  "Performance",
  "Quality & Evals",
  "Data Freshness",
  "Agent/Tool Behavior",
  "Alerts & Incidents",
  "Security & Compliance",
  "Team Operations",
  "ROI",
]

export const endpointNodes: EndpointNodeData[] = [
  {
    id: "ai-agent",
    label: "AI Agent",
    description: "Primary customer support automation run loop.",
    icon: "ai",
    status: "active",
    statusReason: "Last poll passed 2 minutes ago.",
    category: "Execution Health",
    apiUrl: "https://api.example.com/agents/support/runs",
    cadence: "Every 5 min",
    auth: "Bearer token",
    position: { x: 130, y: 170 },
    metrics: [
      { label: "Success rate", value: "98.6%", delta: "+1.4%", tone: "good" },
      { label: "Avg latency", value: "1.8s", delta: "-220ms", tone: "good" },
      { label: "Cost today", value: "$18.42", delta: "+6.1%", tone: "neutral" },
      { label: "Eval score", value: "94.1", delta: "+2.0", tone: "good" },
    ],
    runs: [
      { id: "run_8831", status: "success", started: "11:42", latency: "1.6s", cost: "$0.042", quality: "96" },
      { id: "run_8830", status: "success", started: "11:37", latency: "1.9s", cost: "$0.038", quality: "94" },
      { id: "run_8829", status: "degraded", started: "11:31", latency: "3.8s", cost: "$0.061", quality: "88" },
    ],
    alerts: [{ title: "Latency p95 crossed soft threshold", severity: "warning", time: "18 min ago" }],
    latencySeries: [2.2, 2.0, 1.9, 2.6, 1.8, 1.7, 1.8],
    costSeries: [12, 14, 13, 18, 16, 17, 18.4],
    qualitySeries: [91, 92, 93, 91, 94, 95, 94],
    heatmap: [[0, 0, 2], [1, 0, 4], [2, 0, 3], [3, 0, 8], [4, 0, 5], [5, 0, 2]],
    parameters: [
      { label: "Run count", path: "$.summary.runs", transform: "number", unit: "runs" },
      { label: "Token spend", path: "$.usage.total_tokens", transform: "divide:1000", unit: "k tokens" },
      { label: "Eval score", path: "$.quality.overall", transform: "round:1", unit: "score" },
    ],
  },
  {
    id: "gmail",
    label: "Gmail Inbox",
    description: "Inbound email trigger for automated ticket creation.",
    icon: "gmail",
    status: "degraded",
    statusReason: "OAuth refresh succeeded but freshness is 18 minutes behind.",
    category: "Data Freshness",
    apiUrl: "https://gmail.googleapis.com/gmail/v1/users/me/messages",
    cadence: "Every 10 min",
    auth: "Bearer token",
    position: { x: 390, y: 105 },
    metrics: [
      { label: "Unread queue", value: "42", delta: "+9", tone: "warn" },
      { label: "Freshness", value: "18m", delta: "+11m", tone: "warn" },
      { label: "Errors", value: "2", delta: "+2", tone: "warn" },
      { label: "Throughput", value: "312/h", delta: "-4%", tone: "neutral" },
    ],
    runs: [
      { id: "mail_112", status: "degraded", started: "11:40", latency: "4.2s", cost: "$0.000", quality: "91" },
      { id: "mail_111", status: "success", started: "11:30", latency: "2.4s", cost: "$0.000", quality: "93" },
      { id: "mail_110", status: "success", started: "11:20", latency: "2.1s", cost: "$0.000", quality: "92" },
    ],
    alerts: [{ title: "Mailbox freshness delayed", severity: "warning", time: "7 min ago" }],
    latencySeries: [2.1, 2.4, 2.2, 3.1, 4.2, 3.8, 4.0],
    costSeries: [0, 0, 0, 0, 0, 0, 0],
    qualitySeries: [92, 92, 93, 93, 91, 91, 92],
    heatmap: [[0, 0, 3], [1, 0, 5], [2, 0, 9], [3, 0, 10], [4, 0, 4], [5, 0, 2]],
    parameters: [
      { label: "Unread messages", path: "$.resultSizeEstimate", transform: "number", unit: "messages" },
      { label: "Oldest age", path: "$.messages[0].internalDate", transform: "age_minutes", unit: "min" },
    ],
  },
  {
    id: "vector-db",
    label: "Vector DB",
    description: "Retrieval index for support knowledge and policies.",
    icon: "vector",
    status: "active",
    statusReason: "Query latency and index freshness are within targets.",
    category: "Performance",
    apiUrl: "https://api.example.com/vector/index/stats",
    cadence: "Every 15 min",
    auth: "API key header",
    position: { x: 650, y: 220 },
    metrics: [
      { label: "p95 query", value: "148ms", delta: "-18ms", tone: "good" },
      { label: "Index age", value: "31m", delta: "-8m", tone: "good" },
      { label: "Recall eval", value: "91.8", delta: "+0.8", tone: "good" },
      { label: "Storage", value: "18.2GB", delta: "+0.4GB", tone: "neutral" },
    ],
    runs: [
      { id: "idx_731", status: "success", started: "11:30", latency: "144ms", cost: "$0.004", quality: "92" },
      { id: "idx_730", status: "success", started: "11:15", latency: "151ms", cost: "$0.004", quality: "91" },
      { id: "idx_729", status: "success", started: "11:00", latency: "149ms", cost: "$0.004", quality: "92" },
    ],
    alerts: [],
    latencySeries: [171, 164, 155, 152, 151, 149, 148],
    costSeries: [5.2, 5.4, 5.3, 5.6, 5.7, 5.8, 5.9],
    qualitySeries: [89, 90, 91, 91, 92, 92, 92],
    heatmap: [[0, 0, 1], [1, 0, 2], [2, 0, 2], [3, 0, 3], [4, 0, 2], [5, 0, 1]],
    parameters: [
      { label: "Query p95", path: "$.latency.p95_ms", transform: "number", unit: "ms" },
      { label: "Recall", path: "$.evals.recall", transform: "percent", unit: "%" },
    ],
  },
]

export const endpointNodeExtras: EndpointNodeData[] = [
  {
    ...endpointNodes[0],
    id: "crm",
    label: "CRM Sync",
    description: "Customer handoff and account enrichment endpoint.",
    icon: "crm",
    status: "down",
    statusReason: "Latest health check returned 503.",
    override: "degraded",
    category: "Alerts & Incidents",
    apiUrl: "https://api.example.com/crm/sync/health",
    auth: "Custom headers",
    position: { x: 880, y: 120 },
    metrics: [
      { label: "Availability", value: "92.4%", delta: "-6.8%", tone: "bad" },
      { label: "Failed syncs", value: "17", delta: "+17", tone: "bad" },
      { label: "Backlog", value: "128", delta: "+44", tone: "warn" },
      { label: "MTTR", value: "24m", delta: "+9m", tone: "warn" },
    ],
    alerts: [
      { title: "CRM endpoint unavailable", severity: "critical", time: "4 min ago" },
      { title: "Admin override active: degraded", severity: "info", time: "3 min ago" },
    ],
    latencySeries: [2.1, 2.5, 3.2, 5.4, 8.1, 10, 10],
    qualitySeries: [88, 86, 83, 78, 74, 0, 0],
    heatmap: [[0, 0, 1], [1, 0, 4], [2, 0, 7], [3, 0, 11], [4, 0, 13], [5, 0, 17]],
  },
  {
    ...endpointNodes[0],
    id: "scheduler",
    label: "Scheduler",
    description: "Cron and queue trigger monitor.",
    icon: "scheduler",
    status: "active",
    statusReason: "All scheduled jobs fired within expected windows.",
    category: "Team Operations",
    apiUrl: "https://api.example.com/scheduler/jobs",
    cadence: "Every 15 min",
    position: { x: 255, y: 375 },
    metrics: [
      { label: "Jobs due", value: "9", delta: "-2", tone: "neutral" },
      { label: "Drift", value: "3s", delta: "-5s", tone: "good" },
      { label: "Failures", value: "0", delta: "0", tone: "good" },
      { label: "Queue wait", value: "19s", delta: "+3s", tone: "neutral" },
    ],
    alerts: [],
    latencySeries: [22, 20, 18, 21, 16, 18, 19],
    qualitySeries: [100, 100, 100, 100, 100, 100, 100],
    heatmap: [[0, 0, 0], [1, 0, 1], [2, 0, 0], [3, 0, 1], [4, 0, 0], [5, 0, 0]],
  },
  {
    ...endpointNodes[0],
    id: "slack",
    label: "Slack Alerts",
    description: "Team notification and incident routing channel.",
    icon: "slack",
    status: "active",
    statusReason: "Notification route acknowledged latest delivery.",
    category: "Alerts & Incidents",
    apiUrl: "https://slack.com/api/chat.postMessage",
    cadence: "Event driven",
    position: { x: 590, y: 430 },
    metrics: [
      { label: "Deliveries", value: "28", delta: "+4", tone: "neutral" },
      { label: "Ack rate", value: "96%", delta: "+3%", tone: "good" },
      { label: "Escalations", value: "1", delta: "0", tone: "neutral" },
      { label: "Noise score", value: "12", delta: "-5", tone: "good" },
    ],
    alerts: [{ title: "Critical CRM alert delivered to #ai-ops", severity: "info", time: "4 min ago" }],
    latencySeries: [420, 390, 370, 450, 410, 360, 390],
    qualitySeries: [94, 95, 95, 96, 95, 97, 96],
    heatmap: [[0, 0, 2], [1, 0, 1], [2, 0, 1], [3, 0, 3], [4, 0, 1], [5, 0, 0]],
  },
]

export const allEndpointNodes = endpointNodes.concat(endpointNodeExtras)

export const graphEdges = [
  { id: "edge-mail-agent", source: "gmail", target: "ai-agent", label: "incoming context" },
  { id: "edge-agent-vector", source: "ai-agent", target: "vector-db", label: "retrieval" },
  { id: "edge-agent-crm", source: "ai-agent", target: "crm", label: "handoff" },
  { id: "edge-scheduler-agent", source: "scheduler", target: "ai-agent", label: "scheduled run" },
  { id: "edge-crm-slack", source: "crm", target: "slack", label: "incident notify" },
]

export const projectSummary = {
  organization: "Northstar AI Ops",
  project: "Support Automation Grid",
  uptime: "97.8%",
  activeNodes: 4,
  degradedNodes: 1,
  downNodes: 1,
  spendToday: "$23.92",
  evalAverage: "91.4",
}
