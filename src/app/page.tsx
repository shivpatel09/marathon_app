import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SignIn from "@/components/SignIn";
import SignOut from "@/components/SignOut";
import ActivityList, { ActivityRow } from "@/components/ActivityList";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="container">
        <h1>Marathon trainer</h1>
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          Connect your Strava account to pull in your runs and start tracking
          your training.
        </p>
        <SignIn />
      </main>
    );
  }

  const activities = await prisma.activity.findMany({
    where: { userId: session.user.id },
    orderBy: { startDate: "desc" },
    take: 100,
  });

  const rows: ActivityRow[] = activities.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    startDate: a.startDate.toISOString(),
    distanceM: a.distanceM,
    movingTime: a.movingTime,
    avgSpeed: a.avgSpeed,
    avgHr: a.avgHr,
  }));

  return (
    <main className="container">
      <div className="row" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1>Marathon trainer</h1>
          <p className="muted" style={{ margin: 0 }}>
            Signed in as {session.user.name ?? "athlete"}
          </p>
        </div>
        <SignOut />
      </div>

      <ActivityList activities={rows} />
    </main>
  );
}
