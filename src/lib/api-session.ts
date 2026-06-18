import { getServerSession } from "next-auth"
import type { MembershipRole } from "@prisma/client"
import { NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { getPrisma, hasDatabaseConfig } from "@/lib/prisma"
import { isDatabaseOperationalError, logServerError } from "@/lib/server-logging"
import { assertOrganizationRole, assertProjectRole } from "@/lib/workspace"

/**
 * Returns the authenticated user id or a safe API error response.
 */
export async function getApiUserId() {
  if (!hasDatabaseConfig()) {
    return {
      error: NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 }),
      userId: null,
    }
  }

  let session
  try {
    session = await getServerSession(authOptions)
  } catch (error) {
    const incident = logServerError("api.auth_session_failed", error, { component: "authentication" })
    return {
      error: NextResponse.json({
        error: "Authentication is temporarily unavailable.",
        code: "AUTH_SESSION_UNAVAILABLE",
        incidentId: incident.incidentId,
      }, { status: 503 }),
      userId: null,
    }
  }

  if (!session?.user?.id) {
    try {
      await getPrisma().$queryRaw`SELECT 1`
    } catch (error) {
      const incident = logServerError("api.database_session_check_failed", error, { component: "authentication" })
      return {
        error: NextResponse.json({
          error: "Authentication is temporarily unavailable.",
          code: incident.errorCode,
          incidentId: incident.incidentId,
        }, { status: 503 }),
        userId: null,
      }
    }

    return {
      error: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
      userId: null,
    }
  }

  return { error: null, userId: session.user.id }
}

/**
 * Requires one of the allowed project roles.
 */
export async function requireProjectRole(
  userId: string,
  projectId: string,
  allowed: MembershipRole[] = ["OWNER", "ADMIN", "MEMBER"]
) {
  try {
    await assertProjectRole(userId, projectId, allowed)
    return null
  } catch (error) {
    if (isDatabaseOperationalError(error)) {
      const incident = logServerError("api.project_role_check_failed", error, { component: "authorization", projectId })
      return NextResponse.json({ error: "Authorization is temporarily unavailable.", code: incident.errorCode, incidentId: incident.incidentId }, { status: 503 })
    }
    return NextResponse.json({ error: "Project mutation access denied." }, { status: 403 })
  }
}

/**
 * Requires one of the allowed organization roles.
 */
export async function requireOrganizationRole(userId: string, organizationId: string, allowed: MembershipRole[] = ["OWNER", "ADMIN"]) {
  try {
    await assertOrganizationRole(userId, organizationId, allowed)
    return null
  } catch (error) {
    if (isDatabaseOperationalError(error)) {
      const incident = logServerError("api.organization_role_check_failed", error, { component: "authorization", organizationId })
      return NextResponse.json({ error: "Authorization is temporarily unavailable.", code: incident.errorCode, incidentId: incident.incidentId }, { status: 503 })
    }
    return NextResponse.json({ error: "Organization access denied." }, { status: 403 })
  }
}
