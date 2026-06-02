import { ArgusGridDashboard } from "@/components/argusgrid/dashboard";
import { OnboardingScreen } from "@/components/auth/onboarding-screen";
import { SignInScreen } from "@/components/auth/sign-in-screen";
import { SetupRequired } from "@/components/auth/setup-required";
import { authOptions, hasGithubAuthConfig } from "@/lib/auth";
import { hasDatabaseConfig } from "@/lib/prisma";
import { ensureWorkspaceForUser, getOnboardingState, getWorkspaceForUser } from "@/lib/workspace";
import { getServerSession } from "next-auth";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ project?: string }>;
}) {
  const databaseReady = hasDatabaseConfig();
  const githubReady = hasGithubAuthConfig();

  if (!databaseReady || !githubReady || !process.env.NEXTAUTH_SECRET) {
    return <SetupRequired databaseReady={databaseReady} githubReady={githubReady} />;
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return <SignInScreen />;
  }

  await ensureWorkspaceForUser(session.user);
  const params = await searchParams;
  const workspace = await getWorkspaceForUser(session.user.id, params?.project);

  if (!workspace) {
    const onboarding = await getOnboardingState(session.user.id);
    if (onboarding) {
      return <OnboardingScreen organizationName={onboarding.organization.name} />;
    }

    return <SetupRequired databaseReady={databaseReady} githubReady={githubReady} />;
  }

  return <ArgusGridDashboard initialWorkspace={workspace} currentUser={session.user} />;
}
