import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken, fetchActivitiesSince, isRun } from "@/lib/strava";

const EIGHT_WEEKS_SECONDS = 8 * 7 * 24 * 3600;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const token = await getValidAccessToken(userId);
    const after = Math.floor(Date.now() / 1000) - EIGHT_WEEKS_SECONDS;
    const activities = await fetchActivitiesSince(token, after);

    let synced = 0;
    for (const a of activities) {
      if (!isRun(a)) continue;
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
      synced++;
    }

    return NextResponse.json({ synced });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
