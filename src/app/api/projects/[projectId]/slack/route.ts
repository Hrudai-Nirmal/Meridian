/**
 * Project Slack incoming-webhook destination collection routes.
 */
import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { getPrisma } from "@/lib/prisma"
import {
  deliverProjectSlack,
  encryptSlackWebhookUrl,
  serializeProjectSlackDestination,
  validateSlackWebhookUrl,
} from "@/lib/slack"

const slackEvents = ["alert.opened", "alert.resolved", "slack.test"] as const

const slackDestinationSchema = z.object({
  name: z.string().min(1).max(120),
  webhookUrl: z.string().url().max(2048),
  enabled: z.boolean().default(true),
  minimumSeverity: z.enum(["INFO", "WARNING", "CRITICAL"]).default("WARNING"),
  eventFilters: z.array(z.enum(slackEvents)).default(["alert.opened", "alert.resolved", "slack.test"]),
})

export async function GET(_: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId)
  if (accessError) return accessError

  const prisma = getPrisma()
  const destinations = await prisma.projectSlackDestination.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ slackDestinations: destinations.map(serializeProjectSlackDestination) })
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId)
  if (accessError) return accessError

  const parsed = slackDestinationSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Slack destination payload.", details: parsed.error.flatten() }, { status: 400 })
  }
  if (!validateSlackWebhookUrl(parsed.data.webhookUrl)) {
    return NextResponse.json({ error: "Slack webhook URL must be HTTPS and hosted on hooks.slack.com." }, { status: 400 })
  }

  const prisma = getPrisma()
  const projectExists = await prisma.project.count({ where: { id: projectId } })
  if (!projectExists) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 })
  }

  const destination = await prisma.projectSlackDestination.create({
    data: {
      name: parsed.data.name,
      webhookUrlEncrypted: encryptSlackWebhookUrl(parsed.data.webhookUrl),
      enabled: parsed.data.enabled,
      minimumSeverity: parsed.data.minimumSeverity,
      eventFilters: parsed.data.eventFilters,
      projectId,
    },
  })
  await createAuditLog(prisma, {
    action: "slack.created",
    entity: "slack",
    entityId: destination.id,
    projectId,
    userId,
    metadata: {
      name: destination.name,
      enabled: destination.enabled,
      minimumSeverity: destination.minimumSeverity,
      eventFilters: destination.eventFilters,
    },
  })

  const testResult = await deliverProjectSlack(prisma, {
    eventType: "slack.test",
    projectId,
    destinationId: destination.id,
  })

  return NextResponse.json(
    {
      slackDestination: serializeProjectSlackDestination(destination),
      testResult,
    },
    { status: 201 }
  )
}
