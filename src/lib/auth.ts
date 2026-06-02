import GitHubProvider from "next-auth/providers/github"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import type { NextAuthOptions } from "next-auth"

import { getPrisma, hasDatabaseConfig } from "@/lib/prisma"

export function hasGithubAuthConfig() {
  return Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET)
}

export const authOptions: NextAuthOptions = {
  adapter: hasDatabaseConfig() ? PrismaAdapter(getPrisma()) : undefined,
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
    }),
  ],
  session: {
    strategy: hasDatabaseConfig() ? "database" : "jwt",
  },
  callbacks: {
    session({ session, user, token }) {
      if (session.user) {
        session.user.id = user?.id ?? token.sub ?? ""
      }

      return session
    },
  },
  pages: {
    signIn: "/",
  },
}
