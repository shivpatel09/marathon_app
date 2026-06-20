import { prisma } from "@/lib/prisma";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API = "https://www.strava.com/api/v3";

/**
 * Returns a valid Strava access token for the user, refreshing it via the
 * stored refresh_token if the current one has expired (Strava tokens last ~6h).
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "strava" },
  });
  if (!account || !account.refresh_token) {
    throw new Error("No Strava account linked for this user");
  }

  const now = Math.floor(Date.now() / 1000);
  if (account.access_token && account.expires_at && account.expires_at - 60 > now) {
    return account.access_token;
  }

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };

  await prisma.account.update({
    where: {
      provider_providerAccountId: {
        provider: "strava",
        providerAccountId: account.providerAccountId,
      },
    },
    data: {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    },
  });

  return data.access_token;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  average_speed: number; // m/s
  average_heartrate?: number;
  total_elevation_gain: number; // meters
}

/**
 * Pages through the athlete's activities created after `afterEpoch` (unix seconds).
 */
export async function fetchActivitiesSince(
  token: string,
  afterEpoch: number,
): Promise<StravaActivity[]> {
  const out: StravaActivity[] = [];
  let page = 1;
  const perPage = 100;

  // hard cap on pages as a safety valve against runaway loops
  while (page <= 20) {
    const url = `${STRAVA_API}/athlete/activities?after=${afterEpoch}&per_page=${perPage}&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      throw new Error(`Strava activities fetch failed: ${res.status} ${await res.text()}`);
    }
    const batch = (await res.json()) as StravaActivity[];
    out.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }
  return out;
}

export function isRun(a: StravaActivity): boolean {
  const t = `${a.sport_type ?? ""}${a.type ?? ""}`.toLowerCase();
  return t.includes("run");
}

/** Fetch a single activity by id (used by the webhook). */
export async function fetchActivity(token: string, id: number | string): Promise<StravaActivity> {
  const res = await fetch(`${STRAVA_API}/activities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Strava activity fetch failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as StravaActivity;
}

/** Upsert one Strava activity into the DB. Shared by manual sync + webhook. */
export async function upsertActivity(userId: string, a: StravaActivity): Promise<void> {
  await prisma.activity.upsert({
    where: { id: String(a.id) },
    create: {
      id: String(a.id),
      userId,
      name: a.name,
      type: a.sport_type ?? a.type,
      startDate: new Date(a.start_date),
      distanceM: a.distance,
      movingTime: a.moving_time,
      elapsedTime: a.elapsed_time,
      avgSpeed: a.average_speed ?? null,
      avgHr: a.average_heartrate ?? null,
      totalElevation: a.total_elevation_gain ?? null,
      raw: a as unknown as object,
    },
    update: {
      name: a.name,
      distanceM: a.distance,
      movingTime: a.moving_time,
      avgSpeed: a.average_speed ?? null,
      avgHr: a.average_heartrate ?? null,
    },
  });
}

/** Resolve a Strava athlete id (owner_id from a webhook event) to our user id. */
export async function userIdForAthlete(athleteId: number | string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { provider: "strava", providerAccountId: String(athleteId) },
    select: { userId: true },
  });
  return account?.userId ?? null;
}
