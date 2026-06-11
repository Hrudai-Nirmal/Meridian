import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { getPrisma } from "@/lib/prisma"
import { createReportToken, serializeReportShare } from "@/lib/reports"

const reportShareSchema = z.object({
  title: z.string().min(2).max(100).default("Client automation report"),
  clientName: z.string().max(100).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
})

function requestOrigin(request: Request) {
  return process.env.NEXTAUTH_URL ?? new URL(request.url).origin
}

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const prisma = getPrisma()
  const shares = await prisma.reportShare.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  return NextResponse.json({
    shares: shares.map((share) => serializeReportShare(share, requestOrigin(request))),
  })
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const parsed = reportShareSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report share payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()
  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
    : null
  const share = await prisma.reportShare.create({
    data: {
      token: createReportToken(),
      title: parsed.data.title,
      clientName: parsed.data.clientName?.trim() || null,
      expiresAt,
      projectId,
      createdById: userId,
    },
  })

  return NextResponse.json({ share: serializeReportShare(share, requestOrigin(request)) }, { status: 201 })
}
