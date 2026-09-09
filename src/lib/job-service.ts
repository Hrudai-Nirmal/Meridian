/**
 * Runtime job backend selection and dispatch.
 */
import "server-only"

import type { Prisma, PrismaClient } from "@prisma/client"

import { inngest } from "@/inngest/client"
import { getPrisma } from "@/lib/prisma"
import { logServerError } from "@/lib/server-logging"

export const MERIDIAN_JOB_BACKENDS = ["inngest", "self_hosted", "manual"] as const
export type MeridianJobBackend = typeof MERIDIAN_JOB_BACKENDS[number]

type DatabaseClient = PrismaClient | Prisma.TransactionClient
type NotificationJobReference = { id: string; generation: number }
type RuntimeJobSettings = {
  jobBackend: MeridianJobBackend
  selfHostedWorkerUrl: string | null
}

const DEFAULT_RUNTIME_SETTINGS_ID = "default"
const NOTIFICATION_WORKER_PATH = "/v1/jobs/notification"

function isMeridianJobBackend(value: string | undefined | null): value is MeridianJobBackend {
  return Boolean(value && MERIDIAN_JOB_BACKENDS.includes(value as MeridianJobBackend))
}

function getDefaultJobBackend() {
  const configuredBackend = process.env.MERIDIAN_JOB_BACKEND || process.env.MERIDIAN_DEFAULT_JOB_BACKEND
  return isMeridianJobBackend(configuredBackend) ? configuredBackend : "inngest"
}

function getWorkerNotificationUrl(workerUrl: string) {
  return new URL(NOTIFICATION_WORKER_PATH, workerUrl).toString()
}

/**
 * Reads runtime-level job settings, falling back to deploy-time defaults when no row exists yet.
 */
export async function getRuntimeJobSettings(prisma: DatabaseClient = getPrisma()): Promise<RuntimeJobSettings> {
  const settings = await prisma.runtimeSetting.findUnique({
    where: { id: DEFAULT_RUNTIME_SETTINGS_ID },
    select: {
      jobBackend: true,
      selfHostedWorkerUrl: true,
    },
  })

  if (!settings) {
    return {
      jobBackend: getDefaultJobBackend(),
      selfHostedWorkerUrl: process.env.MERIDIAN_SELF_HOSTED_WORKER_URL ?? null,
    }
  }

  return {
    jobBackend: isMeridianJobBackend(settings.jobBackend) ? settings.jobBackend : getDefaultJobBackend(),
    selfHostedWorkerUrl: settings.selfHostedWorkerUrl || process.env.MERIDIAN_SELF_HOSTED_WORKER_URL || null,
  }
}

async function dispatchNotificationJobsToInngest(jobs: NotificationJobReference[]) {
  await inngest.send(jobs.map((job) => ({
    id: `notification-job-${job.id}-${job.generation}`,
    name: "meridian/notification.process",
    data: { jobId: job.id, generation: job.generation },
  })))

  return { dispatched: jobs.length, backend: "inngest" as const }
}

async function dispatchNotificationJobsToSelfHosted(jobs: NotificationJobReference[], settings: RuntimeJobSettings) {
  const workerUrl = settings.selfHostedWorkerUrl || process.env.MERIDIAN_SELF_HOSTED_WORKER_URL
  const workerSecret = process.env.MERIDIAN_SELF_HOSTED_WORKER_SECRET

  if (!workerUrl || !workerSecret) {
    logServerError("notification_jobs.self_hosted_dispatch_unconfigured", new Error("Self-hosted worker dispatch is not configured."), {
      component: "self_hosted_worker",
      jobCount: jobs.length,
    })
    return { dispatched: 0, backend: "self_hosted" as const }
  }

  const notificationUrl = getWorkerNotificationUrl(workerUrl)
  const results = await Promise.allSettled(jobs.map((job) => fetch(notificationUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${workerSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ notificationJobId: job.id, generation: job.generation }),
  })))
  const successfulDispatches = results.filter((result) => result.status === "fulfilled" && result.value.ok).length

  if (successfulDispatches !== jobs.length) {
    logServerError("notification_jobs.self_hosted_dispatch_partial", new Error("One or more self-hosted worker dispatches failed."), {
      component: "self_hosted_worker",
      jobCount: jobs.length,
      dispatched: successfulDispatches,
    })
  }

  return { dispatched: successfulDispatches, backend: "self_hosted" as const }
}

/**
 * Dispatches queued notification job references to the active runtime backend.
 */
export async function dispatchNotificationJobsByBackend(jobs: NotificationJobReference[]) {
  if (!jobs.length) return { dispatched: 0 }

  try {
    const settings = await getRuntimeJobSettings()

    if (settings.jobBackend === "manual") {
      return { dispatched: 0, backend: "manual" as const }
    }

    if (settings.jobBackend === "self_hosted") {
      return dispatchNotificationJobsToSelfHosted(jobs, settings)
    }

    return dispatchNotificationJobsToInngest(jobs)
  } catch (error) {
    logServerError("notification_jobs.dispatch_failed", error, { component: "job_service", jobCount: jobs.length })
    return { dispatched: 0 }
  }
}
