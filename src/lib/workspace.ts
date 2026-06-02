import "server-only"

import type { EndpointNode, GraphEdge, Project, ProjectCategory } from "@prisma/client"

import {
  allEndpointNodes,
  graphEdges as seedGraphEdges,
  projectCategories,
  projectSummary,
  type EndpointNodeData,
  type IconKind,
  type NodeStatus,
} from "@/lib/argusgrid-data"
import { getPrisma } from "@/lib/prisma"

type DbNode = EndpointNode & {
  override: { status: string; reason: string; expiresAt: Date | null } | null
  endpointConfig: { url: string; method: string; authType: string; cadenceMin: number } | null
}

type DbProject = Project & {
  categories: ProjectCategory[]
  nodes: DbNode[]
  edges: GraphEdge[]
}

export type WorkspacePayload = {
  organization: {
    id: string
    name: string
    slug: string
  }
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
  }
}

function projectToWorkspace(
  organization: { id: string; name: string; slug: string },
  projects: { id: string; name: string; slug: string }[],
  project: DbProject
): WorkspacePayload {
  const nodes = project.nodes.map(dbNodeToEndpointNode)
  const activeNodes = nodes.filter((node) => (node.override ?? node.status) === "active").length
  const degradedNodes = nodes.filter((node) => (node.override ?? node.status) === "degraded").length
  const downNodes = nodes.filter((node) => (node.override ?? node.status) === "down").length

  return {
    organization,
    projects,
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
    },
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

async function createSeedProject(organizationId: string) {
  const prisma = getPrisma()

  const project = await prisma.project.create({
    data: {
      name: projectSummary.project,
      slug: "support-automation-grid",
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

export async function ensureWorkspaceForUser(user: { id: string; name?: string | null; email?: string | null }) {
  const prisma = getPrisma()
  const existingMembership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: {
      organization: {
        include: {
          projects: {
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
      await createSeedProject(existingMembership.organizationId)
    }

    return getWorkspaceForUser(user.id)
  }

  const organizationName = user.name ? `${user.name}'s Workspace` : "Personal Workspace"
  const slug = await uniqueOrganizationSlug(user.email ?? user.name ?? user.id)

  const organization = await prisma.organization.create({
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

  await createSeedProject(organization.id)

  return getWorkspaceForUser(user.id)
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
          projects: {
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true, slug: true },
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
    },
    include: {
      categories: true,
      nodes: {
        include: {
          override: true,
          endpointConfig: true,
        },
        orderBy: { createdAt: "asc" },
      },
      edges: {
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!project) return null

  return projectToWorkspace(membership.organization, membership.organization.projects, project)
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

export async function serializeGraphForProject(userId: string, projectId: string) {
  await assertProjectAccess(userId, projectId)
  return getWorkspaceForUser(userId, projectId)
}

export const workspaceConverters = {
  toEndpointStatus,
  toAuthType,
  toCadenceMinutes,
}
