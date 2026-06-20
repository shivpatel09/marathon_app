import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getValidAccessToken, fetchActivitiesSince, isRun, upsertActivity } from "@/lib/strava";

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
      await upsertActivity(userId, a);
      synced++;
    }

    return NextResponse.json({ synced });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
