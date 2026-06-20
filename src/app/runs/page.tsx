import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ActivityList, { ActivityRow } from "@/components/ActivityList";

export default async function RunsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

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
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/"><button>← Dashboard</button></Link>
      </div>
      <h1 style={{ marginBottom: "0.5rem" }}>Recent runs</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: "1.5rem" }}>
        Your synced Strava activity from the last 8 weeks.
      </p>
      <ActivityList activities={rows} />
    </main>
  );
}
