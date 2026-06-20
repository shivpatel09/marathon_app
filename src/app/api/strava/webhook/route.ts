import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fetchActivity,
  getValidAccessToken,
  isRun,
  upsertActivity,
  userIdForAthlete,
} from "@/lib/strava";

// Strava webhook subscription validation handshake.
// On subscription creation, Strava GETs this with hub.challenge + hub.verify_token;
// we must echo the challenge back if the token matches.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ "hub.challenge": challenge });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

interface StravaEvent {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
  subscription_id: number;
  event_time: number;
}

// Strava posts an event whenever an activity is created/updated/deleted (or the
// athlete deauthorizes). We respond 200 immediately so Strava doesn't retry,
// then reconcile our copy of the activity.
export async function POST(req: NextRequest) {
  let event: StravaEvent;
  try {
    event = (await req.json()) as StravaEvent;
  } catch {
    return NextResponse.json({ ok: true }); // ignore malformed bodies
  }

  if (event.object_type === "activity") {
    try {
      const userId = await userIdForAthlete(event.owner_id);
      if (userId) {
        if (event.aspect_type === "delete") {
          await prisma.activity.deleteMany({ where: { id: String(event.object_id), userId } });
        } else {
          const token = await getValidAccessToken(userId);
          const activity = await fetchActivity(token, event.object_id);
          if (isRun(activity)) await upsertActivity(userId, activity);
        }
      }
    } catch (err) {
      // log but still 200 — a non-200 makes Strava retry and can disable the sub
      console.error("strava webhook processing error:", err instanceof Error ? err.message : err);
    }
  } else if (event.object_type === "athlete" && event.aspect_type === "delete") {
    // athlete deauthorized the app — drop their Strava account link
    try {
      await prisma.account.deleteMany({
        where: { provider: "strava", providerAccountId: String(event.owner_id) },
      });
    } catch (err) {
      console.error("strava deauth handling error:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ ok: true });
}
