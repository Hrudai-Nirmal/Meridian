import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { anomalyDefaults, buildAlertRuleMetadata } from "@/lib/alert-rule-metadata"
import { getPrisma } from "@/lib/prisma"

const thresholdExpressionSchema = z.string().regex(/^(>=|>|<=|<|=)\s*-?\d+(\.\d+)?$/, "Use a simple threshold like > 90 or <= 2.")

const alertRuleSchema = z
  .object({
    id: z.string().optional(),
    nodeId: z.string().min(1),
    mappingId: z.string().min(1),
    mappingLabel: z.string().max(80).optional(),
    name: z.string().min(2).max(120),
    expression: z.string().optional(),
    mode: z.enum(["threshold", "anomaly"]).default("threshold"),
    anomalyDirection: z.enum(["high", "low", "both"]).default(anomalyDefaults.direction),
    sigma: z.coerce.number().min(0.5).max(10).default(anomalyDefaults.sigma),
    windowDays: z.coerce.number().int().min(1).max(30).default(anomalyDefaults.windowDays),
    minSamples: z.coerce.number().int().min(3).max(1000).default(anomalyDefaults.minSamples),
    severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
    enabled: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.mode === "threshold" && !thresholdExpressionSchema.safeParse(value.expression).success) {
      context.addIssue({
        code: "custom",
        path: ["expression"],
        message: "Use a simple threshold like > 90 or <= 2.",
      })
    }
  })

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId)
  if (accessError) return accessError

  const parsed = alertRuleSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid alert rule payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()
  const mapping = await prisma.parameterMapping.findFirst({
    where: {
      id: parsed.data.mappingId,
      nodeId: parsed.data.nodeId,
      node: { projectId },
    },
    include: {
      node: { select: { label: true } },
    },
  })

  if (!mapping) {
    return NextResponse.json({ error: "Parameter mapping not found for this project." }, { status: 404 })
  }

  const data = {
    name: parsed.data.name,
    expression: parsed.data.mode === "anomaly" ? `anomaly:${parsed.data.anomalyDirection}` : parsed.data.expression ?? "",
    severity: parsed.data.severity,
    enabled: parsed.data.enabled,
    nodeId: parsed.data.nodeId,
    mappingId: parsed.data.mappingId,
    metadata: buildAlertRuleMetadata({
      mode: parsed.data.mode,
      nodeLabel: mapping.node.label,
      mappingLabel: parsed.data.mappingLabel || mapping.label,
      anomalyDirection: parsed.data.anomalyDirection,
      sigma: parsed.data.sigma,
      windowDays: parsed.data.windowDays,
      minSamples: parsed.data.minSamples,
    }),
    projectId,
  }

  if (parsed.data.id) {
    const existing = await prisma.alertRule.findFirst({
      where: { id: parsed.data.id, projectId },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Alert rule not found." }, { status: 404 })
    }

    const rule = await prisma.alertRule.update({
      where: { id: existing.id },
      data,
    })

    return NextResponse.json({ rule })
  }

  const rule = await prisma.alertRule.create({ data })

  return NextResponse.json({ rule })
}
