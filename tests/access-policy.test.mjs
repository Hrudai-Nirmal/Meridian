import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

import {
  ENTERPRISE_ROLE_CAPABILITIES,
  getRoleCapabilityRows,
  getRoleLabel,
} from "../src/lib/access-policy.mjs"

test("enterprise role capability ids stay stable", () => {
  assert.deepEqual(
    ENTERPRISE_ROLE_CAPABILITIES.map((capability) => capability.id),
    [
      "viewWorkspace",
      "editMap",
      "manageIntegrations",
      "manageAlerts",
      "manageReports",
      "exportEvidence",
      "inspectLogs",
      "manageNotificationJobs",
      "manageTeam",
      "manageProjects",
    ]
  )
})

test("role capability rows expose expected enterprise pilot boundaries", () => {
  const rows = getRoleCapabilityRows()
  const byId = new Map(rows.map((row) => [row.id, row]))

  assert.deepEqual(byId.get("viewWorkspace")?.roles, {
    OWNER: true,
    ADMIN: true,
    MEMBER: true,
    VIEWER: true,
  })
  assert.equal(byId.get("editMap")?.roles.MEMBER, true)
  assert.equal(byId.get("manageIntegrations")?.roles.MEMBER, false)
  assert.equal(byId.get("exportEvidence")?.roles.VIEWER, false)
  assert.equal(byId.get("manageTeam")?.roles.ADMIN, true)
  assert.equal(byId.get("manageTeam")?.roles.MEMBER, false)
})

test("role labels are client readable", () => {
  assert.equal(getRoleLabel("OWNER"), "Owner")
  assert.equal(getRoleLabel("ADMIN"), "Admin")
  assert.equal(getRoleLabel("MEMBER"), "Member")
  assert.equal(getRoleLabel("VIEWER"), "Viewer")
})

test("access policy copy remains secret-safe", () => {
  const serialized = JSON.stringify(ENTERPRISE_ROLE_CAPABILITIES)

  assert.doesNotMatch(serialized, /sk-[a-z0-9]|password|authorization|bearer\s+[a-z0-9._~-]+|hooks\.slack\.com|npg_/i)
})

test("team UI renders role matrix and project access review", async () => {
  const source = await readFile("src/components/meridian/dashboard.tsx", "utf8")

  assert.match(source, /Role Capability Matrix/)
  assert.match(source, /Project Access Review/)
  assert.match(source, /getRoleCapabilityRows/)
})

test("team invite routes handle duplicate invites and accepted invite audit evidence", async () => {
  const membersRoute = await readFile("src/app/api/organization/members/route.ts", "utf8")
  const workspaceSource = await readFile("src/lib/workspace.ts", "utf8")

  assert.match(membersRoute, /team\.invite_duplicate/)
  assert.match(membersRoute, /findFirst\(\{\s*where:\s*\{[\s\S]*status:\s*"PENDING"/)
  assert.match(workspaceSource, /team\.invite_accepted/)
})

test("integration management routes require owner or admin project roles", async () => {
  const routeFiles = [
    "src/app/api/projects/[projectId]/webhooks/route.ts",
    "src/app/api/projects/[projectId]/webhooks/[webhookId]/route.ts",
    "src/app/api/projects/[projectId]/slack/route.ts",
    "src/app/api/projects/[projectId]/slack/[slackId]/route.ts",
  ]

  for (const routeFile of routeFiles) {
    const source = await readFile(routeFile, "utf8")
    assert.match(source, /requireProjectRole\(userId,\s*projectId,\s*\["OWNER",\s*"ADMIN"\]\)/, routeFile)
  }
})
