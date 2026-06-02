import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const categories = [
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

const nodes = [
  {
    id: "ai-agent",
    label: "AI Agent",
    description: "Primary customer support automation run loop.",
    icon: "ai",
    status: "ACTIVE",
    statusReason: "Last poll passed 2 minutes ago.",
    category: "Execution Health",
    url: "https://api.example.com/agents/support/runs",
    authType: "BEARER_TOKEN",
    cadenceMin: 5,
    x: 130,
    y: 170,
  },
  {
    id: "gmail",
    label: "Gmail Inbox",
    description: "Inbound email trigger for automated ticket creation.",
    icon: "gmail",
    status: "DEGRADED",
    statusReason: "OAuth refresh succeeded but freshness is 18 minutes behind.",
    category: "Data Freshness",
    url: "https://gmail.googleapis.com/gmail/v1/users/me/messages",
    authType: "BEARER_TOKEN",
    cadenceMin: 10,
    x: 390,
    y: 105,
  },
  {
    id: "vector-db",
    label: "Vector DB",
    description: "Retrieval index for support knowledge and policies.",
    icon: "vector",
    status: "ACTIVE",
    statusReason: "Query latency and index freshness are within targets.",
    category: "Performance",
    url: "https://api.example.com/vector/index/stats",
    authType: "API_KEY_HEADER",
    cadenceMin: 15,
    x: 650,
    y: 220,
  },
  {
    id: "crm",
    label: "CRM Sync",
    description: "Customer handoff and account enrichment endpoint.",
    icon: "crm",
    status: "DOWN",
    statusReason: "Latest health check returned 503.",
    category: "Alerts & Incidents",
    url: "https://api.example.com/crm/sync/health",
    authType: "CUSTOM_HEADERS",
    cadenceMin: 15,
    x: 880,
    y: 120,
    override: "DEGRADED",
  },
  {
    id: "scheduler",
    label: "Scheduler",
    description: "Cron and queue trigger monitor.",
    icon: "scheduler",
    status: "ACTIVE",
    statusReason: "All scheduled jobs fired within expected windows.",
    category: "Team Operations",
    url: "https://api.example.com/scheduler/jobs",
    authType: "NONE",
    cadenceMin: 15,
    x: 255,
    y: 375,
  },
  {
    id: "slack",
    label: "Slack Alerts",
    description: "Team notification and incident routing channel.",
    icon: "slack",
    status: "ACTIVE",
    statusReason: "Notification route acknowledged latest delivery.",
    category: "Alerts & Incidents",
    url: "https://slack.com/api/chat.postMessage",
    authType: "BEARER_TOKEN",
    cadenceMin: 15,
    x: 590,
    y: 430,
  },
]

const edges = [
  { id: "edge-mail-agent", source: "gmail", target: "ai-agent", label: "incoming context" },
  { id: "edge-agent-vector", source: "ai-agent", target: "vector-db", label: "retrieval" },
  { id: "edge-agent-crm", source: "ai-agent", target: "crm", label: "handoff" },
  { id: "edge-scheduler-agent", source: "scheduler", target: "ai-agent", label: "scheduled run" },
  { id: "edge-crm-slack", source: "crm", target: "slack", label: "incident notify" },
]

async function main() {
  const user = await prisma.user.upsert({
    where: { email: process.env.SEED_USER_EMAIL ?? "demo@argusgrid.local" },
    update: {},
    create: {
      email: process.env.SEED_USER_EMAIL ?? "demo@argusgrid.local",
      name: process.env.SEED_USER_NAME ?? "ArgusGrid Demo",
    },
  })

  const organization = await prisma.organization.upsert({
    where: { slug: "northstar-ai-ops-demo" },
    update: {},
    create: {
      name: "Northstar AI Ops",
      slug: "northstar-ai-ops-demo",
      onboardingCompleted: true,
    },
  })

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
    update: { role: "OWNER" },
    create: {
      userId: user.id,
      organizationId: organization.id,
      role: "OWNER",
    },
  })

  const existingProject = await prisma.project.findUnique({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: "support-automation-grid",
      },
    },
  })

  if (existingProject) {
    console.log("Seed project already exists; no duplicates created.")
    return
  }

  const project = await prisma.project.create({
    data: {
      name: "Support Automation Grid",
      slug: "support-automation-grid",
      organizationId: organization.id,
      categories: {
        create: categories.map((name, position) => ({ name, position })),
      },
    },
  })

  const ids = new Map(nodes.map((node) => [node.id, `${project.id}-${node.id}`]))

  for (const node of nodes) {
    await prisma.endpointNode.create({
      data: {
        id: ids.get(node.id),
        label: node.label,
        description: node.description,
        iconKind: node.icon,
        status: node.status,
        statusReason: node.statusReason,
        category: node.category,
        x: node.x,
        y: node.y,
        projectId: project.id,
        endpointConfig: {
          create: {
            url: node.url,
            method: "GET",
            authType: node.authType,
            cadenceMin: node.cadenceMin,
          },
        },
        override: node.override
          ? {
              create: {
                status: node.override,
                reason: "Seeded admin override",
              },
            }
          : undefined,
      },
    })
  }

  await prisma.graphEdge.createMany({
    data: edges.map((edge) => ({
      id: `${project.id}-${edge.id}`,
      sourceId: ids.get(edge.source),
      targetId: ids.get(edge.target),
      label: edge.label,
      projectId: project.id,
    })),
  })

  console.log("Seeded ArgusGrid demo workspace.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
