import { ArgusGridDashboard } from "@/components/argusgrid/dashboard";
import { SignInScreen } from "@/components/auth/sign-in-screen";
import { SetupRequired } from "@/components/auth/setup-required";
import { authOptions, hasGithubAuthConfig } from "@/lib/auth";
import { hasDatabaseConfig } from "@/lib/prisma";
import { ensureWorkspaceForUser } from "@/lib/workspace";
import { getServerSession } from "next-auth";

export default async function Home() {
  const databaseReady = hasDatabaseConfig();
  const githubReady = hasGithubAuthConfig();

  if (!databaseReady || !githubReady || !process.env.NEXTAUTH_SECRET) {
    return <SetupRequired databaseReady={databaseReady} githubReady={githubReady} />;
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return <SignInScreen />;
  }

  const workspace = await ensureWorkspaceForUser(session.user);

  if (!workspace) {
    return <SetupRequired databaseReady={databaseReady} githubReady={githubReady} />;
  }

  return <ArgusGridDashboard initialWorkspace={workspace} currentUser={session.user} />;
}
