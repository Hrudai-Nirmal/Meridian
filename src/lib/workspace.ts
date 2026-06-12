import "server-only"

import type { EndpointNode, GraphEdge, MembershipRole, Project, ProjectCategory } from "@prisma/client"

import {
  allEndpointNodes,
  graphEdges as seedGraphEdges,
  projectCategories,
  projectSummary,
  type EndpointRun,
  type EndpointNodeData,
  type IconKind,
  type NodeStatus,
} from "@/lib/argusgrid-data"
import { getReadinessStatus, type ReadinessStatus } from "@/lib/health"
import { getPrisma } from "@/lib/prisma"

type DbNode = EndpointNode & {
  override: { status: string; reason: string; expiresAt: Date | null } | null
  endpointConfig: { url: string; method: string; authType: string; cadenceMin: number } | null
  icon: { id: string; mimeType: string } | null
  mappings: { id: string; label: string; jsonPath: string; transform: string | null; unit: string | null; threshold: unknown }[]
  samples: { value: number; sampledAt: Date; mappingId: string | null }[]
  runs: {
    id: string
    externalId: string | null
    status: string
    startedAt: Date
    finishedAt: Date | null
    costUsd: { toString(): string } | null
    tokens: number | null
    steps: {
      id: string
      name: string
      status: string
      latencyMs: number | null
      toolName: string | null
    }[]
  }[]
  alertEvents: {
    id: string
    title: string
    message: string
    severity: string
    nodeId: string | null
    ruleId: string | null
    createdAt: Date
    resolvedAt: Date | null
    node: { label: string } | null
    deliveries: {
      status: string
      provider: string
      attemptedAt: Date
      sentAt: Date | null
      failureReason: string | null
    }[]
  }[]
}

type DbRollup = {
  scope: string
  metricKey: string
  value: number
  startedAt: Date
}

type DbProject = Project & {
  categories: ProjectCategory[]
  nodes: DbNode[]
  edges: GraphEdge[]
  alertRules: {
    id: string
    name: string
    expression: string
    severity: string
    enabled: boolean
    nodeId: string | null
    mappingId: string | null
    metadata: unknown
    createdAt: Date
    updatedAt: Date
    events: {
      id: string
      title: string
      message: string
      severity: string
      nodeId: string | null
      ruleId: string | null
      createdAt: Date
      resolvedAt: Date | null
      node: { label: string } | null
      deliveries: {
        status: string
        provider: string
        attemptedAt: Date
        sentAt: Date | null
        failureReason: string | null
      }[]
    }[]
  }[]
}

export type WorkspacePayload = {
  organization: {
    id: string
    name: string
    slug: string
    onboardingCompleted: boolean
  }
  currentUserRole: string
  projects: {
    id: string
    name: string
    slug: string
    nodeCount: number
    activeAlertCount: number
    latestSampledAt: string | null
    updatedAt: string | null
  }[]
  project: {
    id: string
    name: string
    slug: string
  }
  members: {
    id: string
    name: string
    email: string
    role: string
  }[]
  invitations: {
    id: string
    email: string
    role: string
    status: string
  }[]
  alerts: {
    id: string
    title: string
    message: string
    severity: string
    createdAt: string
    resolvedAt: string | null
    nodeId: string | null
    nodeLabel: string | null
    source: string
    firstSeen: string
    lastSeen: string
    deliveryStatus: string | null
    deliveryProvider: string | null
    deliveryAttemptedAt: string | null
    deliverySentAt: string | null
    deliveryFailureReason: string | null
  }[]
  alertRules: {
    id: string
    name: string
    expression: string
    severity: string
    enabled: boolean
    nodeId: string | null
    mappingId: string | null
    nodeLabel: string | null
    mappingLabel: string | null
    createdAt: string
    updatedAt: string
  }[]
  notificationPreference: {
    enabled: boolean
    severity: string
  }
  diagnostics: ReadinessStatus
  summary: typeof projectSummary
  categories: string[]
  nodes: EndpointNodeData[]
  edges: {
    id: string
    source: string
    target: string
    label: string
  }[]
}

export function slugify(input: string) {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "workspace"
}

function toNodeStatus(status: string): NodeStatus {
  const normalized = status.toLowerCase()
  if (normalized === "active" || normalized === "degraded" || normalized === "down") return normalized
  return "unknown"
}

function toEndpointStatus(status: NodeStatus) {
  return status.toUpperCase() as "ACTIVE" | "DEGRADED" | "DOWN" | "UNKNOWN"
}

function toAuthLabel(authType?: string) {
  switch (authType) {
    case "API_KEY_HEADER":
      return "API key header"
    case "BEARER_TOKEN":
      return "Bearer token"
    case "BASIC":
      return "Basic auth"
    case "CUSTOM_HEADERS":
      return "Custom headers"
    default:
      return "None"
  }
}

function toAuthType(auth?: string | null) {
  const normalized = (auth ?? "").toLowerCase()
  if (normalized.includes("api key")) return "API_KEY_HEADER"
  if (normalized.includes("bearer")) return "BEARER_TOKEN"
  if (normalized.includes("basic")) return "BASIC"
  if (normalized.includes("custom")) return "CUSTOM_HEADERS"
  return "NONE"
}

function toCadenceLabel(minutes?: number) {
  if (!minutes) return "Manual"
  if (minutes === 1) return "Every 1 min"
  return `Every ${minutes} min`
}

function toCadenceMinutes(cadence?: string | null) {
  const match = cadence?.match(/\d+/)
  if (!match) return 15
  return Number(match[0])
}

function formatMetricValue(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  }).format(value)
}

function thresholdToExpression(threshold: unknown) {
  if (typeof threshold === "string") return threshold.trim() || undefined
  if (threshold && typeof threshold === "object" && "expression" in threshold) {
    const expression = String((threshold as { expression?: unknown }).expression ?? "").trim()
    return expression || undefined
  }
  return undefined
}

function thresholdExceeded(value: number, expression?: string) {
  const match = expression?.match(/^(>=|>|<=|<|=)\s*(-?\d+(\.\d+)?)$/)
  if (!match) return false

  const target = Number(match[2])
  switch (match[1]) {
    case ">":
      return value > target
    case ">=":
      return value >= target
    case "<":
      return value < target
    case "<=":
      return value <= target
    case "=":
      return value === target
    default:
      return false
  }
}

function freshnessLabel(sampledAt?: Date) {
  if (!sampledAt) return undefined
  const ageMs = Math.max(0, Date.now() - sampledAt.getTime())
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs

  if (ageMs < minuteMs) return "Just now"
  if (ageMs < hourMs) return `${Math.floor(ageMs / minuteMs)}m ago`
  if (ageMs < dayMs) return `${Math.floor(ageMs / hourMs)}h ago`
  return `${Math.floor(ageMs / dayMs)}d ago`
}

function formatShortDateTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatDuration(startedAt: Date, finishedAt?: Date | null) {
  if (!finishedAt) return "Running"
  const elapsedMs = Math.max(0, finishedAt.getTime() - startedAt.getTime())
  if (elapsedMs < 1000) return `${elapsedMs}ms`
  if (elapsedMs < 60_000) return `${(elapsedMs / 1000).toFixed(1)}s`
  return `${Math.round(elapsedMs / 60_000)}m`
}

function runStatus(status: string): EndpointRun["status"] {
  const normalized = status.toLowerCase()
  if (normalized === "failed" || normalized === "degraded" || normalized === "running" || normalized === "queued") return normalized
  return "success"
}

function dbNodeToEndpointNode(node: DbNode, rollups: DbRollup[] = []): EndpointNodeData {
  const seed =
    allEndpointNodes.find((candidate) => candidate.id === node.id || node.id.endsWith(`-${candidate.id}`)) ??
    allEndpointNodes.find((candidate) => candidate.icon === node.iconKind) ??
    allEndpointNodes[0]
  const status = toNodeStatus(node.status)
  const override = node.override ? toNodeStatus(node.override.status) : undefined
  const mappedParameters = node.mappings.map((mapping) => ({
    id: mapping.id,
    label: mapping.label,
    path: mapping.jsonPath,
    transform: mapping.transform ?? "none",
    unit: mapping.unit ?? "",
  }))
  const mappingById = new Map(node.mappings.map((mapping) => [mapping.id, mapping]))
  const samplesByMapping = new Map<string, typeof node.samples>()

  for (const sample of node.samples) {
    const key = sample.mappingId ?? "unmapped"
    samplesByMapping.set(key, (samplesByMapping.get(key) ?? []).concat(sample))
  }

  const realSampleSeries = Array.from(samplesByMapping.entries()).map(([mappingId, samples]) => {
    const mapping = mappingById.get(mappingId)
    const sortedSamples = [...samples].sort((a, b) => a.sampledAt.getTime() - b.sampledAt.getTime())

    return {
      mappingId: mappingId === "unmapped" ? null : mappingId,
      label: mapping?.label ?? "Metric",
      unit: mapping?.unit ?? "",
      points: sortedSamples.map((sample) => ({
        timestamp: sample.sampledAt.toISOString(),
        value: sample.value,
      })),
    }
  })
  const realRollupSeries = Array.from(
    rollups.reduce((groups, rollup) => {
      groups.set(rollup.metricKey, (groups.get(rollup.metricKey) ?? []).concat(rollup))
      return groups
    }, new Map<string, DbRollup[]>())
  ).map(([metricKey, metricRollups]) => {
    const mapping = node.mappings.find((candidate) => candidate.label === metricKey)
    const sortedRollups = [...metricRollups].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())

    return {
      mappingId: mapping?.id ?? null,
      label: metricKey,
      unit: mapping?.unit ?? "",
      points: sortedRollups.map((rollup) => ({
        timestamp: rollup.startedAt.toISOString(),
        value: rollup.value,
      })),
    }
  })
  const realMetrics = Array.from(samplesByMapping.entries()).map(([mappingId, samples]) => {
    const sortedSamples = [...samples].sort((a, b) => b.sampledAt.getTime() - a.sampledAt.getTime())
    const latest = sortedSamples[0]
    const mapping = mappingById.get(mappingId)
    const unit = mapping?.unit ?? ""
    const threshold = thresholdToExpression(mapping?.threshold)
    const crossed = thresholdExceeded(latest.value, threshold)

    return {
      mappingId: mappingId === "unmapped" ? null : mappingId,
      label: mapping?.label ?? "Metric",
      value: latest.value,
      displayValue: `${formatMetricValue(latest.value)}${unit ? ` ${unit}` : ""}`,
      unit,
      sampledAt: latest.sampledAt.toISOString(),
      threshold,
      tone: crossed ? ("warn" as const) : ("good" as const),
    }
  })
  const latestSample = [...node.samples].sort((a, b) => b.sampledAt.getTime() - a.sampledAt.getTime())[0]
  const persistedRuns = node.runs.map((run) => ({
    id: run.externalId ?? run.id,
    externalId: run.externalId,
    status: runStatus(run.status),
    started: formatShortDateTime(run.startedAt),
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    durationMs: run.finishedAt ? Math.max(0, run.finishedAt.getTime() - run.startedAt.getTime()) : null,
    latency: formatDuration(run.startedAt, run.finishedAt),
    cost: run.costUsd ? `$${run.costUsd.toString()}` : "$0.000",
    costUsd: run.costUsd?.toString() ?? null,
    tokens: run.tokens,
    quality: run.status.toLowerCase() === "failed" ? "Failed" : run.status.toLowerCase() === "degraded" ? "Degraded" : "OK",
    stepCount: run.steps.length,
    steps: run.steps.map((step) => ({
      id: step.id,
      name: step.name,
      status: step.status,
      latencyMs: step.latencyMs,
      toolName: step.toolName,
    })),
  }))

  return {
    ...seed,
    id: node.id,
    label: node.label,
    description: node.description ?? seed.description,
    icon: (node.iconKind as IconKind) ?? seed.icon,
    status,
    statusReason: node.statusReason ?? seed.statusReason,
    override,
    category: node.category,
    apiUrl: node.endpointConfig?.url ?? seed.apiUrl,
    cadence: toCadenceLabel(node.endpointConfig?.cadenceMin),
    auth: toAuthLabel(node.endpointConfig?.authType),
    position: { x: node.x, y: node.y },
    customIconUrl: node.icon ? `/api/projects/${node.projectId}/nodes/${node.id}/icon?v=${node.updatedAt.getTime()}` : undefined,
    parameters: mappedParameters.length ? mappedParameters : seed.parameters,
    runs: persistedRuns.length ? persistedRuns : seed.runs,
    hasPersistedRuns: Boolean(persistedRuns.length),
    realMetrics,
    realSampleSeries,
    realRollupSeries,
    latestSampledAt: latestSample?.sampledAt.toISOString(),
    freshnessLabel: freshnessLabel(latestSample?.sampledAt),
  }
}

function getRuleMappingLabel(rule: DbProject["alertRules"][number], nodes: EndpointNodeData[]) {
  const node = nodes.find((candidate) => candidate.id === rule.nodeId)
  const parameter = node?.parameters.find((candidate) => candidate.id === rule.mappingId)
  if (parameter) return parameter.label
  if (rule.metadata && typeof rule.metadata === "object" && "mappingLabel" in rule.metadata) {
    return String((rule.metadata as { mappingLabel?: unknown }).mappingLabel ?? "")
  }
  return null
}

function projectToWorkspace(
  organization: { id: string; name: string; slug: string; onboardingCompleted: boolean },
  currentUserRole: MembershipRole,
  projects: WorkspacePayload["projects"],
  project: DbProject,
  members: WorkspacePayload["members"],
  invitations: WorkspacePayload["invitations"],
  notificationPreference: WorkspacePayload["notificationPreference"],
  diagnostics: ReadinessStatus,
  rollupsByNodeId = new Map<string, DbRollup[]>()
): WorkspacePayload {
  const nodes = project.nodes.map((node) => dbNodeToEndpointNode(node, rollupsByNodeId.get(node.id) ?? []))
  const activeNodes = nodes.filter((node) => (node.override ?? node.status) === "active").length
  const degradedNodes = nodes.filter((node) => (node.override ?? node.status) === "degraded").length
  const downNodes = nodes.filter((node) => (node.override ?? node.status) === "down").length
  const alertEventsById = new Map(
    project.alertRules
      .flatMap((rule) => rule.events)
      .concat(project.nodes.flatMap((node) => node.alertEvents))
      .map((event) => [event.id, event])
  )
  const alerts = Array.from(alertEventsById.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 100)
    .map((event) => {
      const latestDelivery = event.deliveries[0]

      return {
        id: event.id,
        title: event.title,
        message: event.message,
        severity: event.severity,
        createdAt: event.createdAt.toISOString(),
        resolvedAt: event.resolvedAt?.toISOString() ?? null,
        nodeId: event.nodeId,
        nodeLabel: event.node?.label ?? null,
        source: event.ruleId ? "Threshold rule" : event.nodeId ? "Endpoint polling" : "Project",
        firstSeen: event.createdAt.toISOString(),
        lastSeen: event.createdAt.toISOString(),
        deliveryStatus: latestDelivery?.status ?? null,
        deliveryProvider: latestDelivery?.provider ?? null,
        deliveryAttemptedAt: latestDelivery?.attemptedAt.toISOString() ?? null,
        deliverySentAt: latestDelivery?.sentAt?.toISOString() ?? null,
        deliveryFailureReason: latestDelivery?.failureReason ?? null,
      }
    })
  const alertRules = project.alertRules
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((rule) => {
      const node = nodes.find((candidate) => candidate.id === rule.nodeId)

      return {
        id: rule.id,
        name: rule.name,
        expression: rule.expression,
        severity: rule.severity,
        enabled: rule.enabled,
        nodeId: rule.nodeId,
        mappingId: rule.mappingId,
        nodeLabel: node?.label ?? null,
        mappingLabel: getRuleMappingLabel(rule, nodes),
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      }
    })

  return {
    organization,
    currentUserRole,
    projects,
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
    },
    members,
    invitations,
    alerts,
    alertRules,
    notificationPreference,
    diagnostics,
    summary: {
      ...projectSummary,
      organization: organization.name,
      project: project.name,
      activeNodes,
      degradedNodes,
      downNodes,
    },
    categories: project.categories.sort((a, b) => a.position - b.position).map((category) => category.name),
    nodes,
    edges: project.edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      label: edge.label ?? "visual link",
    })),
  }
}

export async function createSeedProject(organizationId: string, name = projectSummary.project) {
  const prisma = getPrisma()

  const project = await prisma.project.create({
    data: {
      name,
      slug: await uniqueProjectSlug(organizationId, name),
      organizationId,
      categories: {
        create: projectCategories.map((name, position) => ({
          name,
          position,
        })),
      },
    },
  })

  const nodeIdBySeedId = new Map(allEndpointNodes.map((node) => [node.id, `${project.id}-${node.id}`]))

  await prisma.$transaction([
    ...allEndpointNodes.map((node) =>
      prisma.endpointNode.create({
        data: {
          id: nodeIdBySeedId.get(node.id) ?? `${project.id}-${node.id}`,
          label: node.label,
          description: node.description,
          iconKind: node.icon,
          status: toEndpointStatus(node.status),
          statusReason: node.statusReason,
          category: node.category,
          x: node.position.x,
          y: node.position.y,
          projectId: project.id,
          endpointConfig: {
            create: {
              url: node.apiUrl,
              method: "GET",
              authType: toAuthType(node.auth),
              cadenceMin: toCadenceMinutes(node.cadence),
            },
          },
          override: node.override
            ? {
                create: {
                  status: toEndpointStatus(node.override),
                  reason: "Seeded admin override",
              },
            }
            : undefined,
        },
      })
    ),
    ...seedGraphEdges.map((edge) =>
      prisma.graphEdge.create({
        data: {
          id: `${project.id}-${edge.id}`,
          sourceId: nodeIdBySeedId.get(edge.source) ?? edge.source,
          targetId: nodeIdBySeedId.get(edge.target) ?? edge.target,
          label: edge.label,
          projectId: project.id,
        },
      })
    ),
  ])

  return project
}

export async function createBlankProject(organizationId: string, name: string) {
  const prisma = getPrisma()

  return prisma.project.create({
    data: {
      name,
      slug: await uniqueProjectSlug(organizationId, name),
      organizationId,
      categories: {
        create: projectCategories.map((category, position) => ({
          name: category,
          position,
        })),
      },
    },
  })
}

async function uniqueOrganizationSlug(base: string) {
  const prisma = getPrisma()
  const root = slugify(base)
  let slug = root
  let suffix = 2

  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${root}-${suffix}`
    suffix += 1
  }

  return slug
}

async function uniqueProjectSlug(organizationId: string, base: string) {
  const prisma = getPrisma()
  const root = slugify(base)
  let slug = root
  let suffix = 2

  while (await prisma.project.findUnique({ where: { organizationId_slug: { organizationId, slug } } })) {
    slug = `${root}-${suffix}`
    suffix += 1
  }

  return slug
}

export async function ensureWorkspaceForUser(user: { id: string; name?: string | null; email?: string | null }) {
  const prisma = getPrisma()
  const normalizedEmail = user.email?.toLowerCase()

  if (normalizedEmail) {
    const invitations = await prisma.teamInvitation.findMany({
      where: {
        email: normalizedEmail,
        status: "PENDING",
      },
      orderBy: { createdAt: "asc" },
    })

    for (const invitation of invitations) {
      await prisma.$transaction([
        prisma.membership.upsert({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: invitation.organizationId,
            },
          },
          update: {
            role: invitation.role,
          },
          create: {
            userId: user.id,
            organizationId: invitation.organizationId,
            role: invitation.role,
          },
        }),
        prisma.teamInvitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED" },
        }),
      ])
    }
  }

  const existingMembership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: {
      organization: {
        include: {
          projects: {
            where: { archivedAt: null },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              name: true,
              slug: true,
              updatedAt: true,
              nodes: {
                select: {
                  id: true,
                  samples: {
                    orderBy: { sampledAt: "desc" },
                    take: 1,
                    select: { sampledAt: true },
                  },
                  alertEvents: {
                    where: { resolvedAt: null },
                    select: { id: true },
                  },
                },
              },
              alertRules: {
                select: {
                  events: {
                    where: { resolvedAt: null },
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  if (existingMembership) {
    if (!existingMembership.organization.projects.length) {
      return null
    }

    return getWorkspaceForUser(user.id)
  }

  const organizationName = user.name ? `${user.name}'s Workspace` : "Personal Workspace"
  const slug = await uniqueOrganizationSlug(user.email ?? user.name ?? user.id)

  await prisma.organization.create({
    data: {
      name: organizationName,
      slug,
      memberships: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
  })

  return null
}

export async function getWorkspaceForUser(userId: string, projectId?: string) {
  const prisma = getPrisma()
  const membership = await prisma.membership.findFirst({
    where: { userId },
    include: {
      user: {
        include: {
          notifications: {
            where: { channel: "email" },
            take: 1,
          },
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          onboardingCompleted: true,
          projects: {
            where: { archivedAt: null },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              name: true,
              slug: true,
              updatedAt: true,
              nodes: {
                select: {
                  id: true,
                  samples: {
                    orderBy: { sampledAt: "desc" },
                    take: 1,
                    select: { sampledAt: true },
                  },
                  alertEvents: {
                    where: { resolvedAt: null },
                    select: { id: true },
                  },
                },
              },
              alertRules: {
                select: {
                  events: {
                    where: { resolvedAt: null },
                    select: { id: true },
                  },
                },
              },
            },
          },
          memberships: {
            include: {
              user: true,
            },
            orderBy: { createdAt: "asc" },
          },
          invitations: {
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  if (!membership) return null

  const selectedProjectId = projectId ?? membership.organization.projects[0]?.id
  if (!selectedProjectId) return null

  const project = await prisma.project.findFirst({
    where: {
      id: selectedProjectId,
      organizationId: membership.organizationId,
      archivedAt: null,
    },
    include: {
      categories: true,
      nodes: {
        include: {
          override: true,
          endpointConfig: true,
          mappings: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              label: true,
              jsonPath: true,
              transform: true,
              unit: true,
              threshold: true,
            },
          },
          samples: {
            orderBy: { sampledAt: "desc" },
            take: 120,
            select: {
              value: true,
              sampledAt: true,
              mappingId: true,
            },
          },
          runs: {
            orderBy: { startedAt: "desc" },
            take: 20,
            select: {
              id: true,
              externalId: true,
              status: true,
              startedAt: true,
              finishedAt: true,
              costUsd: true,
              tokens: true,
              steps: {
                orderBy: { id: "asc" },
                select: {
                  id: true,
                  name: true,
                  status: true,
                  latencyMs: true,
                  toolName: true,
                },
              },
            },
          },
          icon: {
            select: {
              id: true,
              mimeType: true,
            },
          },
          alertEvents: {
            include: {
              node: {
                select: { label: true },
              },
              deliveries: {
                orderBy: { attemptedAt: "desc" },
                take: 1,
                select: {
                  status: true,
                  provider: true,
                  attemptedAt: true,
                  sentAt: true,
                  failureReason: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          },
        },
        orderBy: { createdAt: "asc" },
      },
      edges: {
        orderBy: { createdAt: "asc" },
      },
      alertRules: {
        include: {
          events: {
            include: {
              node: true,
              deliveries: {
                orderBy: { attemptedAt: "desc" },
                take: 1,
                select: {
                  status: true,
                  provider: true,
                  attemptedAt: true,
                  sentAt: true,
                  failureReason: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          },
        },
      },
    },
  })

  if (!project) return null

  const rollups = await prisma.metricRollup.findMany({
    where: {
      bucket: "hour",
      scope: {
        in: project.nodes.map((node) => node.id),
      },
    },
    orderBy: { startedAt: "desc" },
    take: Math.max(240, project.nodes.length * 48),
    select: {
      scope: true,
      metricKey: true,
      value: true,
      startedAt: true,
    },
  })
  const rollupsByNodeId = rollups.reduce((groups, rollup) => {
    groups.set(rollup.scope, (groups.get(rollup.scope) ?? []).concat(rollup))
    return groups
  }, new Map<string, DbRollup[]>())

  const members = membership.organization.memberships.map((member) => ({
    id: member.id,
    name: member.user.name ?? "Pending user",
    email: member.user.email ?? "No email",
    role: member.role,
  }))
  const invitations = membership.organization.invitations.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
  }))

  const diagnostics = await getReadinessStatus()
  const emailPreference = membership.user.notifications[0]
  const notificationPreference = {
    enabled: emailPreference?.enabled ?? membership.role !== "VIEWER",
    severity: emailPreference?.severity ?? "WARNING",
  }
  const projectCards = membership.organization.projects.map((workspaceProject) => {
    const latestSampledAt = workspaceProject.nodes
      .flatMap((node) => node.samples.map((sample) => sample.sampledAt.getTime()))
      .sort((a, b) => b - a)[0]
    const activeAlertIds = new Set(
      workspaceProject.nodes
        .flatMap((node) => node.alertEvents.map((event) => event.id))
        .concat(workspaceProject.alertRules.flatMap((rule) => rule.events.map((event) => event.id)))
    )

    return {
      id: workspaceProject.id,
      name: workspaceProject.name,
      slug: workspaceProject.slug,
      nodeCount: workspaceProject.nodes.length,
      activeAlertCount: activeAlertIds.size,
      latestSampledAt: latestSampledAt ? new Date(latestSampledAt).toISOString() : null,
      updatedAt: workspaceProject.updatedAt?.toISOString() ?? null,
    }
  })

  return projectToWorkspace(
    membership.organization,
    membership.role,
    projectCards,
    project,
    members,
    invitations,
    notificationPreference,
    diagnostics,
    rollupsByNodeId
  )
}

export async function getOnboardingState(userId: string) {
  const prisma = getPrisma()
  const membership = await prisma.membership.findFirst({
    where: { userId },
    include: {
      organization: {
        include: {
          projects: {
            where: { archivedAt: null },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  return membership
    ? {
        organization: {
          id: membership.organization.id,
          name: membership.organization.name,
          slug: membership.organization.slug,
          onboardingCompleted: membership.organization.onboardingCompleted,
        },
        hasProjects: membership.organization.projects.length > 0,
      }
    : null
}

export async function assertOrganizationRole(userId: string, organizationId: string, allowed: MembershipRole[] = ["OWNER", "ADMIN"]) {
  const prisma = getPrisma()
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId,
      role: { in: allowed },
    },
    select: { id: true, role: true },
  })

  if (!membership) {
    throw new Error("Organization access denied.")
  }

  return membership
}

export async function assertProjectAccess(userId: string, projectId: string) {
  const prisma = getPrisma()
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization: {
        memberships: {
          some: { userId },
        },
      },
    },
    select: { id: true, organizationId: true },
  })

  if (!project) {
    throw new Error("Project not found or access denied.")
  }

  return project
}

export async function assertProjectRole(
  userId: string,
  projectId: string,
  allowed: MembershipRole[] = ["OWNER", "ADMIN", "MEMBER"]
) {
  const prisma = getPrisma()
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization: {
        memberships: {
          some: {
            userId,
            role: { in: allowed },
          },
        },
      },
    },
    select: { id: true, organizationId: true },
  })

  if (!project) {
    throw new Error("Project mutation access denied.")
  }

  return project
}

export async function serializeGraphForProject(userId: string, projectId: string) {
  await assertProjectAccess(userId, projectId)
  return getWorkspaceForUser(userId, projectId)
}

export const workspaceConverters = {
  toEndpointStatus,
  toAuthType,
  toCadenceMinutes,
}
