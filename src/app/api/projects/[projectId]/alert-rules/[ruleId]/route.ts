import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { getPrisma } from "@/lib/prisma"

const patchRuleSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  expression: z.string().regex(/^(>=|>|<=|<|=)\s*-?\d+(\.\d+)?$/).optional(),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
  enabled: z.boolean().optional(),
})

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string; ruleId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, ruleId } = await context.params
  const accessError = await requireProjectRole(userId, projectId)
  if (accessError) return accessError

  const parsed = patchRuleSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid alert rule payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()
  const existing = await prisma.alertRule.findFirst({
    where: { id: ruleId, projectId },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: "Alert rule not found." }, { status: 404 })
  }

  const rule = await prisma.alertRule.update({
    where: { id: existing.id },
    data: parsed.data,
  })

  return NextResponse.json({ rule })
}

export async function DELETE(_: Request, context: { params: Promise<{ projectId: string; ruleId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, ruleId } = await context.params
  const accessError = await requireProjectRole(userId, projectId)
  if (accessError) return accessError

  const prisma = getPrisma()
  const existing = await prisma.alertRule.findFirst({
    where: { id: ruleId, projectId },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: "Alert rule not found." }, { status: 404 })
  }

  await prisma.alertRule.delete({
    where: { id: existing.id },
  })

  return NextResponse.json({ ok: true })
}
