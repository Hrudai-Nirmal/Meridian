import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

const handler = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Prototype",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        return {
          id: "prototype-user",
          email: credentials?.email ?? "admin@argusgrid.local",
          name: credentials?.name ?? "ArgusGrid Admin",
        }
      },
    }),
  ],
})

export { handler as GET, handler as POST }
