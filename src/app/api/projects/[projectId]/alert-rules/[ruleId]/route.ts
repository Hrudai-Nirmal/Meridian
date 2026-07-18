import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { anomalyDefaults, buildAlertRuleMetadata, normalizeAlertRuleMetadata } from "@/lib/alert-rule-metadata"
import { MAX_ALERT_SUPPRESSION_MINUTES } from "@/lib/alert-noise-control.mjs"
import { getPrisma } from "@/lib/prisma"

const thresholdExpressionSchema = z.string().regex(/^(>=|>|<=|<|=)\s*-?\d+(\.\d+)?$/)
const statusExpressionSchema = z.literal("!= success")

const patchRuleSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    expression: z.string().optional(),
    source: z.enum(["metric", "run"]).optional(),
    templateId: z.string().max(80).nullable().optional(),
    mode: z.enum(["threshold", "anomaly"]).optional(),
    anomalyDirection: z.enum(["high", "low", "both"]).optional(),
    sigma: z.coerce.number().min(0.5).max(10).optional(),
    windowDays: z.coerce.number().int().min(1).max(30).optional(),
    minSamples: z.coerce.number().int().min(3).max(1000).optional(),
    runMetric: z.enum(["status", "durationMs", "costUsd", "tokens", "failureRate", "averageDurationMs"]).nullable().optional(),
    windowRuns: z.coerce.number().int().min(1).max(100).optional(),
    suppressionMinutes: z.coerce.number().int().min(0).max(MAX_ALERT_SUPPRESSION_MINUTES).optional(),
    severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
    enabled: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.source === "run" && value.runMetric === "status" && value.expression && !statusExpressionSchema.safeParse(value.expression).success) {
      context.addIssue({
        code: "custom",
        path: ["expression"],
        message: "Status run rules use != success.",
      })
    }
    if (value.source === "run" && value.runMetric !== "status" && value.expression && !thresholdExpressionSchema.safeParse(value.expression).success) {
      context.addIssue({
        code: "custom",
        path: ["expression"],
        message: "Use a simple threshold like > 5000 or <= 2.",
      })
    }
    if (value.source !== "run" && value.mode === "threshold" && !thresholdExpressionSchema.safeParse(value.expression).success) {
      context.addIssue({
        code: "custom",
        path: ["expression"],
        message: "Use a simple threshold like > 90 or <= 2.",
      })
    }
    if (value.source !== "run" && !value.mode && value.expression && !thresholdExpressionSchema.safeParse(value.expression).success) {
      context.addIssue({
        code: "custom",
        path: ["expression"],
        message: "Use a simple threshold like > 90 or <= 2.",
      })
    }
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
    select: { id: true, metadata: true },
  })

  if (!existing) {
    return NextResponse.json({ error: "Alert rule not found." }, { status: 404 })
  }

  const currentMetadata = normalizeAlertRuleMetadata(existing.metadata)
  const nextSource = parsed.data.source ?? currentMetadata.source
  const nextMode = parsed.data.mode ?? currentMetadata.mode
  const nextDirection = parsed.data.anomalyDirection ?? currentMetadata.anomaly?.direction ?? anomalyDefaults.direction
  const data = {
    name: parsed.data.name,
    expression:
      nextSource === "metric" && nextMode === "anomaly"
        ? `anomaly:${nextDirection}`
        : parsed.data.expression,
    severity: parsed.data.severity,
    enabled: parsed.data.enabled,
    metadata:
      parsed.data.source ||
      parsed.data.templateId !== undefined ||
      parsed.data.mode ||
      parsed.data.anomalyDirection ||
      parsed.data.sigma ||
      parsed.data.windowDays ||
      parsed.data.minSamples ||
      parsed.data.runMetric !== undefined ||
      parsed.data.windowRuns ||
      parsed.data.suppressionMinutes !== undefined
        ? buildAlertRuleMetadata({
            source: nextSource,
            mode: nextMode,
            templateId: parsed.data.templateId ?? currentMetadata.templateId,
            nodeLabel: currentMetadata.nodeLabel,
            mappingLabel: nextSource === "run" ? null : currentMetadata.mappingLabel,
            anomalyDirection: nextDirection,
            sigma: parsed.data.sigma ?? currentMetadata.anomaly?.sigma ?? anomalyDefaults.sigma,
            windowDays: parsed.data.windowDays ?? currentMetadata.anomaly?.windowDays ?? anomalyDefaults.windowDays,
            minSamples: parsed.data.minSamples ?? currentMetadata.anomaly?.minSamples ?? anomalyDefaults.minSamples,
            runMetric: parsed.data.runMetric ?? currentMetadata.run?.metric ?? null,
            windowRuns: parsed.data.windowRuns ?? currentMetadata.run?.windowRuns ?? 1,
            suppressionMinutes: parsed.data.suppressionMinutes ?? currentMetadata.suppressionMinutes,
          })
        : undefined,
    mappingId: nextSource === "run" ? null : undefined,
  }

  const rule = await prisma.alertRule.update({
    where: { id: existing.id },
    data,
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
