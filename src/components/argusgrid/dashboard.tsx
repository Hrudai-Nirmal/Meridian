"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type OnNodeDrag,
} from "@xyflow/react"
import {
  Activity,
  Bell,
  Bot,
  ChevronDown,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  FileImage,
  Gauge,
  HardDriveUpload,
  KeyRound,
  LayoutGrid,
  LayoutDashboard,
  MailCheck,
  Moon,
  Network,
  NotebookText,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Users,
  Wand2,
} from "lucide-react"
import { signOut } from "next-auth/react"
import type { Session } from "next-auth"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CostQualityChart, IncidentHeatmap, LatencyChart } from "@/components/argusgrid/charts"
import { EndpointGraphNode } from "@/components/argusgrid/endpoint-node"
import {
  allEndpointNodes,
  iconRegistry,
  statusCopy,
  type EndpointNodeData,
  type NodeStatus,
} from "@/lib/argusgrid-data"
import { integrationTemplates, type IntegrationTemplate } from "@/lib/integration-templates"
import { cn } from "@/lib/utils"
import type { WorkspacePayload } from "@/lib/workspace"

const nodeTypes = { endpoint: EndpointGraphNode }
const GRAPH_GRID_SIZE = 22

const toneClasses = {
  good: "text-emerald-600 dark:text-emerald-300",
  warn: "text-amber-600 dark:text-amber-300",
  bad: "text-rose-600 dark:text-rose-300",
  neutral: "text-muted-foreground",
}

const statusDot: Record<NodeStatus, string> = {
  active: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-rose-500",
  unknown: "bg-slate-400",
}

function toFlowNode(node: EndpointNodeData): Node {
  return {
    id: node.id,
    type: "endpoint",
    position: node.position,
    data: node as unknown as Record<string, unknown>,
  }
}

function toFlowEdge(edge: WorkspacePayload["edges"][number]): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: true,
    style: { stroke: "#38bdf8", strokeWidth: 2 },
    labelStyle: { fill: "#475569", fontSize: 11, fontWeight: 600 },
  }
}

function snapToGridPosition(position: { x: number; y: number }) {
  return {
    x: Math.round(position.x / GRAPH_GRID_SIZE) * GRAPH_GRID_SIZE,
    y: Math.round(position.y / GRAPH_GRID_SIZE) * GRAPH_GRID_SIZE,
  }
}

function formatSampledAt(timestamp: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp))
}

function runBadgeVariant(status: string): "destructive" | "secondary" | "outline" {
  if (status === "failed") return "destructive"
  if (status === "degraded") return "secondary"
  return "outline"
}

function buildIntegrationSnippet(template: IntegrationTemplate, nodeId: string) {
  const ingestUrl = "https://argusgrid.hrudainirmal.in/api/ingest/runs"

  if (template.id === "dify") {
    return `POST ${ingestUrl}
Authorization: Bearer <ingestion-token>
Content-Type: application/json

{
  "nodeId": "${nodeId}",
  "externalId": "{{workflow_run_id}}",
  "status": "{{status}}",
  "startedAt": "{{started_at}}",
  "finishedAt": "{{finished_at}}",
  "costUsd": {{total_price}},
  "tokens": {{total_tokens}},
  "steps": [
    { "name": "Dify workflow", "status": "{{status}}", "toolName": "dify" }
  ]
}`
  }

  if (template.id === "n8n") {
    return `{
  "method": "POST",
  "url": "${ingestUrl}",
  "headers": {
    "Authorization": "Bearer <ingestion-token>",
    "Content-Type": "application/json"
  },
  "body": {
    "nodeId": "${nodeId}",
    "externalId": "{{$execution.id}}",
    "status": "success",
    "startedAt": "{{$now.minus({ seconds: 5 }).toISO()}}",
    "finishedAt": "{{$now.toISO()}}",
    "steps": [
      { "name": "n8n workflow", "status": "success", "toolName": "n8n" }
    ]
  }
}`
  }

  if (template.id === "github-actions") {
    return `- name: Report workflow run to ArgusGrid
  if: always()
  shell: bash
  env:
    ARGUSGRID_TOKEN: \${{ secrets.ARGUSGRID_INGESTION_TOKEN }}
  run: |
    STATUS="success"
    if [ "\${{ job.status }}" != "success" ]; then STATUS="failed"; fi
    curl -X POST "${ingestUrl}" \\
      -H "Authorization: Bearer $ARGUSGRID_TOKEN" \\
      -H "Content-Type: application/json" \\
      -d '{
        "nodeId": "${nodeId}",
        "externalId": "\${{ github.run_id }}-\${{ github.run_attempt }}",
        "status": "'"$STATUS"'",
        "startedAt": "\${{ github.event.head_commit.timestamp }}",
        "finishedAt": "'"\$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'",
        "steps": [
          { "name": "GitHub Actions job", "status": "'"$STATUS"'", "toolName": "github-actions" }
        ]
      }'`
  }

  if (template.id === "custom-rest-metric") {
    return `Expected JSON response from your endpoint:
{
  "health": {
    "score": 92
  }
}

ArgusGrid polling preset:
Endpoint URL: https://api.example.com/automation/health
JSONPath: $.health.score
Transform: none
Unit: score
Threshold: < 70`
  }

  return `curl -X POST "${ingestUrl}" \\
  -H "Authorization: Bearer <ingestion-token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "nodeId": "${nodeId}",
    "externalId": "run_001",
    "status": "success",
    "startedAt": "2026-06-12T09:30:00.000Z",
    "finishedAt": "2026-06-12T09:30:02.400Z",
    "costUsd": 0.042,
    "tokens": 1280,
    "steps": [
      { "name": "Fetch context", "status": "success", "latencyMs": 420, "toolName": "database" },
      { "name": "Generate response", "status": "success", "latencyMs": 1700, "toolName": "llm" }
    ]
  }'`
}

type SaveState = "saved" | "saving" | "error"
type ProjectMode = "blank" | "demo"
type ProjectAlert = WorkspacePayload["alerts"][number]
type ProjectAlertRule = WorkspacePayload["alertRules"][number]
type AlertTimelineFilter = "24h" | "7d" | "30d" | "all"
type LiveConnectionState = "connecting" | "live" | "reconnecting" | "manual"
type DashboardSection = "control-room" | "projects" | "map" | "runs" | "alerts" | "reports" | "integrations" | "team" | "settings"
type IngestionTokenRecord = {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}
type ReportShareRecord = {
  id: string
  title: string
  clientName: string | null
  url: string
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

type ProjectRunRecord = EndpointNodeData["runs"][number] & {
  nodeId: string
  nodeLabel: string
}

type ProjectMetricRecord = NonNullable<EndpointNodeData["realMetrics"]>[number] & {
  nodeId: string
  nodeLabel: string
}

type ProjectLiveEvent = {
  type: "connected" | "heartbeat" | "refresh"
  projectId: string
  cursor: string
  changed: string[]
  checkedAt: string
}

const dashboardSections: {
  id: DashboardSection
  label: string
  title: string
  description: string
  icon: typeof Bot
}[] = [
  {
    id: "control-room",
    label: "Control Room",
    title: "Control Room",
    description: "Live operating picture for reliability, value, and client proof.",
    icon: LayoutDashboard,
  },
  {
    id: "projects",
    label: "Projects",
    title: "Projects",
    description: "Choose, create, rename, and archive client workspaces.",
    icon: LayoutGrid,
  },
  {
    id: "map",
    label: "Automation Map",
    title: "Automation Map",
    description: "Graph-first dependency canvas for monitored AI workflows.",
    icon: Network,
  },
  {
    id: "runs",
    label: "Runs",
    title: "Runs",
    description: "Workflow execution telemetry across the current project.",
    icon: Activity,
  },
  {
    id: "alerts",
    label: "Alerts",
    title: "Alerts",
    description: "Active incidents, resolved alerts, and notification status.",
    icon: Bell,
  },
  {
    id: "reports",
    label: "Reports",
    title: "Client Reports",
    description: "Secure read-only proof links for agency stakeholders.",
    icon: NotebookText,
  },
  {
    id: "integrations",
    label: "Integrations",
    title: "Integrations",
    description: "Focused setup paths for Dify, n8n, GitHub Actions, and REST metrics.",
    icon: Wand2,
  },
  {
    id: "team",
    label: "Team",
    title: "Team",
    description: "Members, pending invitations, and role controls.",
    icon: Users,
  },
  {
    id: "settings",
    label: "Settings",
    title: "Settings",
    description: "Deployment readiness, polling, email, and telemetry tokens.",
    icon: Settings,
  },
]

const alertTimelineWindows: Record<Exclude<AlertTimelineFilter, "all">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
}

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark"
  const storedTheme = window.localStorage.getItem("argusgrid-theme")
  return storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark"
}

function getInitialLiveConnectionState(): LiveConnectionState {
  if (typeof window === "undefined") return "connecting"
  return typeof window.EventSource === "undefined" ? "manual" : "connecting"
}

function parseProjectLiveEvent(event: MessageEvent<string>) {
  try {
    return JSON.parse(event.data) as ProjectLiveEvent
  } catch {
    return null
  }
}

function parseCurrencyValue(value?: string | null) {
  if (!value) return 0
  const parsed = Number(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

export function ArgusGridDashboard({
  initialWorkspace,
  currentUser,
}: {
  initialWorkspace: WorkspacePayload
  currentUser: NonNullable<Session["user"]>
}) {
  const [activeSection, setActiveSection] = useState<DashboardSection>("control-room")
  const [selectedId, setSelectedId] = useState(initialWorkspace.nodes[0]?.id ?? "")
  const [editMode, setEditMode] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme)
  const [saveState, setSaveState] = useState<SaveState>("saved")
  const [newProjectName, setNewProjectName] = useState("New AI workflow")
  const [newProjectMode, setNewProjectMode] = useState<ProjectMode>("blank")
  const [editingProject, setEditingProject] = useState<WorkspacePayload["projects"][number] | null>(null)
  const [editingProjectName, setEditingProjectName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("MEMBER")
  const [teamMessage, setTeamMessage] = useState("")
  const [actionMessage, setActionMessage] = useState("")
  const [members, setMembers] = useState(initialWorkspace.members)
  const [invitations, setInvitations] = useState(initialWorkspace.invitations)
  const [alerts, setAlerts] = useState(initialWorkspace.alerts)
  const [alertRules, setAlertRules] = useState(initialWorkspace.alertRules)
  const [alertStatusFilter, setAlertStatusFilter] = useState<"active" | "resolved" | "all">("active")
  const [alertSeverityFilter, setAlertSeverityFilter] = useState("all")
  const [alertTimelineFilter, setAlertTimelineFilter] = useState<AlertTimelineFilter>("7d")
  const [alertTimelineReferenceTime, setAlertTimelineReferenceTime] = useState(() => new Date().getTime())
  const [selectedAlertDetail, setSelectedAlertDetail] = useState<ProjectAlert | null>(null)
  const [emailEnabled, setEmailEnabled] = useState(initialWorkspace.notificationPreference.enabled)
  const [emailSeverity, setEmailSeverity] = useState(initialWorkspace.notificationPreference.severity)
  const [emailMessage, setEmailMessage] = useState("")
  const [latestPoll, setLatestPoll] = useState(initialWorkspace.diagnostics.latestPoll)
  const [latestEmail, setLatestEmail] = useState(initialWorkspace.diagnostics.latestEmail)
  const [pollMessage, setPollMessage] = useState("")
  const [isRefreshingProject, setIsRefreshingProject] = useState(false)
  const [liveConnectionState, setLiveConnectionState] = useState<LiveConnectionState>(getInitialLiveConnectionState)
  const [liveCheckedAt, setLiveCheckedAt] = useState<string | null>(null)
  const [liveChangedAreas, setLiveChangedAreas] = useState<string[]>([])
  const [iconMessage, setIconMessage] = useState("")
  const [ingestionTokens, setIngestionTokens] = useState<IngestionTokenRecord[]>([])
  const [ingestionTokenName, setIngestionTokenName] = useState("Workflow telemetry token")
  const [ingestionTokenMessage, setIngestionTokenMessage] = useState("")
  const [generatedIngestionToken, setGeneratedIngestionToken] = useState("")
  const [reportShares, setReportShares] = useState<ReportShareRecord[]>([])
  const [reportTitle, setReportTitle] = useState("Client automation report")
  const [reportClientName, setReportClientName] = useState("")
  const [reportExpiryDays, setReportExpiryDays] = useState("90")
  const [reportMessage, setReportMessage] = useState("")
  const [nodes, setNodes, onNodesChange] = useNodesState(initialWorkspace.nodes.map(toFlowNode))
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialWorkspace.edges.map(toFlowEdge))
  const didMountRef = useRef(false)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const liveReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const liveEventSourceRef = useRef<EventSource | null>(null)
  const liveRefreshInFlightRef = useRef(false)
  const iconInputRef = useRef<HTMLInputElement | null>(null)
  const canManageOrganization = initialWorkspace.currentUserRole === "OWNER" || initialWorkspace.currentUserRole === "ADMIN"
  const canEditProject = canManageOrganization || initialWorkspace.currentUserRole === "MEMBER"
  const activeSectionMeta = dashboardSections.find((section) => section.id === activeSection) ?? dashboardSections[0]

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  const selectedNode = useMemo<EndpointNodeData | undefined>(
    () => (nodes.find((node) => node.id === selectedId)?.data as unknown as EndpointNodeData | undefined) ?? initialWorkspace.nodes[0],
    [initialWorkspace.nodes, nodes, selectedId]
  )
  const statusCounts = useMemo(() => {
    const values = nodes.map((node) => node.data as unknown as EndpointNodeData)
    return {
      active: values.filter((node) => (node.override ?? node.status) === "active").length,
      degraded: values.filter((node) => (node.override ?? node.status) === "degraded").length,
      down: values.filter((node) => (node.override ?? node.status) === "down").length,
    }
  }, [nodes])
  const endpointNodes = useMemo(
    () => nodes.map((node) => node.data as unknown as EndpointNodeData),
    [nodes]
  )
  const activeAlerts = useMemo(() => alerts.filter((alert) => !alert.resolvedAt), [alerts])
  const projectRuns = useMemo<ProjectRunRecord[]>(
    () =>
      endpointNodes
        .flatMap((node) =>
          node.runs.map((run) => ({
            ...run,
            nodeId: node.id,
            nodeLabel: node.label,
          }))
        )
        .sort((a, b) => {
          const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0
          const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0
          return bTime - aTime
        }),
    [endpointNodes]
  )
  const projectMetrics = useMemo<ProjectMetricRecord[]>(
    () =>
      endpointNodes.flatMap((node) =>
        (node.realMetrics ?? []).map((metric) => ({
          ...metric,
          nodeId: node.id,
          nodeLabel: node.label,
        }))
      ),
    [endpointNodes]
  )
  const projectSummary = useMemo(() => {
    const persistedRuns = projectRuns.filter((run) => run.startedAt)
    const failedRuns = projectRuns.filter((run) => run.status === "failed" || run.status === "degraded")
    const successRuns = projectRuns.filter((run) => run.status === "success").length
    const successRate = projectRuns.length ? Math.round((successRuns / projectRuns.length) * 100) : null
    const totalCost = projectRuns.reduce((sum, run) => sum + parseCurrencyValue(run.cost), 0)
    const latestSampledAt = projectMetrics
      .map((metric) => new Date(metric.sampledAt).getTime())
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0]

    return {
      persistedRuns,
      failedRuns,
      successRate,
      totalCost,
      latestSampledAt: latestSampledAt ? new Date(latestSampledAt).toISOString() : null,
      staleNodes: endpointNodes.filter((node) => node.freshnessLabel?.toLowerCase().includes("stale")),
    }
  }, [endpointNodes, projectMetrics, projectRuns])
  const filteredAlerts = useMemo(
    () => {
      const cutoff =
        alertTimelineFilter === "all" ? null : alertTimelineReferenceTime - alertTimelineWindows[alertTimelineFilter]
      return alerts.filter((alert) => {
        if (alertStatusFilter === "active" && alert.resolvedAt) return false
        if (alertStatusFilter === "resolved" && !alert.resolvedAt) return false
        if (alertSeverityFilter !== "all" && alert.severity !== alertSeverityFilter) return false
        if (cutoff && new Date(alert.createdAt).getTime() < cutoff) return false
        return true
      })
    },
    [alertSeverityFilter, alertStatusFilter, alertTimelineFilter, alertTimelineReferenceTime, alerts]
  )

  const changeAlertTimelineFilter = (value: AlertTimelineFilter) => {
    setAlertTimelineFilter(value)
    setAlertTimelineReferenceTime(new Date().getTime())
  }

  const refreshProjectData = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) {
      setIsRefreshingProject(true)
      setActionMessage("Refreshing project telemetry...")
    }
    try {
      const response = await fetch(`/api/projects/${initialWorkspace.project.id}`)
      const payload = (await response.json()) as WorkspacePayload & { error?: string }

      if (!response.ok) {
        if (!options.silent) setActionMessage(payload.error ?? "Could not refresh project telemetry.")
        return
      }

      const freshNodes = new Map(payload.nodes.map((node) => [node.id, node]))
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const freshNode = freshNodes.get(node.id)
          if (!freshNode) return node
          return {
            ...node,
            data: { ...freshNode, position: node.position } as unknown as Record<string, unknown>,
          }
        })
      )
      setAlerts(payload.alerts)
      setAlertRules(payload.alertRules)
      setLatestPoll(payload.diagnostics.latestPoll)
      setLatestEmail(payload.diagnostics.latestEmail)
      if (!options.silent) setActionMessage("Project telemetry refreshed.")
    } catch {
      if (!options.silent) setActionMessage("Could not refresh project telemetry.")
    } finally {
      if (!options.silent) setIsRefreshingProject(false)
    }
  }, [initialWorkspace.project.id, setNodes])

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.EventSource === "undefined") {
      return
    }

    let closed = false

    const closeCurrentSource = () => {
      liveEventSourceRef.current?.close()
      liveEventSourceRef.current = null
    }

    const scheduleReconnect = () => {
      if (closed) return
      setLiveConnectionState("reconnecting")
      closeCurrentSource()
      if (liveReconnectTimerRef.current) clearTimeout(liveReconnectTimerRef.current)
      liveReconnectTimerRef.current = setTimeout(connect, 2_000)
    }

    const handleLiveEvent = (event: MessageEvent<string>, shouldRefresh: boolean) => {
      const payload = parseProjectLiveEvent(event)
      if (!payload || payload.projectId !== initialWorkspace.project.id) return
      setLiveConnectionState("live")
      setLiveCheckedAt(payload.checkedAt)
      if (payload.changed.length) setLiveChangedAreas(payload.changed)
      if (!shouldRefresh || liveRefreshInFlightRef.current) return

      liveRefreshInFlightRef.current = true
      refreshProjectData({ silent: true })
        .catch(() => setLiveConnectionState("reconnecting"))
        .finally(() => {
          liveRefreshInFlightRef.current = false
        })
    }

    function connect() {
      if (closed) return
      setLiveConnectionState((state) => (state === "live" ? "reconnecting" : "connecting"))
      const source = new EventSource(`/api/projects/${initialWorkspace.project.id}/events`)
      liveEventSourceRef.current = source
      source.addEventListener("connected", (event) => handleLiveEvent(event as MessageEvent<string>, false))
      source.addEventListener("heartbeat", (event) => handleLiveEvent(event as MessageEvent<string>, false))
      source.addEventListener("refresh", (event) => handleLiveEvent(event as MessageEvent<string>, true))
      source.onerror = scheduleReconnect
    }

    connect()

    return () => {
      closed = true
      if (liveReconnectTimerRef.current) clearTimeout(liveReconnectTimerRef.current)
      closeCurrentSource()
    }
  }, [initialWorkspace.project.id, refreshProjectData])

  const persistGraph = useCallback(async () => {
    setSaveState("saving")

    const response = await fetch(`/api/projects/${initialWorkspace.project.id}/graph`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodes: nodes.map((node) => {
          const data = node.data as unknown as EndpointNodeData

          return {
            id: node.id,
            label: data.label,
            description: data.description,
            icon: data.icon,
            status: data.status,
            statusReason: data.statusReason,
            override: data.override ?? null,
            category: data.category,
            apiUrl: data.apiUrl,
            cadence: data.cadence,
            auth: data.auth,
            position: node.position,
          }
        }),
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: typeof edge.label === "string" ? edge.label : "visual link",
        })),
      }),
    })

    if (!response.ok) {
      throw new Error("Autosave failed")
    }

    setSaveState("saved")
  }, [edges, initialWorkspace.project.id, nodes])

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }

    setSaveState("saving")
    autosaveTimerRef.current = setTimeout(() => {
      persistGraph().catch(() => setSaveState("error"))
    }, 800)

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [edges, nodes, persistGraph])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!editMode) return
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            animated: true,
            label: "visual link",
            style: { stroke: "#38bdf8", strokeWidth: 2 },
          },
          currentEdges
        )
      )
    },
    [editMode, setEdges]
  )

  const onNodeDragStop = useCallback<OnNodeDrag>(
    (_, draggedNode) => {
      if (!editMode) return
      const snappedPosition = snapToGridPosition(draggedNode.position)
      setNodes((currentNodes) =>
        currentNodes.map((node) => (node.id === draggedNode.id ? { ...node, position: snappedPosition } : node))
      )
    },
    [editMode, setNodes]
  )

  const addEndpointNode = () => {
    if (!canEditProject) {
      setActionMessage("Viewers cannot edit the project map.")
      return
    }
    const id = crypto.randomUUID()
    const seed = initialWorkspace.nodes[0] ?? allEndpointNodes[0]
    const newNode: EndpointNodeData = {
      ...seed,
      id,
      label: `Endpoint ${nodes.length + 1}`,
      description: "New user-labelled endpoint ready for API mapping.",
      icon: "api",
      status: "unknown",
      statusReason: "No poll has run yet.",
      category: "Execution Health",
      apiUrl: "https://api.example.com/new-endpoint",
      cadence: "Every 15 min",
      position: { x: 460 + nodes.length * 28, y: 320 + nodes.length * 18 },
      alerts: [],
      runs: [],
      hasPersistedRuns: false,
      realMetrics: [],
      realSampleSeries: [],
      realRollupSeries: [],
      latestSampledAt: undefined,
      freshnessLabel: undefined,
    }

    setNodes((currentNodes) => currentNodes.concat(toFlowNode(newNode)))
    setSelectedId(id)
    setEditMode(true)
  }

  const createProject = async () => {
    if (!canManageOrganization) {
      setActionMessage("Only owners and admins can create projects.")
      return
    }
    setActionMessage("Creating project...")
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProjectName, mode: newProjectMode }),
    })
    const payload = await response.json()
    if (response.ok && payload.project?.id) {
      window.location.href = `/?project=${payload.project.id}`
      return
    }
    setActionMessage(payload.error ?? "Project creation failed.")
  }

  const openProjectEditor = (project: WorkspacePayload["projects"][number]) => {
    setEditingProject(project)
    setEditingProjectName(project.name)
  }

  const renameEditedProject = async () => {
    if (!editingProject) return
    if (!canManageOrganization) {
      setActionMessage("Only owners and admins can rename projects.")
      return
    }
    setActionMessage("Renaming project...")
    const response = await fetch(`/api/projects/${editingProject.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingProjectName }),
    })
    if (response.ok) {
      window.location.href = `/?project=${editingProject.id}`
      return
    }
    setActionMessage("Project rename failed.")
  }

  const archiveEditedProject = async () => {
    if (!editingProject) return
    if (!canManageOrganization) {
      setActionMessage("Only owners and admins can archive projects.")
      return
    }
    setActionMessage("Archiving project...")
    const response = await fetch(`/api/projects/${editingProject.id}`, { method: "DELETE" })
    if (response.ok) {
      window.location.href = editingProject.id === initialWorkspace.project.id ? "/" : `/?project=${initialWorkspace.project.id}`
      return
    }
    setActionMessage("Project archive failed.")
  }

  const inviteMember = async () => {
    if (!canManageOrganization) {
      setTeamMessage("Only owners and admins can invite teammates.")
      return
    }
    setTeamMessage("")
    const response = await fetch("/api/organization/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })
    setTeamMessage(response.ok ? "Invitation saved." : "Invitation failed.")
    if (response.ok) {
      const payload = await response.json()
      setInvitations((current) => [payload.invitation, ...current])
      setInviteEmail("")
    }
  }

  const updateMemberRole = async (memberId: string, role: string) => {
    setTeamMessage("Updating member...")
    const response = await fetch(`/api/organization/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setTeamMessage(payload?.error ?? "Member update failed.")
      return
    }
    setMembers((current) => current.map((member) => (member.id === memberId ? payload.member : member)))
    setTeamMessage("Member updated.")
  }

  const removeMember = async (memberId: string) => {
    setTeamMessage("Removing member...")
    const response = await fetch(`/api/organization/members/${memberId}`, { method: "DELETE" })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setTeamMessage(payload?.error ?? "Member removal failed.")
      return
    }
    setMembers((current) => current.filter((member) => member.id !== memberId))
    setTeamMessage("Member removed.")
  }

  const cancelInvitation = async (invitationId: string) => {
    setTeamMessage("Cancelling invitation...")
    const response = await fetch(`/api/organization/invitations/${invitationId}`, { method: "DELETE" })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setTeamMessage(payload?.error ?? "Invitation cancellation failed.")
      return
    }
    setInvitations((current) => current.filter((invitation) => invitation.id !== invitationId))
    setTeamMessage("Invitation cancelled.")
  }

  const saveNotificationPreference = async () => {
    setEmailMessage("Saving preference...")
    const response = await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: emailEnabled, severity: emailSeverity }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setEmailMessage(payload?.error ?? "Notification preference failed.")
      return
    }
    setEmailEnabled(payload.preference.enabled)
    setEmailSeverity(payload.preference.severity)
    setEmailMessage("Notification preference saved.")
  }

  const sendTestEmail = async () => {
    if (!canManageOrganization) {
      setEmailMessage("Only owners and admins can send test emails.")
      return
    }
    setEmailMessage("Sending test email...")
    const response = await fetch("/api/notifications/test-email", { method: "POST" })
    const payload = await response.json().catch(() => null)
    setEmailMessage(payload?.message ?? (response.ok ? "Test email sent." : "Test email failed."))
  }

  const copyText = async (value: string, successMessage: string) => {
    await navigator.clipboard.writeText(value)
    setIngestionTokenMessage(successMessage)
  }

  const loadIngestionTokens = async () => {
    if (!canManageOrganization) {
      setIngestionTokenMessage("Only owners and admins can view ingestion tokens.")
      return
    }

    setIngestionTokenMessage("Loading tokens...")
    const response = await fetch(`/api/projects/${initialWorkspace.project.id}/ingestion-tokens`)
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setIngestionTokenMessage(payload?.error ?? "Token load failed.")
      return
    }
    setIngestionTokens(payload.tokens ?? [])
    setIngestionTokenMessage("Tokens loaded.")
  }

  const createWorkflowToken = async () => {
    if (!canManageOrganization) {
      setIngestionTokenMessage("Only owners and admins can create ingestion tokens.")
      return
    }

    setIngestionTokenMessage("Creating token...")
    const response = await fetch(`/api/projects/${initialWorkspace.project.id}/ingestion-tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: ingestionTokenName }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setIngestionTokenMessage(payload?.error ?? "Token creation failed.")
      return
    }
    setGeneratedIngestionToken(payload.token)
    setIngestionTokens((current) => [payload.tokenRecord, ...current])
    setIngestionTokenMessage("Token created. Copy it now; it will not be shown again.")
  }

  const revokeWorkflowToken = async (tokenId: string) => {
    setIngestionTokenMessage("Revoking token...")
    const response = await fetch(`/api/projects/${initialWorkspace.project.id}/ingestion-tokens/${tokenId}`, { method: "DELETE" })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setIngestionTokenMessage(payload?.error ?? "Token revoke failed.")
      return
    }
    const revokedAt = new Date().toISOString()
    setIngestionTokens((current) => current.map((token) => (token.id === tokenId ? { ...token, revokedAt } : token)))
    setIngestionTokenMessage("Token revoked.")
  }

  const loadReportShares = async () => {
    if (!canManageOrganization) {
      setReportMessage("Only owners and admins can manage client reports.")
      return
    }

    setReportMessage("Loading report links...")
    const response = await fetch(`/api/projects/${initialWorkspace.project.id}/report-shares`)
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setReportMessage(payload?.error ?? "Report links failed to load.")
      return
    }
    setReportShares(payload.shares ?? [])
    setReportMessage("Report links loaded.")
  }

  const createReportShare = async () => {
    if (!canManageOrganization) {
      setReportMessage("Only owners and admins can create client reports.")
      return
    }

    setReportMessage("Creating report link...")
    const expiresInDays = reportExpiryDays.trim() ? Number(reportExpiryDays) : undefined
    const response = await fetch(`/api/projects/${initialWorkspace.project.id}/report-shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: reportTitle,
        clientName: reportClientName.trim() || undefined,
        expiresInDays: Number.isFinite(expiresInDays) ? expiresInDays : undefined,
      }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setReportMessage(payload?.error ?? "Report link creation failed.")
      return
    }
    setReportShares((current) => [payload.share, ...current])
    await navigator.clipboard.writeText(payload.share.url)
    setReportMessage("Report link created and copied.")
  }

  const revokeReportShare = async (shareId: string) => {
    setReportMessage("Revoking report link...")
    const response = await fetch(`/api/projects/${initialWorkspace.project.id}/report-shares/${shareId}`, { method: "DELETE" })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setReportMessage(payload?.error ?? "Report link revoke failed.")
      return
    }
    const revokedAt = new Date().toISOString()
    setReportShares((current) => current.map((share) => (share.id === shareId ? { ...share, revokedAt } : share)))
    setReportMessage("Report link revoked.")
  }

  const copyReportShareUrl = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setReportMessage("Report link copied.")
  }

  const runPollNow = async () => {
    if (!canManageOrganization) {
      setPollMessage("Only owners and admins can run polling manually.")
      return
    }
    setPollMessage("Running poll...")
    const response = await fetch(`/api/projects/${initialWorkspace.project.id}/poll/run`, { method: "POST" })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setPollMessage(payload?.error ?? "Manual poll failed.")
      return
    }

    setLatestPoll(payload.diagnostics?.latestPoll ?? null)
    setLatestEmail(payload.diagnostics?.latestEmail ?? latestEmail)
    if (payload.alerts) setAlerts(payload.alerts)
    if (payload.nodes) {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const updated = payload.nodes.find((candidate: EndpointNodeData) => candidate.id === node.id)
          return updated ? { ...node, data: updated as unknown as Record<string, unknown> } : node
        })
      )
    }
    setPollMessage(
      `Poll completed: ${payload.result?.sampledNodes ?? 0} nodes, ${payload.result?.createdSamples ?? 0} samples, ${payload.result?.evaluatedAlerts ?? 0} new alerts.`
    )
  }

  const exportGraphPng = () => {
    const graphNodes = nodes.map((node) => ({
      id: node.id,
      position: node.position,
      data: node.data as unknown as EndpointNodeData,
    }))

    if (!graphNodes.length) {
      setActionMessage("Add a node before exporting the map.")
      return
    }

    const nodeWidth = 220
    const nodeHeight = 86
    const padding = 96
    const minX = Math.min(...graphNodes.map((node) => node.position.x))
    const minY = Math.min(...graphNodes.map((node) => node.position.y))
    const maxX = Math.max(...graphNodes.map((node) => node.position.x + nodeWidth))
    const maxY = Math.max(...graphNodes.map((node) => node.position.y + nodeHeight))
    const width = Math.max(960, Math.ceil(maxX - minX + padding * 2))
    const height = Math.max(640, Math.ceil(maxY - minY + padding * 2 + 80))
    const canvas = document.createElement("canvas")
    const scale = 2
    canvas.width = width * scale
    canvas.height = height * scale
    const context = canvas.getContext("2d")

    if (!context) {
      setActionMessage("Map export is not available in this browser.")
      return
    }

    context.scale(scale, scale)
    context.fillStyle = "#fafafa"
    context.fillRect(0, 0, width, height)
    context.fillStyle = "#111827"
    context.font = "700 26px Arial"
    context.fillText(initialWorkspace.project.name, padding, 48)
    context.font = "400 13px Arial"
    context.fillStyle = "#6b7280"
    context.fillText("ArgusGrid AI automation control room map", padding, 72)

    const centers = new Map(graphNodes.map((node) => [
      node.id,
      {
        x: node.position.x - minX + padding + nodeWidth / 2,
        y: node.position.y - minY + padding + 80 + nodeHeight / 2,
      },
    ]))

    context.lineWidth = 2
    context.strokeStyle = "#94a3b8"
    edges.forEach((edge) => {
      const source = centers.get(edge.source)
      const target = centers.get(edge.target)
      if (!source || !target) return
      context.beginPath()
      context.moveTo(source.x, source.y)
      context.lineTo(target.x, target.y)
      context.stroke()
    })

    graphNodes.forEach((node) => {
      const x = node.position.x - minX + padding
      const y = node.position.y - minY + padding + 80
      const status = node.data.override ?? node.data.status
      const statusColor =
        status === "active" ? "#10b981" : status === "degraded" ? "#f59e0b" : status === "down" ? "#ef4444" : "#94a3b8"

      context.fillStyle = "#ffffff"
      context.strokeStyle = "#d4d4d8"
      context.lineWidth = 1
      context.beginPath()
      context.roundRect(x, y, nodeWidth, nodeHeight, 14)
      context.fill()
      context.stroke()
      context.fillStyle = statusColor
      context.beginPath()
      context.arc(x + 24, y + 28, 7, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = "#111827"
      context.font = "700 15px Arial"
      context.fillText(node.data.label.slice(0, 24), x + 42, y + 32)
      context.fillStyle = "#6b7280"
      context.font = "400 12px Arial"
      context.fillText(node.data.category.slice(0, 28), x + 42, y + 54)
      context.fillText(statusCopy[status], x + 42, y + 72)
    })

    const link = document.createElement("a")
    link.download = `${initialWorkspace.project.slug}-argusgrid-map.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
    setActionMessage("Project map exported as PNG.")
  }

  const resolveAlert = async (alertId: string) => {
    const response = await fetch(`/api/alerts/${alertId}`, { method: "PATCH" })
    if (!response.ok) return
    const resolvedAt = new Date().toISOString()
    setAlerts((currentAlerts) => currentAlerts.map((alert) => (alert.id === alertId ? { ...alert, resolvedAt } : alert)))
    setSelectedAlertDetail((alert) => (alert?.id === alertId ? { ...alert, resolvedAt } : alert))
  }

  const openAlertSource = (alert: ProjectAlert) => {
    if (!alert.nodeId) {
      setSelectedAlertDetail(alert)
      return
    }
    setSelectedId(alert.nodeId)
    setSelectedAlertDetail(null)
    setActiveSection("map")
  }

  const uploadSelectedIcon = async (file: File | undefined) => {
    if (!file || !selectedNode || !canEditProject) return
    setIconMessage("Uploading icon...")
    const formData = new FormData()
    formData.set("icon", file)
    const response = await fetch(`/api/projects/${initialWorkspace.project.id}/nodes/${selectedNode.id}/icon`, {
      method: "PUT",
      body: formData,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setIconMessage(payload?.error ?? "Icon upload failed.")
      return
    }

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== selectedNode.id) return node
        const data = node.data as unknown as EndpointNodeData
        return { ...node, data: { ...data, customIconUrl: payload.iconUrl } as unknown as Record<string, unknown> }
      })
    )
    setIconMessage("Icon uploaded.")
  }

  const setStatusOverride = (status: NodeStatus) => {
    if (!canEditProject) return
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== selectedId) return node
        const data = node.data as unknown as EndpointNodeData
        return { ...node, data: { ...data, override: status } as unknown as Record<string, unknown> }
      })
    )
  }

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light"
    setTheme(next)
    window.localStorage.setItem("argusgrid-theme", next)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:h-screen lg:min-h-[760px] lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b bg-sidebar px-4 py-4 text-sidebar-foreground lg:w-72 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-1">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Network className="size-5" />
          </div>
          <div>
            <div className="text-base font-semibold">ArgusGrid</div>
            <div className="text-xs text-muted-foreground">AI workflow monitoring</div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border bg-background/70 p-3">
          <div className="text-xs text-muted-foreground">Organization</div>
          <div className="mt-1 flex items-center justify-between gap-2 text-sm font-medium">
            {initialWorkspace.organization.name}
            <ChevronDown className="size-4 text-muted-foreground" />
          </div>
        </div>

        <div className="mt-3 rounded-xl border bg-background/70 p-3">
          <div className="text-xs text-muted-foreground">Current project</div>
          <div className="mt-1 truncate text-sm font-medium">{initialWorkspace.project.name}</div>
          <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{initialWorkspace.project.slug}</div>
        </div>

        <nav className="mt-5 grid grid-cols-2 gap-1 sm:grid-cols-4 lg:flex lg:flex-1 lg:flex-col">
          {dashboardSections.map((section) => (
            <SidebarItem
              key={section.id}
              icon={section.icon}
              active={activeSection === section.id}
              label={section.label}
              count={
                section.id === "alerts" && activeAlerts.length
                  ? String(activeAlerts.length)
                  : section.id === "runs" && projectSummary.failedRuns.length
                    ? String(projectSummary.failedRuns.length)
                    : undefined
              }
              onClick={() => {
                setActiveSection(section.id)
                if (section.id === "reports" && canManageOrganization && !reportShares.length) {
                  void loadReportShares()
                }
                if (section.id === "settings" && canManageOrganization && !ingestionTokens.length) {
                  void loadIngestionTokens()
                }
              }}
            />
          ))}
        </nav>

        <div className="hidden">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" className="mb-3 justify-start" />}>
            <Bell data-icon="inline-start" />
            Alert Center
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Project alert center</DialogTitle>
              <DialogDescription>Filter active and resolved alerts across the current project.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 sm:grid-cols-2">
              <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={alertStatusFilter} onChange={(event) => setAlertStatusFilter(event.target.value as "active" | "resolved" | "all")}>
                <option value="active">Active alerts</option>
                <option value="resolved">Resolved alerts</option>
                <option value="all">All alerts</option>
              </select>
              <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={alertSeverityFilter} onChange={(event) => setAlertSeverityFilter(event.target.value)}>
                <option value="all">All severities</option>
                <option value="INFO">Info</option>
                <option value="WARNING">Warning</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div className="max-h-96 overflow-y-auto rounded-lg border">
              {filteredAlerts.length ? (
                filteredAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-start justify-between gap-3 border-b p-3 text-sm last:border-b-0">
                    <button className="min-w-0 flex-1 text-left" onClick={() => setSelectedAlertDetail(alert)}>
                      <div className="font-medium">{alert.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {alert.nodeLabel ?? "Project"} / {alert.severity} / {alert.resolvedAt ? "Resolved" : "Active"}
                      </div>
                    </button>
                    {!alert.resolvedAt && canEditProject ? (
                      <Button variant="outline" size="sm" onClick={() => resolveAlert(alert.id)}>
                        Resolve
                      </Button>
                    ) : (
                      <Badge variant={alert.resolvedAt ? "secondary" : "destructive"}>{alert.resolvedAt ? "Resolved" : "Active"}</Badge>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 text-sm text-muted-foreground">No alerts match the current filters.</div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger render={<Button variant="outline" className="mb-3 justify-start" />}>
            <Users data-icon="inline-start" />
            Team
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Team access</DialogTitle>
              <DialogDescription>Invite collaborators and review current workspace members.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 sm:grid-cols-[1fr_130px]">
              <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@example.com" disabled={!canManageOrganization} />
              <select className="h-9 rounded-lg border bg-background px-2 text-sm disabled:opacity-50" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} disabled={!canManageOrganization}>
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>
            <Button onClick={inviteMember} disabled={!canManageOrganization}>Save invitation</Button>
            {teamMessage ? <div className="text-sm text-muted-foreground">{teamMessage}</div> : null}
            <Separator />
            <div className="max-h-72 overflow-y-auto">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{member.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{member.email}</span>
                  </span>
                  {canManageOrganization && member.role !== "OWNER" ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <select className="h-8 rounded-lg border bg-background px-2 text-xs" value={member.role} onChange={(event) => updateMemberRole(member.id, event.target.value)}>
                        <option value="ADMIN">Admin</option>
                        <option value="MEMBER">Member</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                      <Button variant="ghost" size="sm" onClick={() => removeMember(member.id)}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="secondary">{member.role}</Badge>
                  )}
                </div>
              ))}
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm">
                  <span className="truncate">{invitation.email}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline">{invitation.role} pending</Badge>
                    {canManageOrganization ? (
                      <Button variant="ghost" size="sm" onClick={() => cancelInvitation(invitation.id)}>
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog onOpenChange={(open) => open && loadReportShares()}>
          <DialogTrigger render={<Button variant="outline" className="mb-3 justify-start" />}>
            <Share2 data-icon="inline-start" />
            Client Reports
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Client-facing reports</DialogTitle>
              <DialogDescription>
                Create secure read-only links that prove uptime, run volume, cost, tokens, quality, and incidents for agency clients.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="grid content-start gap-3 rounded-lg border bg-muted/20 p-3">
                <Input value={reportTitle} onChange={(event) => setReportTitle(event.target.value)} aria-label="Report title" disabled={!canManageOrganization} />
                <Input value={reportClientName} onChange={(event) => setReportClientName(event.target.value)} placeholder="Client name, optional" disabled={!canManageOrganization} />
                <Input value={reportExpiryDays} onChange={(event) => setReportExpiryDays(event.target.value)} placeholder="Expiry in days, optional" disabled={!canManageOrganization} />
                <Button onClick={createReportShare} disabled={!canManageOrganization}>
                  <Share2 data-icon="inline-start" />
                  Create and copy report link
                </Button>
                {reportMessage ? <div className="text-xs text-muted-foreground">{reportMessage}</div> : null}
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  Reports are public to anyone with the link, but never expose API secrets, ingestion tokens, or private credentials.
                </div>
              </div>
              <div className="grid content-start gap-2">
                {reportShares.length ? (
                  reportShares.map((share) => (
                    <div key={share.id} className="rounded-lg border bg-background/70 p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{share.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {share.clientName ?? "No client name"} / {share.revokedAt ? "Revoked" : share.expiresAt ? `Expires ${formatSampledAt(share.expiresAt)}` : "No expiry"}
                          </div>
                        </div>
                        <Badge variant={share.revokedAt ? "secondary" : "outline"}>{share.revokedAt ? "Revoked" : "Live"}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => copyReportShareUrl(share.url)}>
                          <Copy data-icon="inline-start" />
                          Copy
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => window.open(share.url, "_blank", "noopener,noreferrer")} disabled={Boolean(share.revokedAt)}>
                          <ExternalLink data-icon="inline-start" />
                          Open
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => revokeReportShare(share.id)} disabled={!canManageOrganization || Boolean(share.revokedAt)}>
                          Revoke
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No report links yet. Create one to share this project with a client.
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger render={<Button variant="outline" className="mb-3 justify-start" />}>
            <ShieldCheck data-icon="inline-start" />
            Deployment
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Deployment readiness</DialogTitle>
              <DialogDescription>Safe production checks for the deployed demo. Secret values are never shown.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
              <div className="grid content-start gap-4">
                <div className="grid gap-2">
                  <ReadinessItem label="Database connected" ready={initialWorkspace.diagnostics.checks.database} />
                  <ReadinessItem label="GitHub OAuth ready" ready={initialWorkspace.diagnostics.checks.auth} />
                  <ReadinessItem label="Encryption enabled" ready={initialWorkspace.diagnostics.checks.encryption} />
                  <ReadinessItem label="Cron secret configured" ready={initialWorkspace.diagnostics.checks.cron} />
                  <ReadinessItem label="Email provider configured" ready={initialWorkspace.diagnostics.checks.email} />
                </div>
                <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
                  <Button onClick={runPollNow} disabled={!canManageOrganization}>
                    <Activity data-icon="inline-start" />
                    Run poll now
                  </Button>
                  {pollMessage ? <div className="text-xs text-muted-foreground">{pollMessage}</div> : null}
                </div>
                {latestPoll ? (
                  <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                    <div className="font-medium">Latest poll: {latestPoll.status}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {latestPoll.sampledNodes} nodes, {latestPoll.createdSamples} samples, {latestPoll.evaluatedAlerts} alerts,{" "}
                      {latestPoll.deletedSamples} old samples cleaned.
                    </div>
                    {latestPoll.errorSummary ? (
                      <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                        {latestPoll.errorSummary}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No cron poll has run yet.</div>
                )}
              </div>
              <div className="grid content-start gap-4 lg:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <MailCheck className="size-4" />
                    Email notifications
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_150px]">
                    <label className="flex items-center gap-2 rounded-lg border bg-background/70 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={emailEnabled}
                        onChange={(event) => setEmailEnabled(event.target.checked)}
                      />
                      Receive alert emails
                    </label>
                    <select
                      className="h-10 rounded-lg border bg-background px-2 text-sm"
                      value={emailSeverity}
                      onChange={(event) => setEmailSeverity(event.target.value)}
                    >
                      <option value="INFO">Info and above</option>
                      <option value="WARNING">Warning and above</option>
                      <option value="CRITICAL">Critical only</option>
                    </select>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Button variant="outline" onClick={saveNotificationPreference}>
                      Save preference
                    </Button>
                    <Button onClick={sendTestEmail} disabled={!canManageOrganization}>
                      <Send data-icon="inline-start" />
                      Send test email
                    </Button>
                  </div>
                  {emailMessage ? <div className="mt-2 text-xs text-muted-foreground">{emailMessage}</div> : null}
                  {latestEmail ? (
                    <div className="mt-3 rounded-md border bg-background/70 p-2 text-xs text-muted-foreground">
                      Latest email: {latestEmail.status} via {latestEmail.provider} at {new Date(latestEmail.attemptedAt).toLocaleString()}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-md border border-dashed p-2 text-xs text-muted-foreground">No email delivery has been attempted yet.</div>
                  )}
                </div>
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <KeyRound className="size-4" />
                    Workflow telemetry
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Project-scoped ingestion tokens let external automations post workflow runs to ArgusGrid.
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Input
                      value={ingestionTokenName}
                      onChange={(event) => setIngestionTokenName(event.target.value)}
                      aria-label="Ingestion token name"
                      disabled={!canManageOrganization}
                    />
                    <Button onClick={createWorkflowToken} disabled={!canManageOrganization}>
                      Create token
                    </Button>
                  </div>
                  {generatedIngestionToken ? (
                    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                      <div className="font-medium">Copy this token now. It will not be shown again.</div>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="min-w-0 flex-1 overflow-x-auto rounded bg-background px-2 py-1 text-[11px] text-foreground">
                          {generatedIngestionToken}
                        </code>
                        <Button variant="outline" size="sm" onClick={() => copyText(generatedIngestionToken, "Token copied.")}>
                          <Copy data-icon="inline-start" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadIngestionTokens} disabled={!canManageOrganization}>
                      Refresh tokens
                    </Button>
                    {ingestionTokenMessage ? <span className="text-xs text-muted-foreground">{ingestionTokenMessage}</span> : null}
                  </div>
                  {ingestionTokens.length ? (
                    <div className="mt-3 grid gap-2">
                      {ingestionTokens.map((token) => (
                        <div key={token.id} className="flex items-center justify-between gap-3 rounded-md border bg-background/70 p-2 text-xs">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{token.name}</div>
                            <div className="mt-1 text-muted-foreground">
                              {token.prefix}... / {token.revokedAt ? "Revoked" : token.lastUsedAt ? `Last used ${new Date(token.lastUsedAt).toLocaleString()}` : "Never used"}
                            </div>
                          </div>
                          {token.revokedAt ? (
                            <Badge variant="secondary">Revoked</Badge>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => revokeWorkflowToken(token.id)} disabled={!canManageOrganization}>
                              Revoke
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                      No tokens loaded yet. Create one or refresh the project token list.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>

        <div className="rounded-xl border bg-background/70 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Free-tier guardrail</span>
            <span>68%</span>
          </div>
          <Progress value={68} />
          <p className="mt-2 text-xs text-muted-foreground">Raw samples roll up hourly after 14 days.</p>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 flex-col gap-3 border-b px-5 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div>
              <h1 className="truncate text-lg font-semibold">{activeSectionMeta.title}</h1>
              <p className="text-xs text-muted-foreground">
                {initialWorkspace.project.name} / {activeSectionMeta.description}
              </p>
            </div>
            <Badge variant="secondary">AI automation control room</Badge>
            <Badge
              variant={liveConnectionState === "live" ? "secondary" : liveConnectionState === "manual" ? "outline" : "destructive"}
              className="gap-1.5"
              title={
                liveCheckedAt
                  ? `Last live check ${new Date(liveCheckedAt).toLocaleTimeString()}${liveChangedAreas.length ? ` / ${liveChangedAreas.join(", ")}` : ""}`
                  : "Connecting to project live updates"
              }
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  liveConnectionState === "live"
                    ? "bg-emerald-500"
                    : liveConnectionState === "manual"
                      ? "bg-zinc-400"
                      : "bg-amber-500"
                )}
              />
              {liveConnectionState === "live" ? "Live" : liveConnectionState === "manual" ? "Manual" : "Reconnecting"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative hidden lg:block">
              <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
              <Input className="w-64 pl-8" placeholder="Search nodes, alerts, parameters" />
            </div>
            <Tooltip>
              <TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Toggle theme" onClick={toggleTheme} />}>
                {theme === "light" ? <Moon /> : <Sun />}
              </TooltipTrigger>
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>
            {activeSection === "map" ? (
              <>
                <Button variant={editMode ? "default" : "outline"} onClick={() => setEditMode((value) => !value)} disabled={!canEditProject}>
                  <Edit3 data-icon="inline-start" />
                  {canEditProject ? (editMode ? "Editing" : "View mode") : "Read only"}
                </Button>
                <Button onClick={addEndpointNode} disabled={!canEditProject}>
                  <Plus data-icon="inline-start" />
                  Add node
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setActiveSection("map")}>
                <Network data-icon="inline-start" />
                Open map
              </Button>
            )}
            <Button variant="ghost" onClick={() => signOut({ callbackUrl: "/" })}>
              Sign out
            </Button>
          </div>
          {actionMessage ? <div className="text-xs text-muted-foreground">{actionMessage}</div> : null}
        </header>

        {activeSection === "projects" ? (
          <ProjectsSection
            projects={initialWorkspace.projects}
            currentProject={initialWorkspace.project}
            newProjectName={newProjectName}
            newProjectMode={newProjectMode}
            canManageOrganization={canManageOrganization}
            actionMessage={actionMessage}
            onNewProjectNameChange={setNewProjectName}
            onNewProjectModeChange={setNewProjectMode}
            onCreateProject={createProject}
            onEditProject={openProjectEditor}
            onOpenProject={(projectId) => {
              window.location.href = `/?project=${projectId}`
            }}
          />
        ) : activeSection === "map" ? (
        <section className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(640px,1fr)_420px]">
          <div className="flex min-w-0 flex-col bg-zinc-50 dark:bg-zinc-950">
            <div className="flex flex-col gap-3 border-b bg-background/80 px-5 py-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  {statusCounts.active} active
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <span className="size-2 rounded-full bg-amber-500" />
                  {statusCounts.degraded} degraded
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <span className="size-2 rounded-full bg-rose-500" />
                  {statusCounts.down} down
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={iconInputRef}
                  className="hidden"
                  type="file"
                  accept="image/png,image/svg+xml"
                  onChange={(event) => uploadSelectedIcon(event.target.files?.[0])}
                />
                <Button variant="outline" size="sm" disabled={!canEditProject || !selectedNode} onClick={() => iconInputRef.current?.click()}>
                  <HardDriveUpload data-icon="inline-start" />
                  Upload icon
                </Button>
                <Button variant="outline" size="sm" onClick={exportGraphPng}>
                  <FileImage data-icon="inline-start" />
                  Export PNG
                </Button>
                <Badge variant="outline">
                  <Wand2 data-icon="inline-start" />
                  API setup in inspector
                </Badge>
                <Button variant={saveState === "error" ? "destructive" : "secondary"} size="sm">
                  <Save data-icon="inline-start" />
                  {saveState === "saving" ? "Autosaving" : saveState === "error" ? "Save failed" : "Autosaved"}
                </Button>
                {iconMessage ? <span className="text-xs text-muted-foreground">{iconMessage}</span> : null}
              </div>
            </div>

            <div className="relative h-[620px] shrink-0 lg:min-h-0 lg:flex-1 lg:h-[calc(100vh-8rem)] xl:h-auto">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={editMode ? onNodesChange : undefined}
                onEdgesChange={editMode ? onEdgesChange : undefined}
                onConnect={onConnect}
                onNodeDragStop={onNodeDragStop}
                onNodeClick={(_, node) => setSelectedId(node.id)}
                snapToGrid={editMode}
                snapGrid={[GRAPH_GRID_SIZE, GRAPH_GRID_SIZE]}
                nodesDraggable={editMode}
                nodesConnectable={editMode}
                elementsSelectable
                fitView
                fitViewOptions={{ padding: 0.2 }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={GRAPH_GRID_SIZE}
                  size={1.8}
                  color="currentColor"
                  className="text-zinc-500 dark:text-zinc-700"
                />
                <MiniMap pannable zoomable nodeStrokeWidth={3} className="!bg-background !shadow-sm" />
                <Controls className="!border !bg-background !shadow-sm" />
              </ReactFlow>

              <div className="pointer-events-none absolute left-5 top-5 max-w-sm rounded-xl border bg-background/90 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="size-4 text-zinc-600 dark:text-zinc-300" />
                  AI automation control room
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Map every automation dependency, then prove reliability, cost, quality, and incidents behind each node.
                </p>
              </div>
            </div>
          </div>

          {selectedNode ? (
            <NodeInspector
              key={selectedNode.id}
              selectedNode={selectedNode}
            currentUser={currentUser}
            categories={initialWorkspace.categories}
            projectId={initialWorkspace.project.id}
            alertRules={alertRules}
            canEditProject={canEditProject}
            isRefreshingProject={isRefreshingProject}
            onOverride={setStatusOverride}
            onRefreshProject={refreshProjectData}
            onRuleSaved={(rule) => {
              setAlertRules((currentRules) => {
                const normalized = {
                  ...rule,
                  nodeLabel: selectedNode.label,
                  mappingLabel: selectedNode.parameters.find((parameter) => parameter.id === rule.mappingId)?.label ?? null,
                  createdAt: rule.createdAt ?? new Date().toISOString(),
                  updatedAt: rule.updatedAt ?? new Date().toISOString(),
                }
                return currentRules.some((currentRule) => currentRule.id === rule.id)
                  ? currentRules.map((currentRule) => (currentRule.id === rule.id ? normalized : currentRule))
                  : currentRules.concat(normalized)
              })
            }}
            onPatch={(patch) => {
              setNodes((currentNodes) =>
                currentNodes.map((node) => {
                  if (node.id !== selectedId) return node
                  const data = node.data as unknown as EndpointNodeData
                  return { ...node, data: { ...data, ...patch } as unknown as Record<string, unknown> }
                })
              )
            }}
            />
          ) : (
            <EmptyInspector currentUser={currentUser} onAddNode={addEndpointNode} />
          )}
        </section>
        ) : activeSection === "control-room" ? (
          <ControlRoomSection
            nodes={endpointNodes}
            statusCounts={statusCounts}
            activeAlerts={activeAlerts}
            latestPoll={latestPoll}
            latestEmail={latestEmail}
            projectRuns={projectRuns}
            projectMetrics={projectMetrics}
            projectSummary={projectSummary}
            onOpenSection={setActiveSection}
            onSelectNode={(nodeId) => {
              setSelectedId(nodeId)
              setActiveSection("map")
            }}
          />
        ) : activeSection === "runs" ? (
          <RunsSection
            runs={projectRuns}
            isRefreshingProject={isRefreshingProject}
            onRefreshProject={refreshProjectData}
            onSelectNode={(nodeId) => {
              setSelectedId(nodeId)
              setActiveSection("map")
            }}
          />
        ) : activeSection === "alerts" ? (
          <AlertsSection
            alerts={filteredAlerts}
            statusFilter={alertStatusFilter}
            severityFilter={alertSeverityFilter}
            canEditProject={canEditProject}
            onStatusFilterChange={setAlertStatusFilter}
            onSeverityFilterChange={setAlertSeverityFilter}
            timelineFilter={alertTimelineFilter}
            onTimelineFilterChange={changeAlertTimelineFilter}
            onOpenAlertSource={openAlertSource}
            onIgnoreAlert={resolveAlert}
            onSelectAlert={setSelectedAlertDetail}
          />
        ) : activeSection === "reports" ? (
          <ReportsSection
            reportShares={reportShares}
            reportTitle={reportTitle}
            reportClientName={reportClientName}
            reportExpiryDays={reportExpiryDays}
            reportMessage={reportMessage}
            canManageOrganization={canManageOrganization}
            onReportTitleChange={setReportTitle}
            onReportClientNameChange={setReportClientName}
            onReportExpiryDaysChange={setReportExpiryDays}
            onLoadReportShares={loadReportShares}
            onCreateReportShare={createReportShare}
            onCopyReportShareUrl={copyReportShareUrl}
            onRevokeReportShare={revokeReportShare}
          />
        ) : activeSection === "integrations" ? (
          <IntegrationsSection
            nodes={endpointNodes}
            selectedNodeId={selectedId}
            alertRules={alertRules}
            canEditProject={canEditProject}
            onSelectNode={setSelectedId}
            onOpenMap={() => setActiveSection("map")}
            onOpenSettings={() => setActiveSection("settings")}
            onOpenRuns={() => setActiveSection("runs")}
          />
        ) : activeSection === "team" ? (
          <TeamSection
            members={members}
            invitations={invitations}
            inviteEmail={inviteEmail}
            inviteRole={inviteRole}
            teamMessage={teamMessage}
            canManageOrganization={canManageOrganization}
            onInviteEmailChange={setInviteEmail}
            onInviteRoleChange={setInviteRole}
            onInviteMember={inviteMember}
            onUpdateMemberRole={updateMemberRole}
            onRemoveMember={removeMember}
            onCancelInvitation={cancelInvitation}
          />
        ) : (
          <SettingsSection
            diagnostics={initialWorkspace.diagnostics}
            latestPoll={latestPoll}
            latestEmail={latestEmail}
            pollMessage={pollMessage}
            emailEnabled={emailEnabled}
            emailSeverity={emailSeverity}
            emailMessage={emailMessage}
            ingestionTokens={ingestionTokens}
            ingestionTokenName={ingestionTokenName}
            ingestionTokenMessage={ingestionTokenMessage}
            generatedIngestionToken={generatedIngestionToken}
            canManageOrganization={canManageOrganization}
            onRunPollNow={runPollNow}
            onEmailEnabledChange={setEmailEnabled}
            onEmailSeverityChange={setEmailSeverity}
            onSaveNotificationPreference={saveNotificationPreference}
            onSendTestEmail={sendTestEmail}
            onIngestionTokenNameChange={setIngestionTokenName}
            onCreateWorkflowToken={createWorkflowToken}
            onLoadIngestionTokens={loadIngestionTokens}
            onRevokeWorkflowToken={revokeWorkflowToken}
            onCopyGeneratedToken={() => copyText(generatedIngestionToken, "Token copied.")}
          />
        )}
      </main>
      <Dialog open={Boolean(editingProject)} onOpenChange={(open) => !open && setEditingProject(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>
              Rename or archive this organization project. Account-local project aliases and visibility are planned for the team hierarchy phase.
            </DialogDescription>
          </DialogHeader>
          {editingProject ? (
            <div className="grid gap-4">
              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <div className="text-xs text-muted-foreground">Project</div>
                <div className="mt-1 font-medium">{editingProject.name}</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{editingProject.slug}</div>
              </div>
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                Project name
                <Input value={editingProjectName} onChange={(event) => setEditingProjectName(event.target.value)} disabled={!canManageOrganization} />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={renameEditedProject} disabled={!canManageOrganization || !editingProjectName.trim()}>
                  Rename project
                </Button>
                <Button variant="destructive" onClick={archiveEditedProject} disabled={!canManageOrganization}>
                  <Trash2 data-icon="inline-start" />
                  Archive project
                </Button>
              </div>
              {actionMessage ? <div className="text-xs text-muted-foreground">{actionMessage}</div> : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Sheet open={Boolean(selectedAlertDetail)} onOpenChange={(open) => !open && setSelectedAlertDetail(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selectedAlertDetail?.title ?? "Alert details"}</SheetTitle>
            <SheetDescription>{selectedAlertDetail?.message}</SheetDescription>
          </SheetHeader>
          {selectedAlertDetail ? (
            <div className="grid gap-3 px-4 text-sm">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Affected node</div>
                <div className="font-medium">{selectedAlertDetail.nodeLabel ?? "Project"}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Severity</div>
                  <div className="font-medium">{selectedAlertDetail.severity}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="font-medium">{selectedAlertDetail.resolvedAt ? "Resolved" : "Active"}</div>
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Source</div>
                <div className="font-medium">{selectedAlertDetail.source}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Latest email delivery</div>
                <div className="font-medium">
                  {selectedAlertDetail.deliveryStatus
                    ? `${selectedAlertDetail.deliveryStatus}${selectedAlertDetail.deliveryProvider ? ` via ${selectedAlertDetail.deliveryProvider}` : ""}`
                    : "No delivery attempted"}
                </div>
                {selectedAlertDetail.deliveryAttemptedAt ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Attempted {new Date(selectedAlertDetail.deliveryAttemptedAt).toLocaleString()}
                    {selectedAlertDetail.deliverySentAt ? `, sent ${new Date(selectedAlertDetail.deliverySentAt).toLocaleString()}` : ""}
                  </div>
                ) : null}
                {selectedAlertDetail.deliveryFailureReason ? (
                  <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                    {selectedAlertDetail.deliveryFailureReason}
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">First seen</div>
                  <div className="font-medium">{new Date(selectedAlertDetail.firstSeen).toLocaleString()}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Last seen</div>
                  <div className="font-medium">{new Date(selectedAlertDetail.lastSeen).toLocaleString()}</div>
                </div>
              </div>
              {selectedAlertDetail.resolvedAt ? (
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Resolved at</div>
                  <div className="font-medium">{new Date(selectedAlertDetail.resolvedAt).toLocaleString()}</div>
                </div>
              ) : canEditProject ? (
                <div className="grid gap-2">
                  <Button onClick={() => openAlertSource(selectedAlertDetail)}>
                    <Network data-icon="inline-start" />
                    Resolve at source node
                  </Button>
                  <Button variant="outline" onClick={() => resolveAlert(selectedAlertDetail.id)}>
                    <CheckCircle2 data-icon="inline-start" />
                    Ignore alert
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  count,
  onClick,
}: {
  icon: typeof Bot
  label: string
  active?: boolean
  count?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 items-center justify-between rounded-lg px-3 text-sm transition-colors hover:bg-sidebar-accent",
        active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="size-4" />
        <span className="truncate">{label}</span>
      </span>
      {count ? <Badge variant="secondary">{count}</Badge> : null}
    </button>
  )
}

function ReadinessItem({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
      <span className="font-medium">{label}</span>
      <Badge variant={ready ? "secondary" : "destructive"}>{ready ? "Ready" : "Missing"}</Badge>
    </div>
  )
}

function SectionShell({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("min-h-0 flex-1 overflow-y-auto bg-zinc-50 p-5 dark:bg-zinc-950", className)}>{children}</section>
}

function MetricTile({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string
  value: string
  detail: string
  tone?: keyof typeof toneClasses
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-2xl font-semibold", toneClasses[tone])}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}

function ProjectsSection({
  projects,
  currentProject,
  newProjectName,
  newProjectMode,
  canManageOrganization,
  actionMessage,
  onNewProjectNameChange,
  onNewProjectModeChange,
  onCreateProject,
  onEditProject,
  onOpenProject,
}: {
  projects: WorkspacePayload["projects"]
  currentProject: WorkspacePayload["project"]
  newProjectName: string
  newProjectMode: ProjectMode
  canManageOrganization: boolean
  actionMessage: string
  onNewProjectNameChange: (value: string) => void
  onNewProjectModeChange: (value: ProjectMode) => void
  onCreateProject: () => Promise<void>
  onEditProject: (project: WorkspacePayload["projects"][number]) => void
  onOpenProject: (projectId: string) => void
}) {
  return (
    <SectionShell>
      <div className="mx-auto grid max-w-7xl gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Project Workspace</h2>
            <p className="mt-1 text-sm text-muted-foreground">Open client automation maps, review operational signal, and manage project lifecycle.</p>
          </div>
          <Badge variant="secondary">{projects.length} projects</Badge>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.25fr]">
          <div className="grid content-start gap-5">
            <Card>
              <CardHeader>
                <CardTitle>Create Project</CardTitle>
                <CardDescription>Start a blank workspace or seed a demo control room. More project presets can live here later.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                  Project name
                  <Input value={newProjectName} onChange={(event) => onNewProjectNameChange(event.target.value)} disabled={!canManageOrganization} />
                </label>
                <div className="grid gap-2">
                  <div className="text-xs font-medium text-muted-foreground">Project starter</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={newProjectMode === "blank" ? "default" : "outline"} onClick={() => onNewProjectModeChange("blank")} disabled={!canManageOrganization}>
                      Blank
                    </Button>
                    <Button variant={newProjectMode === "demo" ? "default" : "outline"} onClick={() => onNewProjectModeChange("demo")} disabled={!canManageOrganization}>
                      Demo
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">Coming next</div>
                  <div className="grid gap-1 sm:grid-cols-3">
                    <span>Client name</span>
                    <span>Template type</span>
                    <span>Monitoring mode</span>
                  </div>
                </div>
                <Button onClick={onCreateProject} disabled={!canManageOrganization}>
                  <Plus data-icon="inline-start" />
                  Create project
                </Button>
                {actionMessage ? <div className="text-xs text-muted-foreground">{actionMessage}</div> : null}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((project) => {
              const isCurrent = project.id === currentProject.id
              return (
                <div key={project.id} className={cn("rounded-xl border bg-background p-4", isCurrent && "border-primary/60 shadow-sm")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{project.name}</div>
                      <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{project.slug}</div>
                    </div>
                    <Badge variant={isCurrent ? "default" : "outline"}>{isCurrent ? "Open" : "Available"}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border bg-muted/20 p-2">
                      <div className="text-muted-foreground">Nodes</div>
                      <div className="mt-1 text-base font-semibold">{project.nodeCount}</div>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-2">
                      <div className="text-muted-foreground">Active alerts</div>
                      <div className={cn("mt-1 text-base font-semibold", project.activeAlertCount ? toneClasses.bad : toneClasses.good)}>
                        {project.activeAlertCount}
                      </div>
                    </div>
                    <div className="col-span-2 rounded-lg border bg-muted/20 p-2">
                      <div className="text-muted-foreground">Latest sample</div>
                      <div className="mt-1 font-medium">{project.latestSampledAt ? formatSampledAt(project.latestSampledAt) : "No samples yet"}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant={isCurrent ? "secondary" : "default"} onClick={() => onOpenProject(project.id)} disabled={isCurrent}>
                      {isCurrent ? "Currently open" : "Open project"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onEditProject(project)} disabled={!canManageOrganization}>
                      <Edit3 data-icon="inline-start" />
                      Edit
                    </Button>
                    {project.updatedAt ? <span className="text-xs text-muted-foreground">Updated {formatSampledAt(project.updatedAt)}</span> : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </SectionShell>
  )
}

function ControlRoomSection({
  nodes,
  statusCounts,
  activeAlerts,
  latestPoll,
  latestEmail,
  projectRuns,
  projectMetrics,
  projectSummary,
  onOpenSection,
  onSelectNode,
}: {
  nodes: EndpointNodeData[]
  statusCounts: { active: number; degraded: number; down: number }
  activeAlerts: ProjectAlert[]
  latestPoll: WorkspacePayload["diagnostics"]["latestPoll"]
  latestEmail: WorkspacePayload["diagnostics"]["latestEmail"]
  projectRuns: ProjectRunRecord[]
  projectMetrics: ProjectMetricRecord[]
  projectSummary: {
    failedRuns: ProjectRunRecord[]
    successRate: number | null
    totalCost: number
    latestSampledAt: string | null
    staleNodes: EndpointNodeData[]
  }
  onOpenSection: (section: DashboardSection) => void
  onSelectNode: (nodeId: string) => void
}) {
  const attentionItems = [
    ...activeAlerts.slice(0, 4).map((alert) => ({
      id: `alert-${alert.id}`,
      title: alert.title,
      detail: `${alert.nodeLabel ?? "Project"} / ${alert.severity}`,
      tone: alert.severity === "CRITICAL" ? "bad" : "warn",
      nodeId: alert.nodeId,
    })),
    ...projectSummary.failedRuns.slice(0, 3).map((run) => ({
      id: `run-${run.id}`,
      title: `${run.status} run`,
      detail: `${run.nodeLabel} / ${run.externalId ?? run.id}`,
      tone: run.status === "failed" ? "bad" : "warn",
      nodeId: run.nodeId,
    })),
    ...projectSummary.staleNodes.slice(0, 3).map((node) => ({
      id: `stale-${node.id}`,
      title: "Stale metric data",
      detail: `${node.label} / ${node.freshnessLabel}`,
      tone: "neutral",
      nodeId: node.id,
    })),
  ] as const

  return (
    <SectionShell>
      <div className="mx-auto grid max-w-7xl gap-5">
        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border bg-background p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">AI Automation Control Room</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  One operating picture for automation health, workflow runs, cost, quality, alerts, and client proof.
                </p>
              </div>
              <Button onClick={() => onOpenSection("map")}>
                <Network data-icon="inline-start" />
                Open automation map
              </Button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricTile label="Nodes monitored" value={String(nodes.length)} detail={`${statusCounts.active} active / ${statusCounts.degraded} degraded / ${statusCounts.down} down`} />
              <MetricTile
                label="Run success"
                value={projectSummary.successRate === null ? "No runs" : `${projectSummary.successRate}%`}
                detail={`${projectRuns.length} recent runs captured`}
                tone={projectSummary.failedRuns.length ? "warn" : "good"}
              />
              <MetricTile
                label="Active alerts"
                value={String(activeAlerts.length)}
                detail={activeAlerts.length ? "Needs operator attention" : "No open incidents"}
                tone={activeAlerts.length ? "bad" : "good"}
              />
            </div>
          </div>

          <div className="rounded-xl border bg-background p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Production Signals</h3>
                <p className="mt-1 text-xs text-muted-foreground">Safe readiness indicators from the deployed app.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onOpenSection("settings")}>
                Settings
              </Button>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span>Latest poll</span>
                <Badge variant={latestPoll?.status === "SUCCESS" ? "secondary" : latestPoll ? "destructive" : "outline"}>
                  {latestPoll?.status ?? "No poll"}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span>Latest email</span>
                <Badge variant={latestEmail?.status === "SENT" ? "secondary" : latestEmail ? "outline" : "secondary"}>
                  {latestEmail?.status ?? "Not attempted"}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span>Latest sample</span>
                <span className="text-xs text-muted-foreground">
                  {projectSummary.latestSampledAt ? formatSampledAt(projectSummary.latestSampledAt) : "No metric samples"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <MetricTile label="Estimated cost" value={`$${projectSummary.totalCost.toFixed(2)}`} detail="From submitted workflow telemetry" />
          <MetricTile label="Metric streams" value={String(projectMetrics.length)} detail="Persisted mapped values available" />
          <MetricTile label="Failed/degraded runs" value={String(projectSummary.failedRuns.length)} detail="Shown in the runs section" tone={projectSummary.failedRuns.length ? "warn" : "good"} />
          <MetricTile label="Client proof" value="Ready" detail="Share reports and export map PNGs" tone="good" />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>What Needs Attention</CardTitle>
              <CardDescription>Alerts, failed runs, and stale signals across this project.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {attentionItems.length ? (
                attentionItems.map((item) => (
                  <button
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3 text-left text-sm transition-colors hover:bg-muted/40"
                    onClick={() => item.nodeId ? onSelectNode(item.nodeId) : onOpenSection("alerts")}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                    </span>
                    <span className={cn("size-2.5 rounded-full", item.tone === "bad" ? "bg-rose-500" : item.tone === "warn" ? "bg-amber-500" : "bg-zinc-400")} />
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                  Nothing needs attention right now. This is the quiet dashboard state we like.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fast Paths</CardTitle>
              <CardDescription>Jump into the setup and demo workflows private-beta users need most.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" className="justify-start" onClick={() => onOpenSection("integrations")}>
                <Wand2 data-icon="inline-start" />
                Connect Dify, n8n, GitHub Actions, or REST metrics
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => onOpenSection("reports")}>
                <Share2 data-icon="inline-start" />
                Create a client report link
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => onOpenSection("alerts")}>
                <Bell data-icon="inline-start" />
                Review alert center
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => onOpenSection("team")}>
                <Users data-icon="inline-start" />
                Manage team access
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </SectionShell>
  )
}

function RunsSection({
  runs,
  isRefreshingProject,
  onRefreshProject,
  onSelectNode,
}: {
  runs: ProjectRunRecord[]
  isRefreshingProject: boolean
  onRefreshProject: () => Promise<void>
  onSelectNode: (nodeId: string) => void
}) {
  return (
    <SectionShell>
      <div className="mx-auto grid max-w-7xl gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Workflow Runs</h2>
            <p className="mt-1 text-sm text-muted-foreground">Recent run telemetry posted through ArgusGrid ingestion tokens.</p>
          </div>
          <Button variant="outline" onClick={onRefreshProject} disabled={isRefreshingProject}>
            <Activity data-icon="inline-start" />
            {isRefreshingProject ? "Refreshing" : "Refresh runs"}
          </Button>
        </div>
        <div className="rounded-xl border bg-background">
          {runs.length ? (
            <div className="divide-y">
              {runs.slice(0, 30).map((run) => (
                <button key={`${run.nodeId}-${run.id}-${run.startedAt ?? run.started}`} className="grid w-full gap-3 p-4 text-left text-sm hover:bg-muted/40 md:grid-cols-[1fr_150px_120px_120px_90px]" onClick={() => onSelectNode(run.nodeId)}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{run.externalId ?? run.id}</span>
                    <span className="block truncate text-xs text-muted-foreground">{run.nodeLabel}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{run.startedAt ? formatSampledAt(run.startedAt) : run.started}</span>
                  <span className="text-xs">{run.latency}</span>
                  <span className="text-xs">{run.cost}</span>
                  <Badge variant={runBadgeVariant(run.status)}>{run.status}</Badge>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">No workflow runs have been ingested yet. Create a telemetry token in Settings, then use an integration template.</div>
          )}
        </div>
      </div>
    </SectionShell>
  )
}

function AlertsSection({
  alerts,
  statusFilter,
  severityFilter,
  timelineFilter,
  canEditProject,
  onStatusFilterChange,
  onSeverityFilterChange,
  onTimelineFilterChange,
  onOpenAlertSource,
  onIgnoreAlert,
  onSelectAlert,
}: {
  alerts: ProjectAlert[]
  statusFilter: "active" | "resolved" | "all"
  severityFilter: string
  timelineFilter: AlertTimelineFilter
  canEditProject: boolean
  onStatusFilterChange: (value: "active" | "resolved" | "all") => void
  onSeverityFilterChange: (value: string) => void
  onTimelineFilterChange: (value: AlertTimelineFilter) => void
  onOpenAlertSource: (alert: ProjectAlert) => void
  onIgnoreAlert: (alertId: string) => void
  onSelectAlert: (alert: ProjectAlert) => void
}) {
  return (
    <SectionShell>
      <div className="mx-auto grid max-w-7xl gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Project Alert Center</h2>
            <p className="mt-1 text-sm text-muted-foreground">Filter active and resolved alerts, inspect details, and resolve incidents.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as "active" | "resolved" | "all")}>
              <option value="active">Active alerts</option>
              <option value="resolved">Resolved alerts</option>
              <option value="all">All alerts</option>
            </select>
            <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={severityFilter} onChange={(event) => onSeverityFilterChange(event.target.value)}>
              <option value="all">All severities</option>
              <option value="INFO">Info</option>
              <option value="WARNING">Warning</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={timelineFilter} onChange={(event) => onTimelineFilterChange(event.target.value as AlertTimelineFilter)}>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7d</option>
              <option value="30d">Last 30d</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>
        <div className="rounded-xl border bg-background">
          {alerts.length ? (
            <div className="divide-y">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-start justify-between gap-3 p-4 text-sm">
                  <button className="min-w-0 flex-1 text-left" onClick={() => onSelectAlert(alert)}>
                    <div className="font-medium">{alert.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {alert.nodeLabel ?? "Project"} / {alert.severity} / {alert.resolvedAt ? "Resolved" : "Active"}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{alert.message}</div>
                  </button>
                  {!alert.resolvedAt && canEditProject ? (
                    <div className="grid shrink-0 gap-2">
                      <Button variant="outline" size="sm" onClick={() => onOpenAlertSource(alert)}>
                        Resolve
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onIgnoreAlert(alert.id)}>
                        Ignore
                      </Button>
                    </div>
                  ) : (
                    <Badge variant={alert.resolvedAt ? "secondary" : "destructive"}>{alert.resolvedAt ? "Resolved" : "Active"}</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">No alerts match the current filters.</div>
          )}
        </div>
      </div>
    </SectionShell>
  )
}

function ReportsSection({
  reportShares,
  reportTitle,
  reportClientName,
  reportExpiryDays,
  reportMessage,
  canManageOrganization,
  onReportTitleChange,
  onReportClientNameChange,
  onReportExpiryDaysChange,
  onLoadReportShares,
  onCreateReportShare,
  onCopyReportShareUrl,
  onRevokeReportShare,
}: {
  reportShares: ReportShareRecord[]
  reportTitle: string
  reportClientName: string
  reportExpiryDays: string
  reportMessage: string
  canManageOrganization: boolean
  onReportTitleChange: (value: string) => void
  onReportClientNameChange: (value: string) => void
  onReportExpiryDaysChange: (value: string) => void
  onLoadReportShares: () => Promise<void>
  onCreateReportShare: () => Promise<void>
  onCopyReportShareUrl: (url: string) => Promise<void>
  onRevokeReportShare: (shareId: string) => Promise<void>
}) {
  return (
    <SectionShell>
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create Client Report</CardTitle>
            <CardDescription>Share uptime, runs, cost, tokens, quality, incidents, and latest status without exposing secrets.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Report title
              <Input value={reportTitle} onChange={(event) => onReportTitleChange(event.target.value)} aria-label="Report title" disabled={!canManageOrganization} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Client name
              <Input value={reportClientName} onChange={(event) => onReportClientNameChange(event.target.value)} placeholder="Optional" disabled={!canManageOrganization} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Expiry window
              <Input value={reportExpiryDays} onChange={(event) => onReportExpiryDaysChange(event.target.value)} placeholder="Days, optional" disabled={!canManageOrganization} />
            </label>
            <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              Report links never expose API secrets, ingestion tokens, or private credentials.
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={onCreateReportShare} disabled={!canManageOrganization}>
                <Share2 data-icon="inline-start" />
                Create link
              </Button>
              <Button variant="outline" onClick={onLoadReportShares} disabled={!canManageOrganization}>
                Refresh links
              </Button>
            </div>
            {reportMessage ? <div className="text-xs text-muted-foreground">{reportMessage}</div> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Report Links</CardTitle>
            <CardDescription>Live links can be opened, copied, or revoked.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {reportShares.length ? (
              reportShares.map((share) => (
                <div key={share.id} className="rounded-lg border bg-background p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{share.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {share.clientName ?? "No client name"} / {share.revokedAt ? "Revoked" : share.expiresAt ? `Expires ${formatSampledAt(share.expiresAt)}` : "No expiry"}
                      </div>
                    </div>
                    <Badge variant={share.revokedAt ? "secondary" : "outline"}>{share.revokedAt ? "Revoked" : "Live"}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => onCopyReportShareUrl(share.url)}>
                      <Copy data-icon="inline-start" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(share.url, "_blank", "noopener,noreferrer")} disabled={Boolean(share.revokedAt)}>
                      <ExternalLink data-icon="inline-start" />
                      Open
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onRevokeReportShare(share.id)} disabled={!canManageOrganization || Boolean(share.revokedAt)}>
                      Revoke
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No report links loaded yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  )
}

function IntegrationsSection({
  nodes,
  selectedNodeId,
  alertRules,
  canEditProject,
  onSelectNode,
  onOpenMap,
  onOpenSettings,
  onOpenRuns,
}: {
  nodes: EndpointNodeData[]
  selectedNodeId: string
  alertRules: WorkspacePayload["alertRules"]
  canEditProject: boolean
  onSelectNode: (nodeId: string) => void
  onOpenMap: () => void
  onOpenSettings: () => void
  onOpenRuns: () => void
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<IntegrationTemplate["id"]>("dify")
  const [message, setMessage] = useState("")
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0]
  const selectedTemplate = integrationTemplates.find((template) => template.id === selectedTemplateId) ?? integrationTemplates[0]
  const snippet = selectedNode ? buildIntegrationSnippet(selectedTemplate, selectedNode.id) : "Select a node on the Automation Map first."
  const envBlock = selectedTemplate.setupKind === "telemetry"
    ? `ARGUSGRID_INGESTION_TOKEN=<ingestion-token>\nARGUSGRID_NODE_ID=${selectedNode?.id ?? "<node-id>"}\nARGUSGRID_INGEST_URL=https://argusgrid.hrudainirmal.in/api/ingest/runs`
    : `ARGUSGRID_ENDPOINT_URL=https://api.example.com/automation/health\nARGUSGRID_JSONPATH=${selectedTemplate.preset?.jsonPath ?? "$.value"}\nARGUSGRID_THRESHOLD=${selectedTemplate.preset?.threshold ?? "> 90"}`
  const workflowTemplates = integrationTemplates.filter((template) => template.setupKind === "telemetry")
  const metricTemplates = integrationTemplates.filter((template) => template.setupKind === "metric")
  const readiness = selectedNode
    ? [
        { label: "API configured", ready: selectedNode.parameters.some((parameter) => parameter.id) || !selectedNode.apiUrl.includes("example.com") },
        { label: "Mappings saved", ready: selectedNode.parameters.some((parameter) => parameter.id) },
        { label: "Alert rule saved", ready: alertRules.some((rule) => rule.nodeId === selectedNode.id) },
        { label: "Recent run received", ready: Boolean(selectedNode.hasPersistedRuns) },
        { label: "Latest sample received", ready: Boolean(selectedNode.latestSampledAt) },
      ]
    : []

  const copySnippet = async () => {
    await navigator.clipboard.writeText(snippet)
    setMessage(`${selectedTemplate.name} snippet copied.`)
  }

  const copyEnvBlock = async () => {
    await navigator.clipboard.writeText(envBlock)
    setMessage(`${selectedTemplate.name} environment block copied.`)
  }

  const TemplateButton = ({ template }: { template: IntegrationTemplate }) => (
    <button
      key={template.id}
      type="button"
      className={cn("rounded-lg border bg-background p-4 text-left text-sm transition-colors hover:bg-muted/40", selectedTemplate.id === template.id && "border-primary/60 shadow-sm")}
      onClick={() => setSelectedTemplateId(template.id)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{template.name}</span>
        <Badge variant={template.setupKind === "metric" ? "secondary" : "outline"}>{template.setupKind === "metric" ? "Metric polling" : "Workflow telemetry"}</Badge>
        <Badge variant="outline">{template.difficulty}</Badge>
      </div>
      <div className="mt-2 text-xs leading-5 text-muted-foreground">{template.description}</div>
    </button>
  )

  return (
    <SectionShell>
      <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="grid content-start gap-3">
          <div>
            <h2 className="text-xl font-semibold">Integration Templates</h2>
            <p className="mt-1 text-sm text-muted-foreground">Focused setup accelerators for the core private-beta sources.</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Target Node</CardTitle>
              <CardDescription>Choose the node that should receive runs or metric samples.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <select className="h-10 rounded-lg border bg-background px-2 text-sm" value={selectedNode?.id ?? ""} onChange={(event) => onSelectNode(event.target.value)}>
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>{node.label}</option>
                ))}
              </select>
              {selectedNode ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {readiness.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs">
                      <span>{item.label}</span>
                      <Badge variant={item.ready ? "secondary" : "outline"}>{item.ready ? "Ready" : "Missing"}</Badge>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-2">
            <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Workflow telemetry</div>
            {workflowTemplates.map((template) => <TemplateButton key={template.id} template={template} />)}
          </div>
          <div className="grid gap-2">
            <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Metric polling</div>
            {metricTemplates.map((template) => <TemplateButton key={template.id} template={template} />)}
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{selectedTemplate.name}</CardTitle>
            <CardDescription>{selectedNode ? `Prepared for ${selectedNode.label}. Tokens remain placeholders.` : "Select a graph node to generate a node-specific snippet."}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-1">
              {selectedTemplate.requiredFields.map((field) => (
                <Badge key={field} variant="outline">
                  {field}
                </Badge>
              ))}
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
              {selectedTemplate.basicSteps.map((step, index) => (
                <div key={step}>{index + 1}. {step}</div>
              ))}
            </div>
            <div className="grid gap-2 rounded-lg border bg-background p-3 text-xs">
              <div className="font-medium">Setup checklist</div>
              <div className="grid gap-1 text-muted-foreground">
                <div>1. Select or create the target node.</div>
                <div>2. Create an ingestion token in Settings if this template sends workflow telemetry.</div>
                <div>3. Copy the environment block and snippet.</div>
                <div>4. Send a test run or save the metric API setup.</div>
                <div>5. Refresh Runs or Metrics to confirm data arrived.</div>
              </div>
            </div>
            <div className="rounded-lg border bg-background p-3 text-xs">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium">Environment block</span>
                <Button variant="outline" size="sm" onClick={copyEnvBlock} disabled={!selectedNode}>
                  <Copy data-icon="inline-start" />
                  Copy env
                </Button>
              </div>
              <pre className="max-h-32 overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] text-muted-foreground">{envBlock}</pre>
            </div>
            {selectedTemplate.preset ? (
              <div className="rounded-lg border bg-background p-3 text-xs">
                <div className="font-medium">Metric polling preset</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="text-muted-foreground">Endpoint URL</div>
                    <div className="truncate font-mono">{selectedTemplate.preset.apiUrl}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">JSONPath</div>
                    <div className="font-mono">{selectedTemplate.preset.jsonPath}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Threshold</div>
                    <div className="font-mono">{selectedTemplate.preset.ruleExpression}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Visualization</div>
                    <div>{selectedTemplate.preset.visualization}</div>
                  </div>
                </div>
                <div className="mt-3 text-muted-foreground">
                  Open the selected node on the map, then use Setup / Templates to apply and save this preset.
                </div>
              </div>
            ) : null}
            <pre className="max-h-[48vh] overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] text-muted-foreground">{snippet}</pre>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={copySnippet} disabled={!selectedNode}>
                <Copy data-icon="inline-start" />
                Copy snippet
              </Button>
              <Button variant="outline" onClick={onOpenSettings}>
                <KeyRound data-icon="inline-start" />
                Tokens
              </Button>
              <Button variant="outline" onClick={onOpenRuns}>
                <Activity data-icon="inline-start" />
                Runs
              </Button>
              <Button variant="outline" onClick={onOpenMap}>
                Open map
              </Button>
              {!canEditProject ? <Badge variant="outline">Read only</Badge> : null}
              {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  )
}

function TeamSection({
  members,
  invitations,
  inviteEmail,
  inviteRole,
  teamMessage,
  canManageOrganization,
  onInviteEmailChange,
  onInviteRoleChange,
  onInviteMember,
  onUpdateMemberRole,
  onRemoveMember,
  onCancelInvitation,
}: {
  members: WorkspacePayload["members"]
  invitations: WorkspacePayload["invitations"]
  inviteEmail: string
  inviteRole: string
  teamMessage: string
  canManageOrganization: boolean
  onInviteEmailChange: (value: string) => void
  onInviteRoleChange: (value: string) => void
  onInviteMember: () => Promise<void>
  onUpdateMemberRole: (memberId: string, role: string) => Promise<void>
  onRemoveMember: (memberId: string) => Promise<void>
  onCancelInvitation: (invitationId: string) => Promise<void>
}) {
  return (
    <SectionShell>
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Invite Teammate</CardTitle>
            <CardDescription>Owners and admins can invite collaborators by email.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input value={inviteEmail} onChange={(event) => onInviteEmailChange(event.target.value)} placeholder="teammate@example.com" disabled={!canManageOrganization} />
            <select className="h-9 rounded-lg border bg-background px-2 text-sm disabled:opacity-50" value={inviteRole} onChange={(event) => onInviteRoleChange(event.target.value)} disabled={!canManageOrganization}>
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <Button onClick={onInviteMember} disabled={!canManageOrganization}>Save invitation</Button>
            {teamMessage ? <div className="text-sm text-muted-foreground">{teamMessage}</div> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Members And Pending Invites</CardTitle>
            <CardDescription>Change roles, remove members, or cancel pending invitations.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{member.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{member.email}</span>
                </span>
                {canManageOrganization && member.role !== "OWNER" ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <select className="h-8 rounded-lg border bg-background px-2 text-xs" value={member.role} onChange={(event) => onUpdateMemberRole(member.id, event.target.value)}>
                      <option value="ADMIN">Admin</option>
                      <option value="MEMBER">Member</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                    <Button variant="ghost" size="sm" onClick={() => onRemoveMember(member.id)}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Badge variant="secondary">{member.role}</Badge>
                )}
              </div>
            ))}
            {invitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <span className="truncate">{invitation.email}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline">{invitation.role} pending</Badge>
                  {canManageOrganization ? (
                    <Button variant="ghost" size="sm" onClick={() => onCancelInvitation(invitation.id)}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  )
}

function SettingsSection({
  diagnostics,
  latestPoll,
  latestEmail,
  pollMessage,
  emailEnabled,
  emailSeverity,
  emailMessage,
  ingestionTokens,
  ingestionTokenName,
  ingestionTokenMessage,
  generatedIngestionToken,
  canManageOrganization,
  onRunPollNow,
  onEmailEnabledChange,
  onEmailSeverityChange,
  onSaveNotificationPreference,
  onSendTestEmail,
  onIngestionTokenNameChange,
  onCreateWorkflowToken,
  onLoadIngestionTokens,
  onRevokeWorkflowToken,
  onCopyGeneratedToken,
}: {
  diagnostics: WorkspacePayload["diagnostics"]
  latestPoll: WorkspacePayload["diagnostics"]["latestPoll"]
  latestEmail: WorkspacePayload["diagnostics"]["latestEmail"]
  pollMessage: string
  emailEnabled: boolean
  emailSeverity: string
  emailMessage: string
  ingestionTokens: IngestionTokenRecord[]
  ingestionTokenName: string
  ingestionTokenMessage: string
  generatedIngestionToken: string
  canManageOrganization: boolean
  onRunPollNow: () => Promise<void>
  onEmailEnabledChange: (value: boolean) => void
  onEmailSeverityChange: (value: string) => void
  onSaveNotificationPreference: () => Promise<void>
  onSendTestEmail: () => Promise<void>
  onIngestionTokenNameChange: (value: string) => void
  onCreateWorkflowToken: () => Promise<void>
  onLoadIngestionTokens: () => Promise<void>
  onRevokeWorkflowToken: (tokenId: string) => Promise<void>
  onCopyGeneratedToken: () => void
}) {
  return (
    <SectionShell>
      <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="grid content-start gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Deployment Readiness</CardTitle>
              <CardDescription>Safe production checks for the deployed demo. Secret values are never shown.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <ReadinessItem label="Database connected" ready={diagnostics.checks.database} />
              <ReadinessItem label="GitHub OAuth ready" ready={diagnostics.checks.auth} />
              <ReadinessItem label="Encryption enabled" ready={diagnostics.checks.encryption} />
              <ReadinessItem label="Cron secret configured" ready={diagnostics.checks.cron} />
              <ReadinessItem label="Email provider configured" ready={diagnostics.checks.email} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Polling Control</CardTitle>
              <CardDescription>Run the project poll manually for demos and QA.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button onClick={onRunPollNow} disabled={!canManageOrganization}>
                <Activity data-icon="inline-start" />
                Run poll now
              </Button>
              {pollMessage ? <div className="text-xs text-muted-foreground">{pollMessage}</div> : null}
              {latestPoll ? (
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <div className="font-medium">Latest poll: {latestPoll.status}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {latestPoll.sampledNodes} nodes, {latestPoll.createdSamples} samples, {latestPoll.evaluatedAlerts} alerts, {latestPoll.deletedSamples} old samples cleaned.
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No cron poll has run yet.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Preferences and provider delivery status for alert emails.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                <label className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                  <input type="checkbox" checked={emailEnabled} onChange={(event) => onEmailEnabledChange(event.target.checked)} />
                  Receive alert emails
                </label>
                <select className="h-10 rounded-lg border bg-background px-2 text-sm" value={emailSeverity} onChange={(event) => onEmailSeverityChange(event.target.value)}>
                  <option value="INFO">Info and above</option>
                  <option value="WARNING">Warning and above</option>
                  <option value="CRITICAL">Critical only</option>
                </select>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={onSaveNotificationPreference}>Save preference</Button>
                <Button onClick={onSendTestEmail} disabled={!canManageOrganization}>
                  <Send data-icon="inline-start" />
                  Send test email
                </Button>
              </div>
              {emailMessage ? <div className="text-xs text-muted-foreground">{emailMessage}</div> : null}
              <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                {latestEmail ? `Latest email: ${latestEmail.status} via ${latestEmail.provider} at ${new Date(latestEmail.attemptedAt).toLocaleString()}` : "No email delivery has been attempted yet."}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workflow Telemetry Tokens</CardTitle>
              <CardDescription>Project-scoped tokens for external automations posting run telemetry.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input value={ingestionTokenName} onChange={(event) => onIngestionTokenNameChange(event.target.value)} aria-label="Ingestion token name" disabled={!canManageOrganization} />
                <Button onClick={onCreateWorkflowToken} disabled={!canManageOrganization}>Create token</Button>
              </div>
              {generatedIngestionToken ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                  <div className="font-medium">Copy this token now. It will not be shown again.</div>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 overflow-x-auto rounded bg-background px-2 py-1 text-[11px] text-foreground">{generatedIngestionToken}</code>
                    <Button variant="outline" size="sm" onClick={onCopyGeneratedToken}>
                      <Copy data-icon="inline-start" />
                      Copy
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={onLoadIngestionTokens} disabled={!canManageOrganization}>Refresh tokens</Button>
                {ingestionTokenMessage ? <span className="text-xs text-muted-foreground">{ingestionTokenMessage}</span> : null}
              </div>
              {ingestionTokens.length ? (
                <div className="grid gap-2">
                  {ingestionTokens.map((token) => (
                    <div key={token.id} className="flex items-center justify-between gap-3 rounded-md border bg-background p-2 text-xs">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{token.name}</div>
                        <div className="mt-1 text-muted-foreground">{token.prefix}... / {token.revokedAt ? "Revoked" : token.lastUsedAt ? `Last used ${new Date(token.lastUsedAt).toLocaleString()}` : "Never used"}</div>
                      </div>
                      {token.revokedAt ? <Badge variant="secondary">Revoked</Badge> : <Button variant="ghost" size="sm" onClick={() => onRevokeWorkflowToken(token.id)} disabled={!canManageOrganization}>Revoke</Button>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No tokens loaded yet. Create one or refresh the project token list.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </SectionShell>
  )
}

function healthSourceCopy(node: EndpointNodeData) {
  if (node.override) return "Manual override"
  if (node.statusReason.toLowerCase().includes("threshold")) return "Threshold rule"
  if (node.statusReason.toLowerCase().includes("http") || node.statusReason.toLowerCase().includes("endpoint")) return "Endpoint check"
  if (node.statusReason.toLowerCase().includes("poll")) return "Latest poll"
  return "Seeded or manual status"
}

type ApiTestResult = {
  ok?: boolean
  status?: number
  contentType?: string
  parsedJson?: boolean
  preview?: unknown
  error?: string
  mappings?: {
    label: string
    ok: boolean
    jsonPath: string
    rawValue?: unknown
    value?: unknown
    unit?: string
    error?: string
    threshold?: {
      configured: boolean
      crossed: boolean
      message: string
    }
  }[]
}

function NodeInspector({
  selectedNode,
  currentUser,
  categories,
  projectId,
  alertRules,
  canEditProject,
  isRefreshingProject,
  onOverride,
  onRefreshProject,
  onRuleSaved,
  onPatch,
}: {
  selectedNode: EndpointNodeData
  currentUser: NonNullable<Session["user"]>
  categories: string[]
  projectId: string
  alertRules: WorkspacePayload["alertRules"]
  canEditProject: boolean
  isRefreshingProject: boolean
  onOverride: (status: NodeStatus) => void
  onRefreshProject: () => Promise<void>
  onRuleSaved: (rule: ProjectAlertRule) => void
  onPatch: (patch: Partial<EndpointNodeData>) => void
}) {
  const Icon = iconRegistry[selectedNode.icon] ?? iconRegistry.api
  const effectiveStatus = selectedNode.override ?? selectedNode.status
  const [apiUrl, setApiUrl] = useState(selectedNode.apiUrl)
  const [authType, setAuthType] = useState("NONE")
  const [secretValue, setSecretValue] = useState("")
  const [cadenceMin, setCadenceMin] = useState("15")
  const [mappingLabel, setMappingLabel] = useState("Primary metric")
  const [jsonPath, setJsonPath] = useState("$.value")
  const [transform, setTransform] = useState("none")
  const [unit, setUnit] = useState("")
  const [threshold, setThreshold] = useState("> 90")
  const [visualization, setVisualization] = useState("NUMBER")
  const [apiMessage, setApiMessage] = useState("")
  const [apiTestResult, setApiTestResult] = useState<ApiTestResult | null>(null)
  const nodeAlertRules = alertRules.filter((rule) => rule.nodeId === selectedNode.id)
  const firstPersistedParameter = selectedNode.parameters.find((parameter) => parameter.id)
  const [ruleId, setRuleId] = useState(nodeAlertRules[0]?.id ?? "")
  const [ruleMappingId, setRuleMappingId] = useState(nodeAlertRules[0]?.mappingId ?? firstPersistedParameter?.id ?? "")
  const [ruleName, setRuleName] = useState(nodeAlertRules[0]?.name ?? `${firstPersistedParameter?.label ?? mappingLabel} threshold crossed`)
  const [ruleExpression, setRuleExpression] = useState(nodeAlertRules[0]?.expression ?? threshold)
  const [ruleSeverity, setRuleSeverity] = useState(nodeAlertRules[0]?.severity ?? "WARNING")
  const [ruleEnabled, setRuleEnabled] = useState(nodeAlertRules[0]?.enabled ?? true)
  const [ruleMessage, setRuleMessage] = useState("")
  const [runMessage, setRunMessage] = useState("")
  const [templateMode, setTemplateMode] = useState<"basic" | "advanced">("basic")
  const [selectedTemplateId, setSelectedTemplateId] = useState<IntegrationTemplate["id"]>("dify")
  const [templateMessage, setTemplateMessage] = useState("")
  const realMetricCards = selectedNode.realMetrics?.length ? selectedNode.realMetrics : null
  const hasPersistedMappings = selectedNode.parameters.some((parameter) => parameter.id)
  const hasRealTrend =
    Boolean(selectedNode.realRollupSeries?.some((series) => series.points.length)) ||
    Boolean(selectedNode.realSampleSeries?.some((series) => series.points.length))
  const hasPersistedRuns = Boolean(selectedNode.hasPersistedRuns)
  const telemetryPayload = JSON.stringify(
    {
      nodeId: selectedNode.id,
      externalId: "run_001",
      status: "success",
      startedAt: "2026-06-12T09:30:00.000Z",
      finishedAt: "2026-06-12T09:30:02.400Z",
      costUsd: 0.042,
      tokens: 1280,
      steps: [
        { name: "Fetch context", status: "success", latencyMs: 420, toolName: "database" },
        { name: "Generate response", status: "success", latencyMs: 1700, toolName: "llm" },
      ],
    },
    null,
    2
  )
  const telemetryCurl = `curl -X POST "https://argusgrid.hrudainirmal.in/api/ingest/runs" \\
  -H "Authorization: Bearer <ingestion-token>" \\
  -H "Content-Type: application/json" \\
  -d '${telemetryPayload}'`
  const visibleTemplates = integrationTemplates
  const selectedTemplate = integrationTemplates.find((template) => template.id === selectedTemplateId) ?? integrationTemplates[0]
  const selectedTemplateSnippet = buildIntegrationSnippet(selectedTemplate, selectedNode.id)

  const useDemoMetric = () => {
    const demoUrl = `${window.location.origin}/api/demo/metric`
    setApiUrl(demoUrl)
    setAuthType("NONE")
    setSecretValue("")
    setCadenceMin("15")
    setMappingLabel("Demo metric")
    setJsonPath("$.value")
    setTransform("none")
    setUnit("score")
    setThreshold("> 90")
    setVisualization("NUMBER")
    setRuleName("Demo metric threshold crossed")
    setRuleExpression("> 90")
    setRuleSeverity("WARNING")
    setRuleEnabled(true)
    setApiMessage("Demo metric loaded. Test and save the API setup, then save the alert rule.")
  }

  const applyIntegrationTemplate = (template: IntegrationTemplate) => {
    setSelectedTemplateId(template.id)
    setTemplateMessage("")

    if (template.preset) {
      setApiUrl(template.preset.apiUrl)
      setAuthType(template.preset.authType)
      setSecretValue("")
      setCadenceMin(template.preset.cadenceMin)
      setMappingLabel(template.preset.mappingLabel)
      setJsonPath(template.preset.jsonPath)
      setTransform(template.preset.transform)
      setUnit(template.preset.unit)
      setThreshold(template.preset.threshold)
      setVisualization(template.preset.visualization)
      setRuleName(template.preset.ruleName)
      setRuleExpression(template.preset.ruleExpression)
      setRuleSeverity(template.preset.ruleSeverity)
      setRuleEnabled(true)
      setApiMessage("Template applied. Replace the endpoint URL, test it, then save API setup.")
      setTemplateMessage(`${template.name} fields applied.`)
      return
    }

    setTemplateMessage(`${template.name} selected. Copy the advanced snippet or follow the setup steps.`)
  }

  const testApiConfig = async () => {
    if (!canEditProject) {
      setApiMessage("Viewers cannot test private endpoint credentials.")
      return
    }
    setApiMessage("Testing endpoint...")
    setApiTestResult(null)
    const response = await fetch(`/api/projects/${projectId}/nodes/${selectedNode.id}/api-config/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: apiUrl,
        method: "GET",
        authType,
        secretValue,
        mappings: [
          {
            label: mappingLabel,
            jsonPath,
            transform,
            unit,
            threshold,
          },
        ],
      }),
    })
    const payload = (await response.json().catch(() => ({ error: "Endpoint test failed." }))) as ApiTestResult
    setApiTestResult(payload)
    setApiMessage(response.ok ? "Endpoint test completed." : payload.error ?? "Endpoint test failed.")
  }

  const saveApiConfig = async () => {
    if (!canEditProject) {
      setApiMessage("Viewers cannot change API configuration.")
      return
    }
    setApiMessage("Saving API configuration...")
    const response = await fetch(`/api/projects/${projectId}/nodes/${selectedNode.id}/api-config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: apiUrl,
        method: "GET",
        authType,
        secretName: `${selectedNode.label} credential`,
        secretValue,
        cadenceMin,
        mappings: [
          {
            label: mappingLabel,
            jsonPath,
            transform,
            unit,
            threshold,
            visualization,
          },
        ],
      }),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setApiMessage(payload?.error ?? "API configuration failed.")
      return
    }

    onPatch({
      apiUrl,
      auth: authType === "NONE" ? "None" : authType.replaceAll("_", " ").toLowerCase(),
      cadence: `Every ${cadenceMin} min`,
      parameters: payload?.mappings?.length
        ? payload.mappings
        : [
            {
              label: mappingLabel,
              path: jsonPath,
              transform,
              unit,
            },
          ],
    })
    if (payload?.mappings?.[0]?.id) {
      setRuleMappingId(payload.mappings[0].id)
    }
    setSecretValue("")
    setApiMessage("API configuration saved.")
  }

  const saveAlertRule = async () => {
    if (!canEditProject) {
      setRuleMessage("Viewers cannot change alert rules.")
      return
    }
    const parameter = selectedNode.parameters.find((candidate) => candidate.id === ruleMappingId)
    if (!parameter?.id) {
      setRuleMessage("Save an API mapping first, then attach a rule to it.")
      return
    }

    setRuleMessage("Saving alert rule...")
    const response = await fetch(`/api/projects/${projectId}/alert-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: ruleId || undefined,
        nodeId: selectedNode.id,
        mappingId: parameter.id,
        mappingLabel: parameter.label,
        name: ruleName,
        expression: ruleExpression,
        severity: ruleSeverity,
        enabled: ruleEnabled,
      }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setRuleMessage(payload?.error ?? "Alert rule failed.")
      return
    }

    const savedRule = {
      ...payload.rule,
      createdAt: payload.rule.createdAt ?? new Date().toISOString(),
      updatedAt: payload.rule.updatedAt ?? new Date().toISOString(),
      nodeLabel: selectedNode.label,
      mappingLabel: parameter.label,
    } as ProjectAlertRule
    setRuleId(savedRule.id)
    onRuleSaved(savedRule)
    setRuleMessage("Alert rule saved.")
  }

  const copyTelemetryExample = async () => {
    await navigator.clipboard.writeText(telemetryCurl)
    setRunMessage("Telemetry example copied.")
  }

  const copySelectedTemplateSnippet = async () => {
    await navigator.clipboard.writeText(selectedTemplateSnippet)
    setTemplateMessage(`${selectedTemplate.name} snippet copied.`)
  }

  return (
    <aside className="min-h-0 overflow-y-auto border-l bg-background">
      <div className="sticky top-0 z-10 border-b bg-background/95 px-5 py-4 backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl border bg-muted">
            {selectedNode.customIconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="size-7 object-contain" src={selectedNode.customIconUrl} />
            ) : (
              <Icon className="size-6" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold">{selectedNode.label}</h2>
              <span className={cn("size-2.5 rounded-full", statusDot[effectiveStatus])} />
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{selectedNode.description}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <Card>
          <CardHeader>
            <CardTitle>Endpoint Health</CardTitle>
            <CardDescription>{selectedNode.statusReason}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline">Source: {healthSourceCopy(selectedNode)}</Badge>
              {selectedNode.freshnessLabel ? <Badge variant="secondary">Sampled {selectedNode.freshnessLabel}</Badge> : null}
              {selectedNode.override ? <Badge variant="secondary">Admin override active</Badge> : null}
            </div>
            {realMetricCards ? (
              <div className="grid grid-cols-2 gap-3">
                {realMetricCards.map((metric) => (
                  <div key={metric.mappingId ?? metric.label} className="rounded-lg border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">{metric.label}</div>
                    <div className="mt-1 text-xl font-semibold">{metric.displayValue}</div>
                    <div className={cn("mt-1 text-xs", toneClasses[metric.tone])}>
                      {metric.threshold ? `Threshold ${metric.threshold}` : "No threshold"}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">Sampled {formatSampledAt(metric.sampledAt)}</div>
                  </div>
                ))}
              </div>
            ) : hasPersistedMappings ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                This node has saved mappings, but no metric samples yet. Run poll now to populate real cards and charts.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {selectedNode.metrics.map((metric) => (
                  <div key={metric.label} className="rounded-lg border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">{metric.label}</div>
                    <div className="mt-1 text-xl font-semibold">{metric.value}</div>
                    <div className={cn("mt-1 text-xs", toneClasses[metric.tone])}>{metric.delta}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-center gap-2">
              {(["active", "degraded", "down"] as NodeStatus[]).map((status) => (
                <Button key={status} variant={effectiveStatus === status ? "default" : "outline"} size="sm" onClick={() => onOverride(status)} disabled={!canEditProject}>
                  {statusCopy[status]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="setup">Setup</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-3 flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Node Operating Summary</CardTitle>
                <CardDescription>Daily-read status before deeper configuration.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">API endpoint</div>
                    <div className="mt-1 truncate text-sm font-medium">{selectedNode.apiUrl}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">Cadence</div>
                    <div className="mt-1 text-sm font-medium">{selectedNode.cadence}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">Latest sample</div>
                    <div className="mt-1 text-sm font-medium">{selectedNode.latestSampledAt ? formatSampledAt(selectedNode.latestSampledAt) : "No real sample yet"}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">Saved mappings</div>
                    <div className="mt-1 text-sm font-medium">{selectedNode.parameters.filter((parameter) => parameter.id).length}</div>
                  </div>
                </div>
                <Button variant="outline" onClick={onRefreshProject} disabled={isRefreshingProject}>
                  <Activity data-icon="inline-start" />
                  {isRefreshingProject ? "Refreshing" : "Refresh node data"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metrics" className="mt-3 flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Metric Trend</CardTitle>
                <CardDescription>{hasRealTrend ? "Recent persisted samples and hourly rollups" : "Seeded fallback until samples exist"}</CardDescription>
              </CardHeader>
              <CardContent>
                <LatencyChart node={selectedNode} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Cost And Quality</CardTitle>
                <CardDescription>Prototype ECharts mixed mode</CardDescription>
              </CardHeader>
              <CardContent>
                <CostQualityChart node={selectedNode} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Incident Heatmap</CardTitle>
                <CardDescription>Alert concentration by time bucket</CardDescription>
              </CardHeader>
              <CardContent>
                <IncidentHeatmap node={selectedNode} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runs" className="mt-3 flex flex-col gap-4">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>Recent Runs</CardTitle>
                  <CardDescription>{hasPersistedRuns ? "Persisted workflow telemetry for this node" : "Post workflow runs with a project ingestion token"}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={onRefreshProject} disabled={isRefreshingProject}>
                  <Activity data-icon="inline-start" />
                  {isRefreshingProject ? "Refreshing" : "Refresh runs"}
                </Button>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {!hasPersistedRuns ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm">
                    <div className="font-medium">No submitted workflow runs yet.</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Create a project ingestion token in Deployment diagnostics, then post a run for this node.
                    </div>
                    <pre className="mt-3 max-h-52 overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] text-muted-foreground">
                      {telemetryCurl}
                    </pre>
                    <div className="mt-3 flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={copyTelemetryExample}>
                        <Copy data-icon="inline-start" />
                        Copy example
                      </Button>
                      {runMessage ? <span className="text-xs text-muted-foreground">{runMessage}</span> : null}
                    </div>
                  </div>
                ) : null}
                {selectedNode.runs.length ? (
                  <div className="grid gap-2">
                    {!hasPersistedRuns ? <div className="text-xs font-medium text-muted-foreground">Sample fallback rows</div> : null}
                    {selectedNode.runs.map((run) => (
                      <div key={`${run.id}-${run.startedAt ?? run.started}`} className="rounded-lg border bg-muted/20 p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{run.externalId ?? run.id}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Started {run.startedAt ? formatSampledAt(run.startedAt) : run.started}
                            </div>
                          </div>
                          <Badge variant={runBadgeVariant(run.status)}>{run.status}</Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                          <div>
                            <span className="block font-medium text-foreground">Duration</span>
                            {run.latency}
                          </div>
                          <div>
                            <span className="block font-medium text-foreground">Cost</span>
                            {run.cost}
                          </div>
                          <div>
                            <span className="block font-medium text-foreground">Tokens</span>
                            {run.tokens ?? "n/a"}
                          </div>
                          <div>
                            <span className="block font-medium text-foreground">Steps</span>
                            {run.stepCount ?? run.steps?.length ?? 0}
                          </div>
                        </div>
                        {run.steps?.length ? (
                          <details className="mt-3 rounded-md border bg-background/70 p-2 text-xs">
                            <summary className="cursor-pointer font-medium">Step details</summary>
                            <div className="mt-2 grid gap-2">
                              {run.steps.map((step) => (
                                <div key={step.id} className="flex items-center justify-between gap-2 rounded border p-2">
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium">{step.name}</span>
                                    <span className="block truncate text-muted-foreground">{step.toolName ?? "No tool"}</span>
                                  </span>
                                  <span className="shrink-0 text-right text-muted-foreground">
                                    {step.status}
                                    {step.latencyMs !== null && step.latencyMs !== undefined ? ` / ${step.latencyMs}ms` : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="alerts" className="mt-3 flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Alerts</CardTitle>
                <CardDescription>Node-level in-app events and current alert context</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {selectedNode.alerts.length ? (
                  selectedNode.alerts.map((alert) => (
                    <div key={`${alert.title}-${alert.time}`} className="flex items-start gap-3 rounded-lg border p-3">
                      <span
                        className={cn(
                          "mt-1 size-2.5 rounded-full",
                          alert.severity === "critical" ? "bg-rose-500" : alert.severity === "warning" ? "bg-amber-500" : "bg-cyan-500"
                        )}
                      />
                      <div>
                        <div className="text-sm font-medium">{alert.title}</div>
                        <div className="text-xs text-muted-foreground">{alert.time}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No active alerts for this endpoint.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="setup" className="mt-3 flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Node Basics</CardTitle>
                <CardDescription>Changes autosave into the project graph</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Input value={selectedNode.label} onChange={(event) => onPatch({ label: event.target.value })} aria-label="Node label" disabled={!canEditProject} />
                <Textarea
                  value={selectedNode.description}
                  onChange={(event) => onPatch({ description: event.target.value })}
                  aria-label="Node description"
                  disabled={!canEditProject}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Monitoring Setup</CardTitle>
                <CardDescription>Open focused setup widgets for templates, API polling, and alert rules</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Dialog>
                    <DialogTrigger render={<Button variant="outline" className="h-auto justify-start p-3" />}>
                      <Sparkles data-icon="inline-start" />
                      Templates
                    </DialogTrigger>
                    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl">
                      <DialogHeader>
                        <DialogTitle>Integration templates</DialogTitle>
                        <DialogDescription>Choose a basic setup card or copy an advanced payload for the selected node.</DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
                        <div className="text-xs text-muted-foreground">
                          Templates show whether they create metric samples or workflow runs. Snippets use node id {selectedNode.id}.
                        </div>
                        <div className="grid grid-cols-2 rounded-lg border bg-background p-1 text-xs">
                          <Button variant={templateMode === "basic" ? "default" : "ghost"} size="sm" onClick={() => setTemplateMode("basic")}>
                            Basic
                          </Button>
                          <Button variant={templateMode === "advanced" ? "default" : "ghost"} size="sm" onClick={() => setTemplateMode("advanced")}>
                            Advanced
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                        <div className="grid content-start gap-2">
                          {visibleTemplates.map((template) => (
                            <div
                              key={template.id}
                              className={cn(
                                "rounded-lg border bg-background/70 p-3 text-xs",
                                selectedTemplate.id === template.id && "border-primary/60 shadow-sm"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">{template.name}</span>
                                    <Badge variant={template.setupKind === "metric" ? "secondary" : "outline"}>
                                      {template.setupKind === "metric" ? "Metric samples" : "Workflow runs"}
                                    </Badge>
                                    <Badge variant="outline">{template.difficulty}</Badge>
                                  </div>
                                  <div className="mt-1 text-muted-foreground">{template.description}</div>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => applyIntegrationTemplate(template)} disabled={!canEditProject && template.setupKind === "metric"}>
                                  {template.preset ? "Apply fields" : "Select"}
                                </Button>
                              </div>
                              {templateMode === "basic" ? (
                                <div className="mt-3 grid gap-2">
                                  <div className="flex flex-wrap gap-1">
                                    {template.requiredFields.map((field) => (
                                      <Badge key={field} variant="outline">
                                        {field}
                                      </Badge>
                                    ))}
                                  </div>
                                  <div className="grid gap-1 text-muted-foreground">
                                    {template.basicSteps.map((step, index) => (
                                      <div key={step}>
                                        {index + 1}. {step}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        <div className="rounded-lg border bg-background/70 p-3 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-medium">{selectedTemplate.name} advanced snippet</div>
                              <div className="mt-1 text-muted-foreground">Uses the placeholder &lt;ingestion-token&gt;; no real token is exposed.</div>
                            </div>
                            <Button variant="outline" size="sm" onClick={copySelectedTemplateSnippet}>
                              <Copy data-icon="inline-start" />
                              Copy
                            </Button>
                          </div>
                          <pre className="mt-3 max-h-[52vh] overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] text-muted-foreground">
                            {selectedTemplateSnippet}
                          </pre>
                        </div>
                      </div>
                      {templateMessage ? <div className="text-xs text-muted-foreground">{templateMessage}</div> : null}
                    </DialogContent>
                  </Dialog>

                  <Dialog>
                    <DialogTrigger render={<Button variant="outline" className="h-auto justify-start p-3" />}>
                      <Gauge data-icon="inline-start" />
                      API Setup
                    </DialogTrigger>
                    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>API setup</DialogTitle>
                        <DialogDescription>Configure one deployed endpoint, JSONPath mapping, and test response preview.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                        <div className="grid content-start gap-3">
                          <Button variant="outline" onClick={useDemoMetric} disabled={!canEditProject}>
                            <Wand2 data-icon="inline-start" />
                            Use demo metric
                          </Button>
                          <Input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} aria-label="Endpoint URL" disabled={!canEditProject} />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <select className="h-9 rounded-lg border bg-background px-2 text-sm disabled:opacity-50" value={authType} onChange={(event) => setAuthType(event.target.value)} disabled={!canEditProject}>
                              <option value="NONE">No auth</option>
                              <option value="API_KEY_HEADER">API key header</option>
                              <option value="BEARER_TOKEN">Bearer token</option>
                              <option value="BASIC">Basic auth</option>
                              <option value="CUSTOM_HEADERS">Custom headers</option>
                            </select>
                            <Input value={cadenceMin} onChange={(event) => setCadenceMin(event.target.value)} aria-label="Cadence minutes" disabled={!canEditProject} />
                          </div>
                          <Input
                            value={secretValue}
                            onChange={(event) => setSecretValue(event.target.value)}
                            placeholder="Secret value, encrypted before storage"
                            type="password"
                            disabled={!canEditProject}
                          />
                          <Separator />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Input value={mappingLabel} onChange={(event) => setMappingLabel(event.target.value)} aria-label="Mapping label" disabled={!canEditProject} />
                            <Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Unit" disabled={!canEditProject} />
                          </div>
                          <Input value={jsonPath} onChange={(event) => setJsonPath(event.target.value)} aria-label="JSONPath" disabled={!canEditProject} />
                          <Input value={transform} onChange={(event) => setTransform(event.target.value)} aria-label="Transform" placeholder="Transform, e.g. none, round:1, divide:1000" disabled={!canEditProject} />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Input value={threshold} onChange={(event) => setThreshold(event.target.value)} aria-label="Threshold" disabled={!canEditProject} />
                            <select className="h-9 rounded-lg border bg-background px-2 text-sm disabled:opacity-50" value={visualization} onChange={(event) => setVisualization(event.target.value)} disabled={!canEditProject}>
                              <option value="NUMBER">Number</option>
                              <option value="LINE">Line</option>
                              <option value="BAR">Bar</option>
                              <option value="TABLE">Table</option>
                              <option value="STATUS">Status</option>
                              <option value="HEATMAP">Heatmap</option>
                            </select>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Button variant="outline" onClick={testApiConfig} disabled={!canEditProject}>Test endpoint</Button>
                            <Button onClick={saveApiConfig} disabled={!canEditProject}>Save API setup</Button>
                          </div>
                          {apiMessage ? <div className="text-xs text-muted-foreground">{apiMessage}</div> : null}
                        </div>
                        <div className="grid content-start gap-3">
                          {apiTestResult ? (
                            <div className="rounded-lg border bg-muted/20 p-3 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={apiTestResult.ok ? "secondary" : "destructive"}>
                                  {apiTestResult.status ? `HTTP ${apiTestResult.status}` : apiTestResult.ok ? "OK" : "Failed"}
                                </Badge>
                                {apiTestResult.contentType ? <Badge variant="outline">{apiTestResult.contentType}</Badge> : null}
                                {apiTestResult.parsedJson === false ? <Badge variant="outline">Non-JSON response</Badge> : null}
                              </div>
                              {apiTestResult.error ? <div className="mt-2 text-destructive">{apiTestResult.error}</div> : null}
                              {apiTestResult.mappings?.length ? (
                                <div className="mt-3 grid gap-2">
                                  {apiTestResult.mappings.map((mapping) => (
                                    <div key={mapping.label} className="rounded-md border bg-background/70 p-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium">{mapping.label}</span>
                                        <Badge variant={mapping.ok ? "secondary" : "destructive"}>{mapping.ok ? "Mapped" : "Missing"}</Badge>
                                      </div>
                                      <div className="mt-1 font-mono text-muted-foreground">{mapping.jsonPath}</div>
                                      {mapping.error ? <div className="mt-1 text-destructive">{mapping.error}</div> : null}
                                      {mapping.ok ? (
                                        <div className="mt-1">
                                          Value: {String(mapping.value)}{mapping.unit ? ` ${mapping.unit}` : ""}
                                        </div>
                                      ) : null}
                                      {mapping.threshold ? (
                                        <div className={cn("mt-1", mapping.threshold.crossed ? "text-amber-600 dark:text-amber-300" : "text-muted-foreground")}>
                                          Threshold: {mapping.threshold.message}
                                        </div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              {apiTestResult.preview !== undefined ? (
                                <pre className="mt-3 max-h-[42vh] overflow-auto rounded-md bg-background p-2 font-mono text-[11px]">
                                  {JSON.stringify(apiTestResult.preview, null, 2).slice(0, 4000)}
                                </pre>
                              ) : null}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                              Test an endpoint to preview JSON, mapped values, and threshold feedback here.
                            </div>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog>
                    <DialogTrigger render={<Button variant="outline" className="h-auto justify-start p-3" />}>
                      <Bell data-icon="inline-start" />
                      Alert Rule
                    </DialogTrigger>
                    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Alert rule</DialogTitle>
                        <DialogDescription>Create a threshold rule from a saved parameter mapping.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                        <div className="grid content-start gap-3 rounded-lg border bg-muted/20 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium">Threshold rule</div>
                              <div className="mt-1 text-xs text-muted-foreground">Attach this rule to a saved API mapping.</div>
                            </div>
                            <Badge variant={ruleEnabled ? "secondary" : "outline"}>{ruleEnabled ? "Enabled" : "Disabled"}</Badge>
                          </div>
                          <select
                            className="h-9 rounded-lg border bg-background px-2 text-sm disabled:opacity-50"
                            value={ruleMappingId}
                            onChange={(event) => {
                              const parameter = selectedNode.parameters.find((candidate) => candidate.id === event.target.value)
                              setRuleMappingId(event.target.value)
                              if (parameter) {
                                setRuleName(`${parameter.label} threshold crossed`)
                              }
                            }}
                            disabled={!canEditProject}
                          >
                            {selectedNode.parameters.filter((parameter) => parameter.id).length ? null : (
                              <option value="">No saved mappings yet</option>
                            )}
                            {selectedNode.parameters
                              .filter((parameter) => parameter.id)
                              .map((parameter) => (
                                <option key={parameter.id} value={parameter.id}>
                                  {parameter.label}
                                </option>
                              ))}
                          </select>
                          <Input value={ruleName} onChange={(event) => setRuleName(event.target.value)} aria-label="Alert rule name" disabled={!canEditProject} />
                          <div className="grid gap-2 sm:grid-cols-[1fr_130px]">
                            <Input
                              value={ruleExpression}
                              onChange={(event) => setRuleExpression(event.target.value)}
                              aria-label="Alert rule threshold"
                              placeholder="> 90"
                              disabled={!canEditProject}
                            />
                            <select
                              className="h-9 rounded-lg border bg-background px-2 text-sm disabled:opacity-50"
                              value={ruleSeverity}
                              onChange={(event) => setRuleSeverity(event.target.value)}
                              disabled={!canEditProject}
                            >
                              <option value="INFO">Info</option>
                              <option value="WARNING">Warning</option>
                              <option value="CRITICAL">Critical</option>
                            </select>
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={ruleEnabled} onChange={(event) => setRuleEnabled(event.target.checked)} disabled={!canEditProject} />
                            Rule enabled
                          </label>
                          <Button onClick={saveAlertRule} disabled={!canEditProject}>
                            Save alert rule
                          </Button>
                          {ruleMessage ? <div className="text-xs text-muted-foreground">{ruleMessage}</div> : null}
                        </div>
                        <div className="grid content-start gap-2">
                          <div className="text-sm font-medium">Saved rules</div>
                          {nodeAlertRules.length ? (
                            nodeAlertRules.map((rule) => (
                              <div key={rule.id} className="rounded-md border bg-background/70 p-2 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium">{rule.name}</span>
                                  <Badge variant={rule.enabled ? "secondary" : "outline"}>{rule.severity}</Badge>
                                </div>
                                <div className="mt-1 text-muted-foreground">
                                  {rule.mappingLabel ?? "Mapping"} {rule.expression}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">No alert rules saved for this node yet.</div>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                {(templateMessage || apiMessage || ruleMessage) ? (
                  <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                    {templateMessage ? <div>{templateMessage}</div> : null}
                    {apiMessage ? <div>{apiMessage}</div> : null}
                    {ruleMessage ? <div>{ruleMessage}</div> : null}
                  </div>
                ) : null}
                {selectedNode.parameters.map((parameter) => (
                  <div key={parameter.label} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{parameter.label}</div>
                      <Badge variant="outline">{parameter.unit}</Badge>
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">{parameter.path}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Transform: {parameter.transform}</div>
                  </div>
                ))}
                <Separator />
                <div>
                  <div className="text-sm font-medium">Default Monitoring Categories</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <Badge key={category} variant={category === selectedNode.category ? "default" : "secondary"}>
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-xs text-muted-foreground">Signed in as {currentUser.email ?? currentUser.name ?? "GitHub user"}</div>
      </div>
    </aside>
  )
}

function EmptyInspector({
  currentUser,
  onAddNode,
}: {
  currentUser: NonNullable<Session["user"]>
  onAddNode: () => void
}) {
  return (
    <aside className="min-h-0 overflow-y-auto border-l bg-background">
      <div className="flex flex-col gap-4 p-5">
        <Card>
          <CardHeader>
            <CardTitle>Start The Project Map</CardTitle>
            <CardDescription>Create the first endpoint node for this blank project.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={onAddNode}>
              <Plus data-icon="inline-start" />
              Add endpoint node
            </Button>
            <div className="text-xs text-muted-foreground">Signed in as {currentUser.email ?? currentUser.name ?? "GitHub user"}</div>
          </CardContent>
        </Card>
      </div>
    </aside>
  )
}
