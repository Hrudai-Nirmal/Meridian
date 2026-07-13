import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { getPrisma } from "@/lib/prisma"
import { decodeReportAsset, MAX_BRAND_IMAGE_BYTES } from "@/lib/report-assets.mjs"
import { resolveReportPeriod } from "@/lib/report-periods.mjs"

const patchReportPresetSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  title: z.string().min(2).max(100).optional(),
  clientName: z.string().max(100).nullable().optional(),
  subtitle: z.string().max(140).nullable().optional(),
  preparedBy: z.string().max(100).nullable().optional(),
  executiveNote: z.string().max(800).nullable().optional(),
  periodMode: z.enum(["window", "custom", "all"]).optional(),
  periodWindow: z.enum(["7d", "30d", "90d"]).nullable().optional(),
  periodStart: z.string().nullable().optional(),
  periodEnd: z.string().nullable().optional(),
  comparisonEnabled: z.boolean().optional(),
  clearBrandImage: z.boolean().optional(),
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

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string; presetId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, presetId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const parsed = patchReportPresetSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report preset payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()
  const existing = await prisma.reportPreset.findFirst({
    where: { id: presetId, projectId },
  })
  if (!existing) {
    return NextResponse.json({ error: "Report preset not found." }, { status: 404 })
  }

  const nextPeriodMode = parsed.data.periodMode ?? existing.periodMode
  const nextPeriodWindow = parsed.data.periodWindow !== undefined ? parsed.data.periodWindow : existing.periodWindow
  const nextPeriodStart = parsed.data.periodStart !== undefined ? parsed.data.periodStart : existing.periodStart
  const nextPeriodEnd = parsed.data.periodEnd !== undefined ? parsed.data.periodEnd : existing.periodEnd
  const nextComparisonEnabled = parsed.data.comparisonEnabled ?? existing.comparisonEnabled
  try {
    resolveReportPeriod({
      mode: nextPeriodMode,
      window: nextPeriodWindow,
      start: nextPeriodStart,
      end: nextPeriodEnd,
      comparisonEnabled: nextComparisonEnabled,
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

  const preset = await prisma.reportPreset.update({
    where: { id: existing.id },
    data: {
      name: parsed.data.name?.trim(),
      title: parsed.data.title?.trim(),
      clientName: parsed.data.clientName !== undefined ? parsed.data.clientName?.trim() || null : undefined,
      subtitle: parsed.data.subtitle !== undefined ? parsed.data.subtitle?.trim() || null : undefined,
      preparedBy: parsed.data.preparedBy !== undefined ? parsed.data.preparedBy?.trim() || null : undefined,
      executiveNote: parsed.data.executiveNote !== undefined ? parsed.data.executiveNote?.trim() || null : undefined,
      brandImageMimeType: parsed.data.clearBrandImage ? null : brandImage.mimeType ?? undefined,
      brandImageData: parsed.data.clearBrandImage ? null : brandImage.data ? new Uint8Array(brandImage.data) : undefined,
      periodMode: nextPeriodMode,
      periodWindow: nextPeriodMode === "window" ? nextPeriodWindow ?? "30d" : null,
      periodStart: nextPeriodMode === "custom" && nextPeriodStart ? new Date(nextPeriodStart) : null,
      periodEnd: nextPeriodMode === "custom" && nextPeriodEnd ? new Date(nextPeriodEnd) : null,
      comparisonEnabled: nextPeriodMode !== "all" && nextComparisonEnabled,
    },
  })
  await createAuditLog(prisma, {
    action: "report_preset.updated",
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

  return NextResponse.json({ preset: serializePreset(preset) })
}

export async function DELETE(_: Request, context: { params: Promise<{ projectId: string; presetId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, presetId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const prisma = getPrisma()
  const existing = await prisma.reportPreset.findFirst({
    where: { id: presetId, projectId },
    select: { id: true, name: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Report preset not found." }, { status: 404 })
  }

  await prisma.reportPreset.delete({ where: { id: existing.id } })
  await createAuditLog(prisma, {
    action: "report_preset.deleted",
    entity: "report_preset",
    entityId: existing.id,
    projectId,
    userId,
    metadata: { name: existing.name },
  })

  return NextResponse.json({ ok: true })
}
