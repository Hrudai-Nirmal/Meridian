import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { getPrisma } from "@/lib/prisma"
import { getWorkspaceForUser } from "@/lib/workspace"

const preferenceSchema = z.object({
  enabled: z.boolean(),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
})

export async function GET() {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const workspace = await getWorkspaceForUser(userId)
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 })
  }

  return NextResponse.json({ preference: workspace.notificationPreference })
}

export async function PUT(request: Request) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const parsed = preferenceSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification preference.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()
  const workspace = await getWorkspaceForUser(userId)
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 })
  }

  const preference = await prisma.notificationPreference.upsert({
    where: {
      userId_channel: {
        userId,
        channel: "email",
      },
    },
    update: {
      enabled: parsed.data.enabled,
      severity: parsed.data.severity,
    },
    create: {
      userId,
      channel: "email",
      enabled: parsed.data.enabled,
      severity: parsed.data.severity,
    },
  })
  await createAuditLog(prisma, {
    action: "notification.updated",
    entity: "notification",
    entityId: preference.id,
    organizationId: workspace.organization.id,
    projectId: workspace.project.id,
    userId,
    metadata: { channel: preference.channel, enabled: preference.enabled, severity: preference.severity },
  })

  return NextResponse.json({
    preference: {
      enabled: preference.enabled,
      severity: preference.severity,
    },
  })
}
