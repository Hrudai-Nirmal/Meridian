/**
 * Shared alert incident creation so polling and workflow-run ingestion use the
 * same duplicate prevention and notification job queueing behavior.
 */
import "server-only"

import type { AlertSeverity, Prisma, PrismaClient } from "@prisma/client"

import { getAlertSuppressionMinutes, shouldSuppressAlertRepeat } from "@/lib/alert-noise-control.mjs"
import { dispatchNotificationJobs, queueAlertNotificationJobs } from "@/lib/notification-jobs"
import { getPrisma } from "@/lib/prisma"

type DatabaseClient = PrismaClient | Prisma.TransactionClient

export type QueuedNotificationJobReference = {
  id: string
  generation: number
}

export type CreateAlertEventInput = {
  nodeId: string
  title: string
  message: string
  severity: AlertSeverity
  ruleId?: string | null
  occurredAt?: Date
}

/**
 * Creates an unresolved alert event and queues notification jobs inside the
 * caller's transaction. Existing unresolved alerts with the same node/title are
 * grouped onto the active incident and only notify again after the rule's
 * suppression window expires.
 */
export async function createAlertEventWithJobs(
  prisma: DatabaseClient,
  input: CreateAlertEventInput
): Promise<{ created: boolean; suppressed: boolean; grouped: boolean; alertEventId: string | null; jobs: QueuedNotificationJobReference[] }> {
  const now = input.occurredAt ?? new Date()
  const existing = await prisma.alertEvent.findFirst({
    where: { nodeId: input.nodeId, title: input.title, resolvedAt: null },
    select: { id: true, lastSeenAt: true, rule: { select: { metadata: true } } },
  })
  if (existing) {
    const suppressionMinutes = getAlertSuppressionMinutes(existing.rule?.metadata)
    const suppressed = shouldSuppressAlertRepeat({ lastSeenAt: existing.lastSeenAt, now, suppressionMinutes })
    await prisma.alertEvent.update({
      where: { id: existing.id },
      data: {
        message: input.message,
        severity: input.severity,
        lastSeenAt: now,
        occurrenceCount: { increment: 1 },
      },
      select: { id: true },
    })
    const jobs = suppressed ? [] : await queueAlertNotificationJobs(prisma, existing.id, "alert.opened")
    return { created: false, suppressed, grouped: true, alertEventId: existing.id, jobs }
  }

  const alertEvent = await prisma.alertEvent.create({
    data: {
      title: input.title,
      message: input.message,
      severity: input.severity,
      nodeId: input.nodeId,
      ruleId: input.ruleId,
      lastSeenAt: now,
      occurrenceCount: 1,
    },
    select: { id: true },
  })
  const jobs = await queueAlertNotificationJobs(prisma, alertEvent.id, "alert.opened")
  return { created: true, suppressed: false, grouped: false, alertEventId: alertEvent.id, jobs }
}

/**
 * Runs alert creation in its own transaction and dispatches queued jobs after
 * the transaction commits.
 */
export async function createAndDispatchAlertEvent(input: CreateAlertEventInput): Promise<boolean> {
  const prisma = getPrisma()
  const result = await prisma.$transaction((transaction) => createAlertEventWithJobs(transaction, input))
  await dispatchNotificationJobs(result.jobs)
  return result.created
}
