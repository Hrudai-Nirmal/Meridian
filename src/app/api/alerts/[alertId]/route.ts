import { NextResponse } from "next/server"

import { getApiUserId } from "@/lib/api-session"
import { getPrisma } from "@/lib/prisma"

export async function PATCH(_: Request, context: { params: Promise<{ alertId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { alertId } = await context.params
  const prisma = getPrisma()
  const alert = await prisma.alertEvent.findFirst({
    where: {
      id: alertId,
      OR: [
        {
          rule: {
            project: {
              organization: {
                memberships: {
                  some: { userId },
                },
              },
            },
          },
        },
        {
          node: {
            project: {
              organization: {
                memberships: {
                  some: { userId },
                },
              },
            },
          },
        },
      ],
    },
    select: { id: true },
  })

  if (!alert) {
    return NextResponse.json({ error: "Alert not found." }, { status: 404 })
  }

  await prisma.alertEvent.update({
    where: { id: alertId },
    data: { resolvedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
