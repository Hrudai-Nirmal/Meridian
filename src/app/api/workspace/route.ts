import { NextResponse } from "next/server"

import { getApiUserId } from "@/lib/api-session"
import { ensureWorkspaceForUser } from "@/lib/workspace"

export async function GET() {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const workspace = await ensureWorkspaceForUser({ id: userId })

  if (!workspace) {
    return NextResponse.json({ error: "Workspace could not be created." }, { status: 500 })
  }

  return NextResponse.json(workspace)
}
