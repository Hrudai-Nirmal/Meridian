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
} from "@xyflow/react"
import {
  Activity,
  Bell,
  Bot,
  ChevronDown,
  CircleDollarSign,
  CheckCircle2,
  Edit3,
  Gauge,
  HardDriveUpload,
  LayoutDashboard,
  Moon,
  Network,
  Plus,
  Save,
  Search,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { cn } from "@/lib/utils"
import type { WorkspacePayload } from "@/lib/workspace"

const nodeTypes = { endpoint: EndpointGraphNode }

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

type SaveState = "saved" | "saving" | "error"
type ProjectMode = "blank" | "demo"

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
  const [nodes, setNodes, onNodesChange] = useNodesState(initialWorkspace.nodes.map(toFlowNode))
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialWorkspace.edges.map(toFlowEdge))
  const didMountRef = useRef(false)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const addEndpointNode = () => {
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
    }

    setNodes((currentNodes) => currentNodes.concat(toFlowNode(newNode)))
    setSelectedId(id)
    setEditMode(true)
  }

  const createProject = async () => {
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
    setActionMessage("Archiving project...")
    const response = await fetch(`/api/projects/${initialWorkspace.project.id}`, { method: "DELETE" })
    if (response.ok) {
      window.location.href = "/"
      return
    }
    setActionMessage("Project archive failed.")
  }

  const inviteMember = async () => {
    setTeamMessage("")
    const response = await fetch("/api/organization/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })
    setTeamMessage(response.ok ? "Invitation saved." : "Invitation failed.")
    if (response.ok) setInviteEmail("")
  }

  const setStatusOverride = (status: NodeStatus) => {
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
              <DialogTrigger render={<Button variant="outline" size="sm" />}>New</DialogTrigger>
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
              <DialogTrigger render={<Button variant="outline" size="sm" />}>Manage</DialogTrigger>
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
          <SidebarItem icon={Bell} label="Alerts" count={String(initialWorkspace.alerts.filter((alert) => !alert.resolvedAt).length)} />
          <SidebarItem icon={ShieldCheck} label="Security" />
        </nav>

        <Dialog>
          <DialogTrigger render={<Button variant="outline" className="mb-3 justify-start" />}>
            <Users data-icon="inline-start" />
            Team
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Team access</DialogTitle>
              <DialogDescription>Invite collaborators and review current workspace members.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 sm:grid-cols-[1fr_130px]">
              <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@example.com" />
              <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>
            <Button onClick={inviteMember}>Save invitation</Button>
            {teamMessage ? <div className="text-sm text-muted-foreground">{teamMessage}</div> : null}
            <Separator />
            <div className="max-h-72 overflow-y-auto">
              {initialWorkspace.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{member.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{member.email}</span>
                  </span>
                  <Badge variant="secondary">{member.role}</Badge>
                </div>
              ))}
              {initialWorkspace.invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm">
                  <span className="truncate">{invitation.email}</span>
                  <Badge variant="outline">{invitation.role} pending</Badge>
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
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Deployment readiness</DialogTitle>
              <DialogDescription>Safe production checks for the deployed demo. Secret values are never shown.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <ReadinessItem label="Database connected" ready={initialWorkspace.diagnostics.checks.database} />
              <ReadinessItem label="GitHub OAuth ready" ready={initialWorkspace.diagnostics.checks.auth} />
              <ReadinessItem label="Encryption enabled" ready={initialWorkspace.diagnostics.checks.encryption} />
              <ReadinessItem label="Cron secret configured" ready={initialWorkspace.diagnostics.checks.cron} />
            </div>
            <Separator />
            {initialWorkspace.diagnostics.latestPoll ? (
              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <div className="font-medium">Latest poll: {initialWorkspace.diagnostics.latestPoll.status}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {initialWorkspace.diagnostics.latestPoll.sampledNodes} nodes, {initialWorkspace.diagnostics.latestPoll.createdSamples} samples,{" "}
                  {initialWorkspace.diagnostics.latestPoll.evaluatedAlerts} alerts, {initialWorkspace.diagnostics.latestPoll.deletedSamples} old samples cleaned.
                </div>
                {initialWorkspace.diagnostics.latestPoll.errorSummary ? (
                  <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                    {initialWorkspace.diagnostics.latestPoll.errorSummary}
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
            <Button variant={editMode ? "default" : "outline"} onClick={() => setEditMode((value) => !value)}>
              <Edit3 data-icon="inline-start" />
              {editMode ? "Editing" : "View mode"}
            </Button>
            <Button onClick={addEndpointNode}>
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
          <div className="flex min-w-0 flex-col bg-slate-50/70 dark:bg-slate-950/50">
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
                <Button variant="outline" size="sm">
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
                onNodeClick={(_, node) => setSelectedId(node.id)}
                nodesDraggable={editMode}
                nodesConnectable={editMode}
                elementsSelectable
                fitView
                fitViewOptions={{ padding: 0.2 }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={22}
                  size={1}
                  color="currentColor"
                  className="text-slate-300 dark:text-slate-700"
                />
                <MiniMap pannable zoomable nodeStrokeWidth={3} className="!bg-background !shadow-sm" />
                <Controls className="!border !bg-background !shadow-sm" />
              </ReactFlow>

              <div className="pointer-events-none absolute left-5 top-5 max-w-sm rounded-xl border bg-background/90 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="size-4 text-cyan-600" />
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
            alerts={initialWorkspace.alerts}
            onOverride={setStatusOverride}
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

function NodeInspector({
  selectedNode,
  currentUser,
  categories,
  projectId,
  alerts,
  onOverride,
  onPatch,
}: {
  selectedNode: EndpointNodeData
  currentUser: NonNullable<Session["user"]>
  categories: string[]
  projectId: string
  alerts: WorkspacePayload["alerts"]
  onOverride: (status: NodeStatus) => void
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
  const [unit, setUnit] = useState("")
  const [threshold, setThreshold] = useState("> 90")
  const [visualization, setVisualization] = useState("NUMBER")
  const [apiMessage, setApiMessage] = useState("")
  const [visibleAlerts, setVisibleAlerts] = useState(alerts)

  const saveApiConfig = async () => {
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
            unit,
            threshold,
            visualization,
          },
        ],
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setApiMessage(payload?.error ?? "API configuration failed.")
      return
    }

    onPatch({
      apiUrl,
      auth: authType === "NONE" ? "None" : authType.replaceAll("_", " ").toLowerCase(),
      cadence: `Every ${cadenceMin} min`,
    })
    setSecretValue("")
    setApiMessage("API configuration saved.")
  }

  const resolveAlert = async (alertId: string) => {
    const response = await fetch(`/api/alerts/${alertId}`, { method: "PATCH" })
    if (!response.ok) return
    setVisibleAlerts((currentAlerts) =>
      currentAlerts.map((alert) => (alert.id === alertId ? { ...alert, resolvedAt: new Date().toISOString() } : alert))
    )
  }

  return (
    <aside className="min-h-0 overflow-y-auto border-l bg-background">
      <div className="sticky top-0 z-10 border-b bg-background/95 px-5 py-4 backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl border bg-muted">
            <Icon className="size-6" />
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
            <div className="grid grid-cols-2 gap-3">
              {selectedNode.metrics.map((metric) => (
                <div key={metric.label} className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">{metric.label}</div>
                  <div className="mt-1 text-xl font-semibold">{metric.value}</div>
                  <div className={cn("mt-1 text-xs", toneClasses[metric.tone])}>{metric.delta}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              {(["active", "degraded", "down"] as NodeStatus[]).map((status) => (
                <Button key={status} variant={effectiveStatus === status ? "default" : "outline"} size="sm" onClick={() => onOverride(status)}>
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
                <CardTitle>Latency Trend</CardTitle>
                <CardDescription>Latest seven sampling buckets</CardDescription>
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
                <CardDescription>Run and step aware monitoring sample</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Quality</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedNode.runs.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="font-medium">{run.id}</TableCell>
                        <TableCell>
                          <Badge variant={run.status === "failed" ? "destructive" : "secondary"}>{run.status}</Badge>
                        </TableCell>
                        <TableCell>{run.latency}</TableCell>
                        <TableCell>{run.quality}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                <Input value={selectedNode.label} onChange={(event) => onPatch({ label: event.target.value })} aria-label="Node label" />
                <Textarea
                  value={selectedNode.description}
                  onChange={(event) => onPatch({ description: event.target.value })}
                  aria-label="Node description"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>API Configuration</CardTitle>
                <CardDescription>Save a deployed polling target and metric mapping</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} aria-label="Endpoint URL" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={authType} onChange={(event) => setAuthType(event.target.value)}>
                    <option value="NONE">No auth</option>
                    <option value="API_KEY_HEADER">API key header</option>
                    <option value="BEARER_TOKEN">Bearer token</option>
                    <option value="BASIC">Basic auth</option>
                    <option value="CUSTOM_HEADERS">Custom headers</option>
                  </select>
                  <Input value={cadenceMin} onChange={(event) => setCadenceMin(event.target.value)} aria-label="Cadence minutes" />
                </div>
                <Input
                  value={secretValue}
                  onChange={(event) => setSecretValue(event.target.value)}
                  placeholder="Secret value, encrypted before storage"
                  type="password"
                />
                <Separator />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={mappingLabel} onChange={(event) => setMappingLabel(event.target.value)} aria-label="Mapping label" />
                  <Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Unit" />
                </div>
                <Input value={jsonPath} onChange={(event) => setJsonPath(event.target.value)} aria-label="JSONPath" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={threshold} onChange={(event) => setThreshold(event.target.value)} aria-label="Threshold" />
                  <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={visualization} onChange={(event) => setVisualization(event.target.value)}>
                    <option value="NUMBER">Number</option>
                    <option value="LINE">Line</option>
                    <option value="BAR">Bar</option>
                    <option value="TABLE">Table</option>
                    <option value="STATUS">Status</option>
                    <option value="HEATMAP">Heatmap</option>
                  </select>
                </div>
                <Button onClick={saveApiConfig}>Save API setup</Button>
                {apiMessage ? <div className="text-xs text-muted-foreground">{apiMessage}</div> : null}
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
            {visibleAlerts.length ? (
              visibleAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{alert.title}</div>
                    <div className="text-xs text-muted-foreground">{alert.nodeLabel ?? "Project"} / {alert.severity}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{alert.message}</div>
                  </div>
                  {alert.resolvedAt ? (
                    <Badge variant="secondary">Resolved</Badge>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => resolveAlert(alert.id)}>
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
