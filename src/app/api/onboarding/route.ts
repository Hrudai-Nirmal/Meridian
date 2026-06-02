import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId } from "@/lib/api-session"
import { getPrisma } from "@/lib/prisma"
import { createBlankProject, createSeedProject, getOnboardingState, slugify } from "@/lib/workspace"

const onboardingSchema = z.object({
  organizationName: z.string().min(2).max(80),
  projectName: z.string().min(2).max(80),
  mode: z.enum(["demo", "blank"]),
})

export async function POST(request: Request) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const parsed = onboardingSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()
  const state = await getOnboardingState(userId)

  if (!state) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 })
  }

  const organization = await prisma.organization.update({
    where: { id: state.organization.id },
    data: {
      name: parsed.data.organizationName,
      slug: `${slugify(parsed.data.organizationName)}-${state.organization.id.slice(-5)}`,
      onboardingCompleted: true,
    },
  })

  if (!state.hasProjects) {
    if (parsed.data.mode === "demo") {
      await createSeedProject(organization.id, parsed.data.projectName)
    } else {
      await createBlankProject(organization.id, parsed.data.projectName)
    }
  }

  return NextResponse.json({ ok: true })
}
