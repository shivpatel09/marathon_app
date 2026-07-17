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
      // read_all is needed to pull private/followers-only activities too.
      // approval_prompt=force always shows Strava's consent screen so users
      // can (re)grant the activity permission — Strava lets them uncheck it,
      // which leaves a read-only token that 401s on the activities endpoint.
      authorization: { params: { scope: "read,activity:read_all", approval_prompt: "force" } },
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
  events: {
    // Auth.js only stores account tokens on the FIRST link; on re-authorization
    // it leaves the old tokens/scope in place. Refresh them here so a user who
    // reconnects (e.g. to grant the activity permission they'd unchecked) gets
    // their new scope + tokens persisted, instead of keeping the stale ones.
    async signIn({ account }) {
      if (!account) return;
      try {
        await prisma.account.updateMany({
          where: { provider: account.provider, providerAccountId: account.providerAccountId },
          data: {
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: typeof account.expires_at === "number" ? account.expires_at : undefined,
            token_type: account.token_type,
            scope: account.scope,
          },
        });
      } catch (err) {
        console.error("failed to persist refreshed Strava account tokens", err);
      }
    },
  },
});
