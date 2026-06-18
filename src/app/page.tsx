import { ArgusGridDashboard } from "@/components/argusgrid/dashboard";
import { OnboardingScreen } from "@/components/auth/onboarding-screen";
import { SignInScreen } from "@/components/auth/sign-in-screen";
import { ServiceUnavailable } from "@/components/auth/service-unavailable";
import { SetupRequired } from "@/components/auth/setup-required";
import { authOptions, hasGithubAuthConfig } from "@/lib/auth";
import { hasDatabaseConfig } from "@/lib/prisma";
import { logServerError } from "@/lib/server-logging";
import { ensureWorkspaceForUser, getOnboardingState, getWorkspaceForUser } from "@/lib/workspace";
import { getServerSession } from "next-auth";

export const dynamic = "force-dynamic";

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

  let session;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    const incident = logServerError("page.auth_session_failed", error, { component: "authentication" });
    return <ServiceUnavailable incidentId={incident.incidentId} />;
  }

  if (!session?.user?.id) {
    return <SignInScreen />;
  }

  let workspace;
  let onboarding;
  try {
    await ensureWorkspaceForUser(session.user);
    const params = await searchParams;
    workspace = await getWorkspaceForUser(session.user.id, params?.project);

    if (!workspace) {
      onboarding = await getOnboardingState(session.user.id);
    }
  } catch (error) {
    const incident = logServerError("page.workspace_load_failed", error, { component: "workspace" });
    return <ServiceUnavailable incidentId={incident.incidentId} />;
  }

  if (!workspace) {
    if (onboarding) {
      return <OnboardingScreen organizationName={onboarding.organization.name} />;
    }

    return <SetupRequired databaseReady={databaseReady} githubReady={githubReady} />;
  }

  return <ArgusGridDashboard initialWorkspace={workspace} currentUser={session.user} />;
}
