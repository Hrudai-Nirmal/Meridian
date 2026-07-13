import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { getPrisma } from "@/lib/prisma"
import { decodeReportAsset, MAX_BRAND_IMAGE_BYTES, MAX_MAP_IMAGE_BYTES } from "@/lib/report-assets.mjs"
import { resolveReportPeriod } from "@/lib/report-periods.mjs"
import { createReportToken, serializeReportShare } from "@/lib/reports"

const reportShareSchema = z.object({
  title: z.string().min(2).max(100).default("Client automation report"),
  clientName: z.string().max(100).optional(),
  subtitle: z.string().max(140).optional(),
  preparedBy: z.string().max(100).optional(),
  executiveNote: z.string().max(800).optional(),
  periodMode: z.enum(["window", "custom", "all"]).default("window"),
  periodWindow: z.enum(["7d", "30d", "90d"]).nullable().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  comparisonEnabled: z.boolean().default(true),
  presetId: z.string().nullable().optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  mapImage: z
    .object({
      mimeType: z.literal("image/png"),
      dataUrl: z.string().min(1),
    })
    .optional(),
  brandImage: z
    .object({
      mimeType: z.enum(["image/png", "image/svg+xml"]),
      dataUrl: z.string().min(1),
    })
    .optional(),
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
    select: {
      id: true,
      token: true,
      title: true,
      clientName: true,
      subtitle: true,
      preparedBy: true,
      executiveNote: true,
      mapImageMimeType: true,
      brandImageMimeType: true,
      periodMode: true,
      periodWindow: true,
      periodStart: true,
      periodEnd: true,
      comparisonEnabled: true,
      presetId: true,
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
  const mapImage = decodeReportAsset({
    asset: parsed.data.mapImage,
    allowedMimeTypes: ["image/png"],
    maxBytes: MAX_MAP_IMAGE_BYTES,
    label: "Map attachment",
  })
  if (mapImage.error) {
    return NextResponse.json({ error: mapImage.error }, { status: 400 })
  }
  const brandImage = decodeReportAsset({
    asset: parsed.data.brandImage,
    allowedMimeTypes: ["image/png", "image/svg+xml"],
    maxBytes: MAX_BRAND_IMAGE_BYTES,
    label: "Brand image",
  })
  if (brandImage.error) {
    return NextResponse.json({ error: brandImage.error }, { status: 400 })
  }
  try {
    resolveReportPeriod({
      mode: parsed.data.periodMode,
      window: parsed.data.periodWindow,
      start: parsed.data.periodStart,
      end: parsed.data.periodEnd,
      comparisonEnabled: parsed.data.comparisonEnabled,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid report period." }, { status: 400 })
  }

  const prisma = getPrisma()
  const presetId = parsed.data.presetId?.trim() || null
  if (presetId) {
    const preset = await prisma.reportPreset.findFirst({
      where: { id: presetId, projectId },
      select: { id: true },
    })
    if (!preset) {
      return NextResponse.json({ error: "Report preset not found for this project." }, { status: 404 })
    }
  }
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
      mapImageData: mapImage.data ? new Uint8Array(mapImage.data) : null,
      brandImageMimeType: brandImage.mimeType,
      brandImageData: brandImage.data ? new Uint8Array(brandImage.data) : null,
      periodMode: parsed.data.periodMode,
      periodWindow: parsed.data.periodMode === "window" ? parsed.data.periodWindow ?? "30d" : null,
      periodStart: parsed.data.periodMode === "custom" && parsed.data.periodStart ? new Date(parsed.data.periodStart) : null,
      periodEnd: parsed.data.periodMode === "custom" && parsed.data.periodEnd ? new Date(parsed.data.periodEnd) : null,
      comparisonEnabled: parsed.data.periodMode !== "all" && parsed.data.comparisonEnabled,
      presetId,
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
    metadata: {
      title: share.title,
      clientName: share.clientName,
      expiresAt: share.expiresAt,
      hasMapImage: Boolean(share.mapImageMimeType),
      hasBrandImage: Boolean(share.brandImageMimeType),
      periodMode: share.periodMode,
      periodWindow: share.periodWindow,
      comparisonEnabled: share.comparisonEnabled,
    },
  })

  return NextResponse.json({ share: serializeReportShare(share, requestOrigin(request)) }, { status: 201 })
}
