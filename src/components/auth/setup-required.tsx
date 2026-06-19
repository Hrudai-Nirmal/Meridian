import { AlertTriangle, Database, GitBranch, KeyRound, Network } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function SetupRequired({
  databaseReady,
  githubReady,
}: {
  databaseReady: boolean
  githubReady: boolean
}) {
  const items = [
    { label: "DATABASE_URL", ready: databaseReady, icon: Database },
    { label: "GITHUB_ID", ready: githubReady, icon: GitBranch },
    { label: "GITHUB_SECRET", ready: githubReady, icon: KeyRound },
    { label: "NEXTAUTH_SECRET", ready: Boolean(process.env.NEXTAUTH_SECRET), icon: KeyRound },
  ]

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Network className="size-6" />
          </div>
          <CardTitle>Connect Meridian to Neon and GitHub</CardTitle>
          <CardDescription>
            The app is ready for real persistence, but the required environment variables are not configured in this runtime.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {items.map((item) => {
            const Icon = item.icon

            return (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="size-4" />
                  {item.label}
                </span>
                <Badge variant={item.ready ? "secondary" : "destructive"}>{item.ready ? "Configured" : "Missing"}</Badge>
              </div>
            )
          })}
          <div className="mt-2 flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Add these values in Vercel or `.env.local`, then run Prisma migrations and the seed command from the README.
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
