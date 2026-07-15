/**
 * Project Slack incoming-webhook destination mutation routes.
 */
import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { getPrisma } from "@/lib/prisma"
import { serializeProjectSlackDestination } from "@/lib/slack"

const slackEvents = ["alert.opened", "alert.resolved", "slack.test"] as const

const updateSlackDestinationSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  minimumSeverity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
  eventFilters: z.array(z.enum(slackEvents)).optional(),
})

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string; slackId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, slackId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const parsed = updateSlackDestinationSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Slack destination payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()
  const existing = await prisma.projectSlackDestination.findFirst({ where: { id: slackId, projectId } })
  if (!existing) {
    return NextResponse.json({ error: "Slack destination not found." }, { status: 404 })
  }

  const destination = await prisma.projectSlackDestination.update({
    where: { id: slackId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.minimumSeverity !== undefined ? { minimumSeverity: parsed.data.minimumSeverity } : {}),
      ...(parsed.data.eventFilters !== undefined ? { eventFilters: parsed.data.eventFilters } : {}),
    },
  })
  await createAuditLog(prisma, {
    action: "slack.updated",
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

  return NextResponse.json({ slackDestination: serializeProjectSlackDestination(destination) })
}

export async function DELETE(_: Request, context: { params: Promise<{ projectId: string; slackId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, slackId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const prisma = getPrisma()
  const destination = await prisma.projectSlackDestination.findFirst({
    where: { id: slackId, projectId },
    select: { id: true, name: true },
  })
  if (!destination) {
    return NextResponse.json({ error: "Slack destination not found." }, { status: 404 })
  }

  await prisma.projectSlackDestination.delete({ where: { id: destination.id } })
  await createAuditLog(prisma, {
    action: "slack.deleted",
    entity: "slack",
    entityId: destination.id,
    projectId,
    userId,
    metadata: { name: destination.name },
  })

  return NextResponse.json({ ok: true })
}
