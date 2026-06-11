import "server-only"

import type { PrismaClient } from "@prisma/client"

type AlertEmailInput = {
  nodeId: string
  title: string
  message: string
  severity: string
}

export async function notifyNewAlert(prisma: PrismaClient, alert: AlertEmailInput) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.ALERT_FROM_EMAIL

  const node = await prisma.endpointNode.findUnique({
    where: { id: alert.nodeId },
    include: {
      project: {
        include: {
          organization: {
            include: {
              memberships: {
                where: { role: { in: ["OWNER", "ADMIN", "MEMBER"] } },
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
    .map((membership) => membership.user)
    .filter((user) => {
      if (!user.email) return false
      const emailPreference = user.notifications.find((preference) => preference.channel === "email")
      return emailPreference ? emailPreference.enabled : true
    })
    .map((user) => user.email as string)

  if (!recipients.length) return

  if (!apiKey || !from) {
    console.info(`[ArgusGrid alert email skipped] ${alert.severity}: ${alert.title} -> ${recipients.join(", ")}`)
    return
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
      subject: `[ArgusGrid] ${alert.severity}: ${alert.title}`,
      text: [
        `${alert.title}`,
        "",
        alert.message,
        "",
        `Project: ${node.project.name}`,
        `Node: ${node.label}`,
        `Severity: ${alert.severity}`,
      ].join("\n"),
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    console.warn(`[ArgusGrid alert email failed] ${response.status} ${body.slice(0, 240)}`)
  }
}
