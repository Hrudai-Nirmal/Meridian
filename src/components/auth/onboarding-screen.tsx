"use client"

import { useState } from "react"
import { Network } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function OnboardingScreen({
  organizationName,
}: {
  organizationName: string
}) {
  const [orgName, setOrgName] = useState(organizationName)
  const [projectName, setProjectName] = useState("Support Automation Grid")
  const [mode, setMode] = useState<"demo" | "blank">("demo")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    setBusy(true)
    setError("")

    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationName: orgName, projectName, mode }),
    })

    setBusy(false)

    if (!response.ok) {
      setError("Onboarding failed. Check the names and try again.")
      return
    }

    window.location.href = "/"
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Network className="size-6" />
          </div>
          <CardTitle>Set up your ArgusGrid workspace</CardTitle>
          <CardDescription>Confirm your private beta workspace before the first project is created.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Organization name
            <Input value={orgName} onChange={(event) => setOrgName(event.target.value)} />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            First project
            <Input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant={mode === "demo" ? "default" : "outline"} onClick={() => setMode("demo")}>
              Seed demo data
            </Button>
            <Button variant={mode === "blank" ? "default" : "outline"} onClick={() => setMode("blank")}>
              Start blank
            </Button>
          </div>
          {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
          <Button disabled={busy || orgName.length < 2 || projectName.length < 2} onClick={submit}>
            {busy ? "Creating workspace" : "Enter dashboard"}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
