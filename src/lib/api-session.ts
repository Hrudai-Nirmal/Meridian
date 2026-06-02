import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { hasDatabaseConfig } from "@/lib/prisma"

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
