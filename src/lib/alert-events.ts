/**
 * Shared alert incident creation so polling and workflow-run ingestion use the
 * same duplicate prevention and notification job queueing behavior.
 */
import "server-only"

import type { AlertSeverity, Prisma, PrismaClient } from "@prisma/client"

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
}

/**
 * Creates an unresolved alert event and queues notification jobs inside the
 * caller's transaction. Existing unresolved alerts with the same node/title are
 * treated as the active incident and are not duplicated.
 */
export async function createAlertEventWithJobs(
  prisma: DatabaseClient,
  input: CreateAlertEventInput
): Promise<{ created: boolean; alertEventId: string | null; jobs: QueuedNotificationJobReference[] }> {
  const existing = await prisma.alertEvent.findFirst({
    where: { nodeId: input.nodeId, title: input.title, resolvedAt: null },
    select: { id: true },
  })
  if (existing) return { created: false, alertEventId: existing.id, jobs: [] }

  const alertEvent = await prisma.alertEvent.create({
    data: {
      title: input.title,
      message: input.message,
      severity: input.severity,
      nodeId: input.nodeId,
      ruleId: input.ruleId,
    },
    select: { id: true },
  })
  const jobs = await queueAlertNotificationJobs(prisma, alertEvent.id, "alert.opened")
  return { created: true, alertEventId: alertEvent.id, jobs }
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
