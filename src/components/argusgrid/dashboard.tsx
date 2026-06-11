"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  CircleDollarSign,
  CheckCircle2,
  Copy,
  Edit3,
  Gauge,
  HardDriveUpload,
  KeyRound,
  LayoutDashboard,
  MailCheck,
  Moon,
  Network,
  Plus,
  Save,
  Search,
  Send,
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
  DialogFooter,
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
import { CostQualityChart, IncidentHeatmap, LatencyChart, RelationshipSankey } from "@/components/argusgrid/charts"
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
type IngestionTokenRecord = {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export function ArgusGridDashboard({
  initialWorkspace,
  currentUser,
}: {
  initialWorkspace: WorkspacePayload
  currentUser: NonNullable<Session["user"]>
}) {
  const [selectedId, setSelectedId] = useState(initialWorkspace.nodes[0]?.id ?? "")
  const [editMode, setEditMode] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [saveState, setSaveState] = useState<SaveState>("saved")
  const [newProjectName, setNewProjectName] = useState("New AI workflow")
  const [newProjectMode, setNewProjectMode] = useState<ProjectMode>("blank")
  const [projectName, setProjectName] = useState(initialWorkspace.project.name)
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
  const [selectedAlertDetail, setSelectedAlertDetail] = useState<ProjectAlert | null>(null)
  const [emailEnabled, setEmailEnabled] = useState(initialWorkspace.notificationPreference.enabled)
  const [emailSeverity, setEmailSeverity] = useState(initialWorkspace.notificationPreference.severity)
  const [emailMessage, setEmailMessage] = useState("")
  const [latestPoll, setLatestPoll] = useState(initialWorkspace.diagnostics.latestPoll)
  const [latestEmail, setLatestEmail] = useState(initialWorkspace.diagnostics.latestEmail)
  const [pollMessage, setPollMessage] = useState("")
  const [iconMessage, setIconMessage] = useState("")
  const [ingestionTokens, setIngestionTokens] = useState<IngestionTokenRecord[]>([])
  const [ingestionTokenName, setIngestionTokenName] = useState("Workflow telemetry token")
  const [ingestionTokenMessage, setIngestionTokenMessage] = useState("")
  const [generatedIngestionToken, setGeneratedIngestionToken] = useState("")
  const [nodes, setNodes, onNodesChange] = useNodesState(initialWorkspace.nodes.map(toFlowNode))
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialWorkspace.edges.map(toFlowEdge))
  const didMountRef = useRef(false)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const iconInputRef = useRef<HTMLInputElement | null>(null)
  const canManageOrganization = initialWorkspace.currentUserRole === "OWNER" || initialWorkspace.currentUserRole === "ADMIN"
  const canEditProject = canManageOrganization || initialWorkspace.currentUserRole === "MEMBER"

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
  const filteredAlerts = useMemo(
    () =>
      alerts.filter((alert) => {
        if (alertStatusFilter === "active" && alert.resolvedAt) return false
        if (alertStatusFilter === "resolved" && !alert.resolvedAt) return false
        if (alertSeverityFilter !== "all" && alert.severity !== alertSeverityFilter) return false
        return true
      }),
    [alertSeverityFilter, alertStatusFilter, alerts]
  )

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

  const renameProject = async () => {
    if (!canManageOrganization) {
      setActionMessage("Only owners and admins can rename projects.")
      return
    }
    setActionMessage("Renaming project...")
    const response = await fetch(`/api/projects/${initialWorkspace.project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName }),
    })
    if (response.ok) {
      window.location.href = `/?project=${initialWorkspace.project.id}`
      return
    }
    setActionMessage("Project rename failed.")
  }

  const archiveProject = async () => {
    if (!canManageOrganization) {
      setActionMessage("Only owners and admins can archive projects.")
      return
    }
    setActionMessage("Archiving project...")
    const response = await fetch(`/api/projects/${initialWorkspace.project.id}`, { method: "DELETE" })
    if (response.ok) {
      window.location.href = "/"
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

  const resolveAlert = async (alertId: string) => {
    const response = await fetch(`/api/alerts/${alertId}`, { method: "PATCH" })
    if (!response.ok) return
    const resolvedAt = new Date().toISOString()
    setAlerts((currentAlerts) => currentAlerts.map((alert) => (alert.id === alertId ? { ...alert, resolvedAt } : alert)))
    setSelectedAlertDetail((alert) => (alert?.id === alertId ? { ...alert, resolvedAt } : alert))
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
    document.documentElement.classList.toggle("dark", next === "dark")
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
          <div className="text-xs text-muted-foreground">Project</div>
          <select
            className="mt-2 h-9 w-full rounded-lg border bg-background px-2 text-sm"
            value={initialWorkspace.project.id}
            onChange={(event) => {
              window.location.href = `/?project=${event.target.value}`
            }}
          >
            {initialWorkspace.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Dialog>
              <DialogTrigger render={<Button variant="outline" size="sm" disabled={!canManageOrganization} />}>New</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create project</DialogTitle>
                  <DialogDescription>Add a deployed project workspace.</DialogDescription>
                </DialogHeader>
                <Input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={newProjectMode === "blank" ? "default" : "outline"} onClick={() => setNewProjectMode("blank")}>
                    Blank
                  </Button>
                  <Button variant={newProjectMode === "demo" ? "default" : "outline"} onClick={() => setNewProjectMode("demo")}>
                    Demo
                  </Button>
                </div>
                <DialogFooter>
                  <Button onClick={createProject}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger render={<Button variant="outline" size="sm" disabled={!canManageOrganization} />}>Manage</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Manage project</DialogTitle>
                  <DialogDescription>Rename or archive this project.</DialogDescription>
                </DialogHeader>
                <Input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
                <DialogFooter>
                  <Button variant="destructive" onClick={archiveProject}>
                    <Trash2 data-icon="inline-start" />
                    Archive
                  </Button>
                  <Button onClick={renameProject}>Rename</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <nav className="mt-5 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:flex lg:flex-1 lg:flex-col">
          <SidebarItem icon={LayoutDashboard} active label="Project Map" />
          <SidebarItem icon={Activity} label="Runs & Steps" />
          <SidebarItem icon={CircleDollarSign} label="Cost & Usage" />
          <SidebarItem icon={Gauge} label="Quality & Evals" />
          <SidebarItem icon={Bell} label="Alerts" count={String(alerts.filter((alert) => !alert.resolvedAt).length)} />
          <SidebarItem icon={ShieldCheck} label="Security" />
        </nav>

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

        <Dialog>
          <DialogTrigger render={<Button variant="outline" className="mb-3 justify-start" />}>
            <ShieldCheck data-icon="inline-start" />
            Deployment
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Deployment readiness</DialogTitle>
              <DialogDescription>Safe production checks for the deployed demo. Secret values are never shown.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <ReadinessItem label="Database connected" ready={initialWorkspace.diagnostics.checks.database} />
              <ReadinessItem label="GitHub OAuth ready" ready={initialWorkspace.diagnostics.checks.auth} />
              <ReadinessItem label="Encryption enabled" ready={initialWorkspace.diagnostics.checks.encryption} />
              <ReadinessItem label="Cron secret configured" ready={initialWorkspace.diagnostics.checks.cron} />
              <ReadinessItem label="Email provider configured" ready={initialWorkspace.diagnostics.checks.email} />
            </div>
            <Separator />
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
            <Separator />
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
            <Separator />
            <div className="grid gap-2">
              <Button onClick={runPollNow} disabled={!canManageOrganization}>
                <Activity data-icon="inline-start" />
                Run poll now
              </Button>
              {pollMessage ? <div className="text-xs text-muted-foreground">{pollMessage}</div> : null}
            </div>
            <Separator />
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
          </DialogContent>
        </Dialog>

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
              <h1 className="truncate text-lg font-semibold">{initialWorkspace.project.name}</h1>
              <p className="text-xs text-muted-foreground">Graph-first endpoint monitoring workspace</p>
            </div>
            <Badge variant="secondary">Vercel Hobby + Neon Free prototype</Badge>
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
            <Button variant={editMode ? "default" : "outline"} onClick={() => setEditMode((value) => !value)} disabled={!canEditProject}>
              <Edit3 data-icon="inline-start" />
              {canEditProject ? (editMode ? "Editing" : "View mode") : "Read only"}
            </Button>
            <Button onClick={addEndpointNode} disabled={!canEditProject}>
              <Plus data-icon="inline-start" />
              Add node
            </Button>
            <Button variant="ghost" onClick={() => signOut({ callbackUrl: "/" })}>
              Sign out
            </Button>
          </div>
          {actionMessage ? <div className="text-xs text-muted-foreground">{actionMessage}</div> : null}
        </header>

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
                  Visual endpoint map
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Connections are user-configured visual relationships. Metrics and alerts come from each node&apos;s REST mappings.
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
            alerts={alerts}
            alertRules={alertRules}
            canEditProject={canEditProject}
            onOverride={setStatusOverride}
            onResolveAlert={resolveAlert}
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
      </main>
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
                <Button onClick={() => resolveAlert(selectedAlertDetail.id)}>
                  <CheckCircle2 data-icon="inline-start" />
                  Resolve alert
                </Button>
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
}: {
  icon: typeof Bot
  label: string
  active?: boolean
  count?: string
}) {
  return (
    <button
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
  alerts,
  alertRules,
  canEditProject,
  onOverride,
  onResolveAlert,
  onRuleSaved,
  onPatch,
}: {
  selectedNode: EndpointNodeData
  currentUser: NonNullable<Session["user"]>
  categories: string[]
  projectId: string
  alerts: WorkspacePayload["alerts"]
  alertRules: WorkspacePayload["alertRules"]
  canEditProject: boolean
  onOverride: (status: NodeStatus) => void
  onResolveAlert: (alertId: string) => void
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<IntegrationTemplate["id"]>("generic-webhook")
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

        <Tabs defaultValue="analytics">
          <TabsList>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>
          <TabsContent value="analytics" className="mt-3 flex flex-col gap-4">
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
            <Card>
              <CardHeader>
                <CardTitle>Relationship Flow</CardTitle>
                <CardDescription>Sankey view of visual endpoint relationships</CardDescription>
              </CardHeader>
              <CardContent>
                <RelationshipSankey />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runs" className="mt-3 flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Runs</CardTitle>
                <CardDescription>{hasPersistedRuns ? "Persisted workflow telemetry for this node" : "Post workflow runs with a project ingestion token"}</CardDescription>
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

            <Card>
              <CardHeader>
                <CardTitle>Alerts</CardTitle>
                <CardDescription>In-app events, email delivery later</CardDescription>
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

          <TabsContent value="api" className="mt-3 flex flex-col gap-4">
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
                <CardTitle>API Configuration</CardTitle>
                <CardDescription>Save a deployed polling target and metric mapping</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Integration templates</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Pick a basic setup card or switch to advanced for copyable payloads.
                      </div>
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
                  <div className="mt-3 grid gap-2">
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
                  {templateMode === "advanced" ? (
                    <div className="mt-3 rounded-lg border bg-background/70 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{selectedTemplate.name} advanced snippet</div>
                          <div className="mt-1 text-muted-foreground">Uses node id {selectedNode.id} and the placeholder &lt;ingestion-token&gt;.</div>
                        </div>
                        <Button variant="outline" size="sm" onClick={copySelectedTemplateSnippet}>
                          <Copy data-icon="inline-start" />
                          Copy
                        </Button>
                      </div>
                      <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] text-muted-foreground">
                        {selectedTemplateSnippet}
                      </pre>
                    </div>
                  ) : null}
                  {templateMessage ? <div className="mt-2 text-xs text-muted-foreground">{templateMessage}</div> : null}
                </div>
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
                      <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-background p-2 font-mono text-[11px]">
                        {JSON.stringify(apiTestResult.preview, null, 2).slice(0, 4000)}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
                <Separator />
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Alert rule</div>
                      <div className="mt-1 text-xs text-muted-foreground">Create a threshold rule from a saved parameter mapping.</div>
                    </div>
                    <Badge variant={ruleEnabled ? "secondary" : "outline"}>{ruleEnabled ? "Enabled" : "Disabled"}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2">
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
                  {nodeAlertRules.length ? (
                    <div className="mt-3 grid gap-2">
                      {nodeAlertRules.map((rule) => (
                        <div key={rule.id} className="rounded-md border bg-background/70 p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{rule.name}</span>
                            <Badge variant={rule.enabled ? "secondary" : "outline"}>{rule.severity}</Badge>
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            {rule.mappingLabel ?? "Mapping"} {rule.expression}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Separator />
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Alert Center</CardTitle>
            <CardDescription>In-app alerts from cron polling</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {alerts.length ? (
              alerts.map((alert) => (
                <div key={alert.id} className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{alert.title}</div>
                    <div className="text-xs text-muted-foreground">{alert.nodeLabel ?? "Project"} / {alert.severity}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{alert.message}</div>
                  </div>
                  {alert.resolvedAt ? (
                    <Badge variant="secondary">Resolved</Badge>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => onResolveAlert(alert.id)} disabled={!canEditProject}>
                      <CheckCircle2 data-icon="inline-start" />
                      Resolve
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No cron-generated alerts yet.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default Monitoring Categories</CardTitle>
            <CardDescription>Curated AI-ops taxonomy, editable per project</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge key={category} variant={category === selectedNode.category ? "default" : "secondary"}>
                {category}
              </Badge>
            ))}
          </CardContent>
        </Card>
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
