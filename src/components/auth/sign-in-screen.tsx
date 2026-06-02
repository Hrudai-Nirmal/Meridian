"use client"

import { signIn } from "next-auth/react"
import { GitBranch, Network } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function SignInScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Network className="size-6" />
          </div>
          <CardTitle>Sign in to ArgusGrid</CardTitle>
          <CardDescription>Use GitHub to enter your private AI workflow monitoring workspace.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={() => signIn("github", { callbackUrl: "/" })}>
            <GitBranch data-icon="inline-start" />
            Continue with GitHub
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            First sign-in automatically creates your personal organization and seeds the Support Automation Grid demo project.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
