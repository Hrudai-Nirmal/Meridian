import "server-only"

import type { EndpointNode, GraphEdge, MembershipRole, Project, ProjectCategory } from "@prisma/client"

import {
  allEndpointNodes,
  graphEdges as seedGraphEdges,
  projectCategories,
  projectSummary,
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
  }[]
}

type DbProject = Project & {
  categories: ProjectCategory[]
  nodes: DbNode[]
  edges: GraphEdge[]
  alertRules: {
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
    nodeLabel: string | null
    source: string
    firstSeen: string
    lastSeen: string
  }[]
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

function dbNodeToEndpointNode(node: DbNode): EndpointNodeData {
  const seed =
    allEndpointNodes.find((candidate) => candidate.id === node.id || node.id.endsWith(`-${candidate.id}`)) ??
    allEndpointNodes.find((candidate) => candidate.icon === node.iconKind) ??
    allEndpointNodes[0]
  const status = toNodeStatus(node.status)
  const override = node.override ? toNodeStatus(node.override.status) : undefined

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
  }
}

function projectToWorkspace(
  organization: { id: string; name: string; slug: string; onboardingCompleted: boolean },
  currentUserRole: MembershipRole,
  projects: { id: string; name: string; slug: string }[],
  project: DbProject,
  members: WorkspacePayload["members"],
  invitations: WorkspacePayload["invitations"],
  diagnostics: ReadinessStatus
): WorkspacePayload {
  const nodes = project.nodes.map(dbNodeToEndpointNode)
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
    .slice(0, 20)
    .map((event) => ({
      id: event.id,
      title: event.title,
      message: event.message,
      severity: event.severity,
      createdAt: event.createdAt.toISOString(),
      resolvedAt: event.resolvedAt?.toISOString() ?? null,
      nodeLabel: event.node?.label ?? null,
      source: event.ruleId ? "Threshold rule" : event.nodeId ? "Endpoint polling" : "Project",
      firstSeen: event.createdAt.toISOString(),
      lastSeen: event.createdAt.toISOString(),
    }))

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
            select: { id: true, name: true, slug: true },
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
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          onboardingCompleted: true,
          projects: {
            where: { archivedAt: null },
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true, slug: true },
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
            },
            orderBy: { createdAt: "desc" },
            take: 20,
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
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      },
    },
  })

  if (!project) return null

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

  return projectToWorkspace(membership.organization, membership.role, membership.organization.projects, project, members, invitations, diagnostics)
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
