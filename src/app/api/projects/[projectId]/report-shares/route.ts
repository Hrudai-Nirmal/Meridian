import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { getPrisma } from "@/lib/prisma"
import { createReportToken, serializeReportShare } from "@/lib/reports"

const maxMapImageBytes = 2 * 1024 * 1024

const reportShareSchema = z.object({
  title: z.string().min(2).max(100).default("Client automation report"),
  clientName: z.string().max(100).optional(),
  subtitle: z.string().max(140).optional(),
  preparedBy: z.string().max(100).optional(),
  executiveNote: z.string().max(800).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  mapImage: z
    .object({
      mimeType: z.literal("image/png"),
      dataUrl: z.string().min(1),
    })
    .optional(),
})

function requestOrigin(request: Request) {
  return process.env.NEXTAUTH_URL ?? new URL(request.url).origin
}

function decodeMapImage(mapImage?: { mimeType: "image/png"; dataUrl: string }) {
  if (!mapImage) return { data: null, error: null }

  const match = mapImage.dataUrl.match(/^data:image\/png;base64,([a-zA-Z0-9+/=]+)$/)
  if (!match) {
    return { data: null, error: "Map attachment must be a PNG data URL." }
  }

  const data = Buffer.from(match[1], "base64")
  const isPng = data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (!isPng) {
    return { data: null, error: "Map attachment must be a valid PNG image." }
  }
  if (data.byteLength > maxMapImageBytes) {
    return { data: null, error: "Map attachment must be 2MB or smaller." }
  }

  return { data, error: null }
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
    select: {
      id: true,
      token: true,
      title: true,
      clientName: true,
      subtitle: true,
      preparedBy: true,
      executiveNote: true,
      mapImageMimeType: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
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
  const mapImage = decodeMapImage(parsed.data.mapImage)
  if (mapImage.error) {
    return NextResponse.json({ error: mapImage.error }, { status: 400 })
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
      subtitle: parsed.data.subtitle?.trim() || null,
      preparedBy: parsed.data.preparedBy?.trim() || null,
      executiveNote: parsed.data.executiveNote?.trim() || null,
      mapImageMimeType: mapImage.data ? "image/png" : null,
      mapImageData: mapImage.data,
      expiresAt,
      projectId,
      createdById: userId,
    },
  })
  await createAuditLog(prisma, {
    action: "report.created",
    entity: "report",
    entityId: share.id,
    projectId,
    userId,
    metadata: { title: share.title, clientName: share.clientName, expiresAt: share.expiresAt, hasMapImage: Boolean(share.mapImageMimeType) },
  })

  return NextResponse.json({ share: serializeReportShare(share, requestOrigin(request)) }, { status: 201 })
}
