import { getServerSession } from "next-auth"
import type { MembershipRole } from "@prisma/client"
import { NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { hasDatabaseConfig } from "@/lib/prisma"
import { assertOrganizationRole, assertProjectRole } from "@/lib/workspace"

export async function getApiUserId() {
  if (!hasDatabaseConfig()) {
    return {
      error: NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 }),
      userId: null,
    }
  }

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
      userId: null,
    }
  }

  return { error: null, userId: session.user.id }
}

export async function requireProjectRole(
  userId: string,
  projectId: string,
  allowed: MembershipRole[] = ["OWNER", "ADMIN", "MEMBER"]
) {
  try {
    await assertProjectRole(userId, projectId, allowed)
    return null
  } catch {
    return NextResponse.json({ error: "Project mutation access denied." }, { status: 403 })
  }
}

export async function requireOrganizationRole(userId: string, organizationId: string, allowed: MembershipRole[] = ["OWNER", "ADMIN"]) {
  try {
    await assertOrganizationRole(userId, organizationId, allowed)
    return null
  } catch {
    return NextResponse.json({ error: "Organization access denied." }, { status: 403 })
  }
}
