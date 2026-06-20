import NextAuth from "next-auth";
import Strava from "next-auth/providers/strava";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: { strategy: "database" },
  providers: [
    Strava({
      clientId: process.env.STRAVA_CLIENT_ID,
      clientSecret: process.env.STRAVA_CLIENT_SECRET,
      // read_all is needed to pull private/followers-only activities too
      authorization: { params: { scope: "read,activity:read_all" } },
      // Strava returns the athlete id as a number; the adapter expects a string
      profile(profile) {
        return {
          id: String(profile.id),
          name: [profile.firstname, profile.lastname].filter(Boolean).join(" ") || null,
          email: null,
          image: profile.profile ?? null,
        };
      },
    }),
  ],
  callbacks: {
    // database sessions: expose the user id on the session object
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
