/**
 * Resend configuration and single-attempt email delivery for durable jobs.
 */
import "server-only"

import { canUseExternalSideEffects } from "@/lib/runtime-environment"

type SendEmailAttemptInput = {
  recipient: string
  subject: string
  text: string
  idempotencyKey: string
}

export type NotificationAttemptResult = {
  skipped: boolean
  providerId?: string
  reason?: string
}

/** Returns whether the Resend provider has the required server credentials. */
export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL)
}

/** Performs one idempotent Resend attempt; retry orchestration belongs to Inngest. */
export async function sendEmailAttempt(input: SendEmailAttemptInput): Promise<NotificationAttemptResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.ALERT_FROM_EMAIL
  const recipient = input.recipient.trim().toLowerCase()

  if (!recipient) return { skipped: true, reason: "Email recipient is missing." }
  if (!apiKey || !from) return { skipped: true, reason: "Email provider is not configured." }
  if (!canUseExternalSideEffects()) return { skipped: true, reason: "Email delivery is disabled in this runtime." }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: input.subject,
      text: input.text,
    }),
  })
  const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null

  if (!response.ok) {
    throw new Error(payload?.message ?? `Resend returned HTTP ${response.status}.`)
  }

  return { skipped: false, providerId: payload?.id }
}
