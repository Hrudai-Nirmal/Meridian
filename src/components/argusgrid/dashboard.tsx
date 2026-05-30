"use client"

import { useCallback, useMemo, useState } from "react"
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
  Wand2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CostQualityChart, IncidentHeatmap, LatencyChart, RelationshipSankey } from "@/components/argusgrid/charts"
import { EndpointGraphNode } from "@/components/argusgrid/endpoint-node"
import {
  allEndpointNodes,
  graphEdges,
  iconRegistry,
  projectCategories,
  projectSummary,
  statusCopy,
  type EndpointNodeData,
  type NodeStatus,
} from "@/lib/argusgrid-data"
import { cn } from "@/lib/utils"

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

function toFlowEdge(edge: (typeof graphEdges)[number]): Edge {
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

export function ArgusGridDashboard() {
  const [selectedId, setSelectedId] = useState(allEndpointNodes[0].id)
  const [editMode, setEditMode] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [nodes, setNodes, onNodesChange] = useNodesState(allEndpointNodes.map(toFlowNode))
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphEdges.map(toFlowEdge))

  const selectedNode = useMemo(
    () => (nodes.find((node) => node.id === selectedId)?.data as unknown as EndpointNodeData) ?? allEndpointNodes[0],
    [nodes, selectedId]
  )

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
    const id = `endpoint-${nodes.length + 1}`
    const newNode: EndpointNodeData = {
      ...allEndpointNodes[0],
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
            {projectSummary.organization}
            <ChevronDown className="size-4 text-muted-foreground" />
          </div>
        </div>

        <nav className="mt-5 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:flex lg:flex-1 lg:flex-col">
          <SidebarItem icon={LayoutDashboard} active label="Project Map" />
          <SidebarItem icon={Activity} label="Runs & Steps" />
          <SidebarItem icon={CircleDollarSign} label="Cost & Usage" />
          <SidebarItem icon={Gauge} label="Quality & Evals" />
          <SidebarItem icon={Bell} label="Alerts" count="3" />
          <SidebarItem icon={ShieldCheck} label="Security" />
        </nav>

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
              <h1 className="truncate text-lg font-semibold">{projectSummary.project}</h1>
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
          </div>
        </header>

        <section className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(640px,1fr)_420px]">
          <div className="flex min-w-0 flex-col bg-slate-50/70 dark:bg-slate-950/50">
            <div className="flex flex-col gap-3 border-b bg-background/80 px-5 py-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  {projectSummary.activeNodes} active
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <span className="size-2 rounded-full bg-amber-500" />
                  {projectSummary.degradedNodes} degraded
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <span className="size-2 rounded-full bg-rose-500" />
                  {projectSummary.downNodes} down
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm">
                  <HardDriveUpload data-icon="inline-start" />
                  Upload icon
                </Button>
                <Button variant="outline" size="sm">
                  <Wand2 data-icon="inline-start" />
                  API wizard
                </Button>
                <Button variant="secondary" size="sm">
                  <Save data-icon="inline-start" />
                  Save graph
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

          <NodeInspector selectedNode={selectedNode} onOverride={setStatusOverride} />
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

function NodeInspector({
  selectedNode,
  onOverride,
}: {
  selectedNode: EndpointNodeData
  onOverride: (status: NodeStatus) => void
}) {
  const Icon = iconRegistry[selectedNode.icon] ?? iconRegistry.api
  const effectiveStatus = selectedNode.override ?? selectedNode.status

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
                <CardTitle>REST Configuration</CardTitle>
                <CardDescription>Guided API wizard target for this endpoint</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ConfigRow label="Endpoint URL" value={selectedNode.apiUrl} />
                <ConfigRow label="Auth" value={selectedNode.auth} />
                <ConfigRow label="Cadence" value={selectedNode.cadence} />
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
            <CardTitle>Default Monitoring Categories</CardTitle>
            <CardDescription>Curated AI-ops taxonomy, editable per project</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {projectCategories.map((category) => (
              <Badge key={category} variant={category === selectedNode.category ? "default" : "secondary"}>
                {category}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>
    </aside>
  )
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/20 p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="max-w-64 text-right text-xs font-medium">{value}</span>
    </div>
  )
}
