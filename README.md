# Marathon trainer — Phase 0

Plan-driven marathon training app. **Phase 0** proves the hardest integration:
sign in with Strava, pull your last 8 weeks of runs, and display them. See
`../marathon-training-app-spec.md` for the full architecture and roadmap.

Stack: Next.js (App Router) + TypeScript · Prisma + Postgres · Auth.js (NextAuth v5).

## What Phase 0 does

- **Sign in with Strava** (OAuth2 — also serves as the account/identity).
- **Sync** the last 8 weeks of running activities into Postgres (with automatic
  token refresh).
- **Display** them in a table with per-run pace + HR and an 8-week mileage summary.

## Prerequisites

- **Node.js 18.18+** (not currently installed on this machine — install from
  https://nodejs.org or via `nvm`/`brew install node`).
- A **Postgres** database. Easiest is a free [Neon](https://neon.tech) or
  [Supabase](https://supabase.com) instance; or local Postgres.
- A **Strava API application**: https://www.strava.com/settings/api
  - Set **Authorization Callback Domain** to `localhost`.
  - Copy the **Client ID** and **Client Secret**.

## Setup

```bash
cd marathon-app
npm install

cp .env.example .env
# then fill in DATABASE_URL, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET
npx auth secret          # writes AUTH_SECRET into .env

npm run db:push          # create the tables in your Postgres
npm run dev              # http://localhost:3000
```

Open http://localhost:3000, click **Connect Strava**, approve access, then
click **Sync from Strava**.

### Strava OAuth callback

Auth.js handles the callback at:

```
http://localhost:3000/api/auth/callback/strava
```

You only need the **callback domain** (`localhost`) set in Strava's settings —
the full path is handled automatically. Requested scope is
`read,activity:read_all`.

## Project layout

```
prisma/schema.prisma            Auth.js models + Activity
src/lib/prisma.ts               Prisma client singleton
src/lib/auth.ts                 NextAuth config (Strava provider)
src/lib/strava.ts               token refresh + activity fetch
src/app/api/auth/[...nextauth]  Auth.js route handlers
src/app/api/sync                POST: pull + upsert last 8 weeks of runs
src/app/page.tsx                dashboard (sign-in or activity list)
src/components/ActivityList.tsx sync button + runs table
```

## Notes & next steps

- Strava access tokens expire ~every 6 hours; `getValidAccessToken()` refreshes
  them on demand using the stored refresh token.
- Sync is currently **manual** (a button). Phase 1+ adds Strava **webhooks** for
  push updates plus a nightly reconciliation job (see spec §8.1).
- Next up (Phase 1): plan templates (Pfitz / Hansons), goal-time pace
  derivation, and generating the dated week view.
```
