/**
 * Durable Inngest workers for notification delivery and outbox recovery.
 */
import "server-only"

import { inngest } from "@/inngest/client"
import { executeNotificationJobAttempt, markNotificationJobFailed, recoverNotificationJobs } from "@/lib/notification-jobs"

export const processNotificationJob = inngest.createFunction(
  {
    id: "process-notification-job",
    triggers: { event: "meridian/notification.process" },
    retries: 4,
    concurrency: { limit: 20 },
    onFailure: async ({ event, error }) => {
      const failedEvent = event.data.event as { data?: { jobId?: string; generation?: number } }
      if (failedEvent.data?.jobId && typeof failedEvent.data.generation === "number") {
        await markNotificationJobFailed(failedEvent.data.jobId, failedEvent.data.generation, error)
      }
    },
  },
  async ({ event, step }) => {
    return step.run("deliver-notification", () => executeNotificationJobAttempt(event.data.jobId as string, event.data.generation as number))
  }
)

export const recoverQueuedNotifications = inngest.createFunction(
  {
    id: "recover-queued-notifications",
    triggers: { cron: "* * * * *" },
    retries: 2,
  },
  async ({ step }) => step.run("recover-notification-outbox", recoverNotificationJobs)
)
