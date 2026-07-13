import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { getPrisma } from "@/lib/prisma"
import { decodeReportAsset, MAX_BRAND_IMAGE_BYTES } from "@/lib/report-assets.mjs"
import { resolveReportPeriod } from "@/lib/report-periods.mjs"

const reportPresetSchema = z.object({
  name: z.string().min(2).max(80),
  title: z.string().min(2).max(100),
  clientName: z.string().max(100).optional(),
  subtitle: z.string().max(140).optional(),
  preparedBy: z.string().max(100).optional(),
  executiveNote: z.string().max(800).optional(),
  periodMode: z.enum(["window", "custom", "all"]).default("window"),
  periodWindow: z.enum(["7d", "30d", "90d"]).nullable().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  comparisonEnabled: z.boolean().default(true),
  brandImage: z
    .object({
      mimeType: z.enum(["image/png", "image/svg+xml"]),
      dataUrl: z.string().min(1),
    })
    .optional(),
})

function imageDataUrl(mimeType: string | null, data: Uint8Array | Buffer | null) {
  if (!mimeType || !data) return null
  return `data:${mimeType};base64,${Buffer.from(data).toString("base64")}`
}

function serializePreset(preset: {
  id: string
  name: string
  title: string
  clientName: string | null
  subtitle: string | null
  preparedBy: string | null
  executiveNote: string | null
  brandImageMimeType: string | null
  brandImageData: Uint8Array | Buffer | null
  periodMode: string
  periodWindow: string | null
  periodStart: Date | null
  periodEnd: Date | null
  comparisonEnabled: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: preset.id,
    name: preset.name,
    title: preset.title,
    clientName: preset.clientName,
    subtitle: preset.subtitle,
    preparedBy: preset.preparedBy,
    executiveNote: preset.executiveNote,
    brandImage: preset.brandImageMimeType
      ? {
          mimeType: preset.brandImageMimeType,
          dataUrl: imageDataUrl(preset.brandImageMimeType, preset.brandImageData),
        }
      : null,
    periodMode: preset.periodMode,
    periodWindow: preset.periodWindow,
    periodStart: preset.periodStart?.toISOString() ?? null,
    periodEnd: preset.periodEnd?.toISOString() ?? null,
    comparisonEnabled: preset.comparisonEnabled,
    createdAt: preset.createdAt.toISOString(),
    updatedAt: preset.updatedAt.toISOString(),
  }
}

export async function GET(_: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const prisma = getPrisma()
  const presets = await prisma.reportPreset.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    take: 50,
  })

  return NextResponse.json({ presets: presets.map(serializePreset) })
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const parsed = reportPresetSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report preset payload.", details: parsed.error.flatten() }, { status: 400 })
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
  const brandImage = decodeReportAsset({
    asset: parsed.data.brandImage,
    allowedMimeTypes: ["image/png", "image/svg+xml"],
    maxBytes: MAX_BRAND_IMAGE_BYTES,
    label: "Brand image",
  })
  if (brandImage.error) {
    return NextResponse.json({ error: brandImage.error }, { status: 400 })
  }

  const prisma = getPrisma()
  const preset = await prisma.reportPreset.create({
    data: {
      name: parsed.data.name.trim(),
      title: parsed.data.title.trim(),
      clientName: parsed.data.clientName?.trim() || null,
      subtitle: parsed.data.subtitle?.trim() || null,
      preparedBy: parsed.data.preparedBy?.trim() || null,
      executiveNote: parsed.data.executiveNote?.trim() || null,
      brandImageMimeType: brandImage.mimeType,
      brandImageData: brandImage.data ? new Uint8Array(brandImage.data) : null,
      periodMode: parsed.data.periodMode,
      periodWindow: parsed.data.periodMode === "window" ? parsed.data.periodWindow ?? "30d" : null,
      periodStart: parsed.data.periodMode === "custom" && parsed.data.periodStart ? new Date(parsed.data.periodStart) : null,
      periodEnd: parsed.data.periodMode === "custom" && parsed.data.periodEnd ? new Date(parsed.data.periodEnd) : null,
      comparisonEnabled: parsed.data.periodMode !== "all" && parsed.data.comparisonEnabled,
      projectId,
      createdById: userId,
    },
  })
  await createAuditLog(prisma, {
    action: "report_preset.created",
    entity: "report_preset",
    entityId: preset.id,
    projectId,
    userId,
    metadata: {
      name: preset.name,
      periodMode: preset.periodMode,
      periodWindow: preset.periodWindow,
      comparisonEnabled: preset.comparisonEnabled,
      hasBrandImage: Boolean(preset.brandImageMimeType),
    },
  })

  return NextResponse.json({ preset: serializePreset(preset) }, { status: 201 })
}
