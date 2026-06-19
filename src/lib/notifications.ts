import "server-only"

import type { MembershipRole, PrismaClient } from "@prisma/client"

type AlertEmailInput = {
  alertEventId?: string
  nodeId: string
  title: string
  message: string
  severity: string
}

type SendEmailInput = {
  to: string[]
  subject: string
  text: string
  alertEventId?: string
}

const severityRank = {
  INFO: 0,
  WARNING: 1,
  CRITICAL: 2,
}

function roleAllowsDefaultEmail(role: MembershipRole) {
  return role === "OWNER" || role === "ADMIN" || role === "MEMBER"
}

function severityAllows(preferenceSeverity: string, alertSeverity: string) {
  const minimum = severityRank[preferenceSeverity as keyof typeof severityRank] ?? severityRank.WARNING
  const current = severityRank[alertSeverity as keyof typeof severityRank] ?? severityRank.WARNING
  return current >= minimum
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL)
}

export async function sendEmailWithDeliveryLog(prisma: PrismaClient, input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.ALERT_FROM_EMAIL
  const recipients = Array.from(new Set(input.to.map((recipient) => recipient.toLowerCase()).filter(Boolean)))

  if (!recipients.length) {
    return { attempted: 0, sent: 0, failed: 0, skipped: 0 }
  }

  if (!apiKey || !from) {
    await prisma.alertNotificationDelivery.createMany({
      data: recipients.map((recipient) => ({
        channel: "email",
        recipient,
        status: "SKIPPED",
        provider: "resend",
        failureReason: "Email provider is not configured.",
        alertEventId: input.alertEventId,
      })),
    })
    return { attempted: recipients.length, sent: 0, failed: 0, skipped: recipients.length }
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: input.subject,
      text: input.text,
    }),
  })

  const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null
  const status = response.ok ? "SENT" : "FAILED"
  const now = new Date()

  await prisma.alertNotificationDelivery.createMany({
    data: recipients.map((recipient) => ({
      channel: "email",
      recipient,
      status,
      provider: "resend",
      providerId: response.ok ? payload?.id : undefined,
      failureReason: response.ok ? undefined : payload?.message ?? `Resend returned HTTP ${response.status}.`,
      alertEventId: input.alertEventId,
      attemptedAt: now,
      sentAt: response.ok ? now : undefined,
    })),
  })

  return {
    attempted: recipients.length,
    sent: response.ok ? recipients.length : 0,
    failed: response.ok ? 0 : recipients.length,
    skipped: 0,
    providerId: payload?.id,
    error: response.ok ? undefined : payload?.message ?? `Resend returned HTTP ${response.status}.`,
  }
}

export async function notifyNewAlert(prisma: PrismaClient, alert: AlertEmailInput) {
  const node = await prisma.endpointNode.findUnique({
    where: { id: alert.nodeId },
    include: {
      project: {
        include: {
          organization: {
            include: {
              memberships: {
                include: {
                  user: {
                    include: {
                      notifications: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!node) return

  const recipients = node.project.organization.memberships
    .filter((membership) => roleAllowsDefaultEmail(membership.role))
    .filter((membership) => {
      const user = membership.user
      if (!user.email) return false
      const emailPreference = user.notifications.find((preference) => preference.channel === "email")
      if (emailPreference) return emailPreference.enabled && severityAllows(emailPreference.severity, alert.severity)
      return severityAllows("WARNING", alert.severity)
    })
    .map((membership) => membership.user.email as string)

  if (!recipients.length) return

  return sendEmailWithDeliveryLog(prisma, {
    to: recipients,
    subject: `[Meridian] ${alert.severity}: ${alert.title}`,
    text: [
        `${alert.title}`,
        "",
        alert.message,
        "",
        `Project: ${node.project.name}`,
        `Node: ${node.label}`,
        `Severity: ${alert.severity}`,
    ].join("\n"),
    alertEventId: alert.alertEventId,
  })
}
