/**
 * Client-safe role capability copy for enterprise pilot access review.
 */

export const ENTERPRISE_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"]

export const ENTERPRISE_ROLE_CAPABILITIES = [
  {
    id: "viewWorkspace",
    label: "View workspace",
    description: "Open projects, dashboards, maps, runs, alerts, reports, logs, and safe evidence.",
    roles: { OWNER: true, ADMIN: true, MEMBER: true, VIEWER: true },
  },
  {
    id: "editMap",
    label: "Edit map and nodes",
    description: "Move nodes, edit workflow links, update node labels, and save API metric setup.",
    roles: { OWNER: true, ADMIN: true, MEMBER: true, VIEWER: false },
  },
  {
    id: "manageIntegrations",
    label: "Manage integrations",
    description: "Create telemetry tokens, webhooks, Slack destinations, and provider setup tests.",
    roles: { OWNER: true, ADMIN: true, MEMBER: false, VIEWER: false },
  },
  {
    id: "manageAlerts",
    label: "Manage alerts",
    description: "Create alert rules, resolve incidents, ignore incidents, and trigger notification tests.",
    roles: { OWNER: true, ADMIN: true, MEMBER: true, VIEWER: false },
  },
  {
    id: "manageReports",
    label: "Manage client proof",
    description: "Create report links, presets, branded report assets, and revoke shared reports.",
    roles: { OWNER: true, ADMIN: true, MEMBER: false, VIEWER: false },
  },
  {
    id: "exportEvidence",
    label: "Export evidence",
    description: "Download bounded runs, metrics, and alerts CSV files.",
    roles: { OWNER: true, ADMIN: true, MEMBER: false, VIEWER: false },
  },
  {
    id: "inspectLogs",
    label: "Inspect logs",
    description: "Read safe operational logs, delivery evidence, and notification job status.",
    roles: { OWNER: true, ADMIN: true, MEMBER: true, VIEWER: true },
  },
  {
    id: "manageNotificationJobs",
    label: "Manage jobs",
    description: "Retry failed notification jobs or cancel queued/retrying notification jobs.",
    roles: { OWNER: true, ADMIN: true, MEMBER: false, VIEWER: false },
  },
  {
    id: "manageTeam",
    label: "Manage team",
    description: "Invite teammates, cancel pending invites, change roles, and remove members.",
    roles: { OWNER: true, ADMIN: true, MEMBER: false, VIEWER: false },
  },
  {
    id: "manageProjects",
    label: "Manage projects",
    description: "Create, rename, archive, and configure shared organization projects.",
    roles: { OWNER: true, ADMIN: true, MEMBER: false, VIEWER: false },
  },
]

const ROLE_LABELS = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
}

/**
 * Returns client-readable role labels.
 */
export function getRoleLabel(role) {
  return ROLE_LABELS[role] ?? String(role)
}

/**
 * Returns a defensive copy of the role capability rows.
 */
export function getRoleCapabilityRows() {
  return ENTERPRISE_ROLE_CAPABILITIES.map((capability) => ({
    ...capability,
    roles: { ...capability.roles },
  }))
}
