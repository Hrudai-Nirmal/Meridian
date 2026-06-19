/**
 * Postgres-backed notification outbox and single-attempt job execution.
 */
import "server-only"

import { randomUUID } from "node:crypto"
import type { AlertSeverity, NotificationJob, NotificationJobStatus, Prisma, PrismaClient } from "@prisma/client"

import { inngest } from "@/inngest/client"
import { sendEmailAttempt } from "@/lib/notifications"
import { getPrisma } from "@/lib/prisma"
import { logServerError } from "@/lib/server-logging"
import { normalizeSlackEvents, sendSlackAttempt, slackSeverityAllows } from "@/lib/slack"
import { getWebhookRecipient, normalizeWebhookEvents, sendWebhookAttempt } from "@/lib/webhooks"

export const NOTIFICATION_JOB_STATUSES = ["QUEUED", "RUNNING", "RETRYING", "SENT", "FAILED", "SKIPPED", "CANCELLED"] as const
const TERMINAL_JOB_STATUSES: NotificationJobStatus[] = ["SENT", "FAILED", "SKIPPED", "CANCELLED"]
const ACTIVE_JOB_STATUSES: NotificationJobStatus[] = ["QUEUED", "RETRYING"]
const STALE_LOCK_MS = 10 * 60 * 1000
const TERMINAL_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

type DatabaseClient = PrismaClient | Prisma.TransactionClient
type AlertDeliveryEvent = "alert.opened" | "alert.resolved"
type QueueJobInput = {
  channel: "email" | "webhook" | "slack"
  eventType: string
  recipient: string
  provider: string
  projectId: string
  alertEventId?: string
  destinationId?: string
  idempotencyKey: string
}

const severityRank: Record<AlertSeverity, number> = { INFO: 0, WARNING: 1, CRITICAL: 2 }

function sanitizeFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "Notification delivery failed."
  return message.replace(/https?:\/\/\S+/gi, "[endpoint]").slice(0, 240)
}

function emailSeverityAllows(preferenceSeverity: string, alertSeverity: AlertSeverity) {
  const minimum = severityRank[preferenceSeverity as AlertSeverity] ?? severityRank.WARNING
  return severityRank[alertSeverity] >= minimum
}

async function createNotificationJob(prisma: DatabaseClient, input: QueueJobInput) {
  return prisma.notificationJob.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    update: {},
    create: {
      channel: input.channel,
      eventType: input.eventType,
      recipient: input.recipient,
      destinationId: input.destinationId,
      idempotencyKey: input.idempotencyKey,
      projectId: input.projectId,
      alertEventId: input.alertEventId,
      delivery: {
        create: {
          channel: input.channel,
          recipient: input.recipient,
          status: "QUEUED",
          provider: input.provider,
          alertEventId: input.alertEventId,
        },
      },
    },
    select: { id: true, generation: true },
  })
}

/** Creates destination-specific jobs for an alert lifecycle event inside the caller's transaction. */
export async function queueAlertNotificationJobs(prisma: DatabaseClient, alertEventId: string, eventType: AlertDeliveryEvent) {
  const alert = await prisma.alertEvent.findUnique({
    where: { id: alertEventId },
    include: {
      node: { include: { project: true } },
      rule: { include: { project: true } },
    },
  })
  const project = alert?.node?.project ?? alert?.rule?.project
  if (!alert || !project) return []

  const [memberships, webhooks, slackDestinations] = await Promise.all([
    eventType === "alert.opened"
      ? prisma.membership.findMany({
          where: { organizationId: project.organizationId, role: { in: ["OWNER", "ADMIN", "MEMBER"] } },
          include: { user: { include: { notifications: true } } },
        })
      : Promise.resolve([]),
    prisma.projectWebhookDestination.findMany({ where: { projectId: project.id, enabled: true } }),
    prisma.projectSlackDestination.findMany({ where: { projectId: project.id, enabled: true } }),
  ])

  const jobs: { id: string; generation: number }[] = []
  if (eventType === "alert.opened") {
    const recipients = Array.from(new Set(memberships.flatMap((membership) => {
      const email = membership.user.email?.trim().toLowerCase()
      if (!email) return []
      const preference = membership.user.notifications.find((item) => item.channel === "email")
      const isAllowed = preference
        ? preference.enabled && emailSeverityAllows(preference.severity, alert.severity)
        : emailSeverityAllows("WARNING", alert.severity)
      return isAllowed ? [email] : []
    })))
    for (const recipient of recipients) {
      jobs.push(await createNotificationJob(prisma, {
        channel: "email",
        eventType,
        recipient,
        provider: "resend",
        projectId: project.id,
        alertEventId,
        idempotencyKey: `${eventType}:${alertEventId}:email:${recipient}`,
      }))
    }
  }

  for (const destination of webhooks.filter((item) => normalizeWebhookEvents(item.eventFilters).includes(eventType))) {
    jobs.push(await createNotificationJob(prisma, {
      channel: "webhook",
      eventType,
      recipient: getWebhookRecipient(destination),
      provider: "webhook",
      projectId: project.id,
      alertEventId,
      destinationId: destination.id,
      idempotencyKey: `${eventType}:${alertEventId}:webhook:${destination.id}`,
    }))
  }

  for (const destination of slackDestinations
    .filter((item) => normalizeSlackEvents(item.eventFilters).includes(eventType))
    .filter((item) => slackSeverityAllows(item.minimumSeverity, alert.severity))) {
    jobs.push(await createNotificationJob(prisma, {
      channel: "slack",
      eventType,
      recipient: destination.name,
      provider: "slack-incoming-webhook",
      projectId: project.id,
      alertEventId,
      destinationId: destination.id,
      idempotencyKey: `${eventType}:${alertEventId}:slack:${destination.id}`,
    }))
  }

  return jobs
}

/** Creates one test-email job for the authenticated operator. */
export async function queueTestEmailJob(prisma: DatabaseClient, input: { projectId: string; recipient: string }) {
  const nonce = randomUUID()
  return createNotificationJob(prisma, {
    channel: "email",
    eventType: "email.test",
    recipient: input.recipient.trim().toLowerCase(),
    provider: "resend",
    projectId: input.projectId,
    idempotencyKey: `email.test:${input.projectId}:${nonce}`,
  })
}

/** Creates one generic-webhook test job. */
export async function queueTestWebhookJob(prisma: DatabaseClient, input: { projectId: string; destinationId: string; recipient: string }) {
  return createNotificationJob(prisma, {
    channel: "webhook",
    eventType: "webhook.test",
    recipient: input.recipient,
    provider: "webhook",
    projectId: input.projectId,
    destinationId: input.destinationId,
    idempotencyKey: `webhook.test:${input.projectId}:${input.destinationId}:${randomUUID()}`,
  })
}

/** Creates one Slack test job. */
export async function queueTestSlackJob(prisma: DatabaseClient, input: { projectId: string; destinationId: string; recipient: string }) {
  return createNotificationJob(prisma, {
    channel: "slack",
    eventType: "slack.test",
    recipient: input.recipient,
    provider: "slack-incoming-webhook",
    projectId: input.projectId,
    destinationId: input.destinationId,
    idempotencyKey: `slack.test:${input.projectId}:${input.destinationId}:${randomUUID()}`,
  })
}

/** Publishes queued job identifiers without failing the database transaction that created them. */
export async function dispatchNotificationJobs(jobs: { id: string; generation: number }[]) {
  if (!jobs.length) return { dispatched: 0 }
  try {
    await inngest.send(jobs.map((job) => ({
      id: `notification-job-${job.id}-${job.generation}`,
      name: "meridian/notification.process",
      data: { jobId: job.id, generation: job.generation },
    })))
    return { dispatched: jobs.length }
  } catch (error) {
    logServerError("notification_jobs.dispatch_failed", error, { component: "inngest", jobCount: jobs.length })
    return { dispatched: 0 }
  }
}

function getEmailContent(job: NotificationJob & { project: { name: string }; alertEvent: ({ title: string; message: string; severity: AlertSeverity; node: { label: string } | null } | null) }) {
  if (job.eventType === "email.test") {
    return {
      subject: "[Meridian] Test alert email",
      text: ["Meridian test alert email", "", "This confirms that the durable email notification path can reach your account.", "", `Project: ${job.project.name}`].join("\n"),
    }
  }
  if (!job.alertEvent) return null
  return {
    subject: `[Meridian] ${job.alertEvent.severity}: ${job.alertEvent.title}`,
    text: [job.alertEvent.title, "", job.alertEvent.message, "", `Project: ${job.project.name}`, `Node: ${job.alertEvent.node?.label ?? "Project"}`, `Severity: ${job.alertEvent.severity}`].join("\n"),
  }
}

async function finishNotificationJob(jobId: string, status: "SENT" | "SKIPPED", outcome: { providerId?: string; reason?: string }) {
  const prisma = getPrisma()
  const now = new Date()
  await prisma.$transaction([
    prisma.notificationJob.update({ where: { id: jobId }, data: { status, lockedAt: null, lastError: outcome.reason, completedAt: now } }),
    prisma.alertNotificationDelivery.updateMany({
      where: { notificationJobId: jobId },
      data: { status, providerId: outcome.providerId, failureReason: outcome.reason, attemptedAt: now, sentAt: status === "SENT" ? now : null },
    }),
  ])
}

/** Claims and performs one provider attempt for an Inngest notification event. */
export async function executeNotificationJobAttempt(jobId: string, generation: number) {
  const prisma = getPrisma()
  const claimed = await prisma.notificationJob.updateMany({
    where: { id: jobId, generation, status: { in: ACTIVE_JOB_STATUSES } },
    data: { status: "RUNNING", lockedAt: new Date(), attemptCount: { increment: 1 }, lastError: null },
  })
  if (claimed.count === 0) {
    const existing = await prisma.notificationJob.findUnique({ where: { id: jobId }, select: { status: true } })
    return { status: existing?.status ?? "MISSING" }
  }

  const job = await prisma.notificationJob.findUnique({
    where: { id: jobId },
    include: { project: { select: { name: true } }, alertEvent: { include: { node: { select: { label: true } } } } },
  })
  if (!job) return { status: "MISSING" }

  try {
    let attemptResult: { skipped: boolean; providerId?: string; reason?: string }
    if (job.channel === "email") {
      const content = getEmailContent(job)
      attemptResult = !job.recipient || !content
        ? { skipped: true, reason: "Email source data is unavailable." }
        : await sendEmailAttempt({ recipient: job.recipient, ...content, idempotencyKey: job.idempotencyKey })
    } else if (job.channel === "webhook" && job.destinationId) {
      attemptResult = await sendWebhookAttempt(prisma, {
        jobId: job.id,
        projectId: job.projectId,
        destinationId: job.destinationId,
        alertEventId: job.alertEventId ?? undefined,
        eventType: job.eventType as "alert.opened" | "alert.resolved" | "webhook.test",
      })
    } else if (job.channel === "slack" && job.destinationId) {
      attemptResult = await sendSlackAttempt(prisma, {
        jobId: job.id,
        projectId: job.projectId,
        destinationId: job.destinationId,
        alertEventId: job.alertEventId ?? undefined,
        eventType: job.eventType as "alert.opened" | "alert.resolved" | "slack.test",
      })
    } else {
      attemptResult = { skipped: true, reason: "Notification destination is unavailable." }
    }

    await finishNotificationJob(job.id, attemptResult.skipped ? "SKIPPED" : "SENT", attemptResult)
    return { status: attemptResult.skipped ? "SKIPPED" : "SENT" }
  } catch (error) {
    const failureReason = sanitizeFailure(error)
    await prisma.$transaction([
      prisma.notificationJob.update({ where: { id: job.id }, data: { status: "RETRYING", lockedAt: null, lastError: failureReason } }),
      prisma.alertNotificationDelivery.updateMany({ where: { notificationJobId: job.id }, data: { status: "RETRYING", failureReason, attemptedAt: new Date() } }),
    ])
    throw error
  }
}

/** Marks a job terminal after Inngest exhausts all retries. */
export async function markNotificationJobFailed(jobId: string, generation: number, error: unknown) {
  const prisma = getPrisma()
  const failureReason = sanitizeFailure(error)
  await prisma.$transaction([
    prisma.notificationJob.updateMany({
      where: { id: jobId, generation, status: { in: ["QUEUED", "RUNNING", "RETRYING"] } },
      data: { status: "FAILED", lockedAt: null, lastError: failureReason, completedAt: new Date() },
    }),
    prisma.alertNotificationDelivery.updateMany({
      where: { notificationJobId: jobId, status: { in: ["QUEUED", "RUNNING", "RETRYING"] } },
      data: { status: "FAILED", failureReason, attemptedAt: new Date() },
    }),
  ])
}

/** Recovers publish failures and stale locks, and prunes old terminal job state. */
export async function recoverNotificationJobs() {
  const prisma = getPrisma()
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS)
  await prisma.notificationJob.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: staleBefore } },
    data: { status: "RETRYING", generation: { increment: 1 }, lockedAt: null, lastError: "Recovered after a stale worker lock." },
  })
  const jobs = await prisma.notificationJob.findMany({
    where: { status: { in: ACTIVE_JOB_STATUSES } },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, generation: true },
  })
  await dispatchNotificationJobs(jobs)
  await prisma.notificationJob.deleteMany({
    where: { status: { in: TERMINAL_JOB_STATUSES }, completedAt: { lt: new Date(Date.now() - TERMINAL_RETENTION_MS) } },
  })
  return { recovered: jobs.length }
}

/** Returns a secret-safe job representation for authenticated project operators. */
export function serializeNotificationJob(job: NotificationJob) {
  return {
    id: job.id,
    channel: job.channel,
    eventType: job.eventType,
    status: job.status,
    recipient: job.recipient,
    alertEventId: job.alertEventId,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    lastError: job.lastError,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  }
}
