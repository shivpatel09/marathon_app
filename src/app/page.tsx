import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActivePlanInstance } from "@/lib/plan";
import { buildPlanOverview } from "@/lib/overview";
import SignIn from "@/components/SignIn";
import SignOut from "@/components/SignOut";
import PlanOverview from "@/components/PlanOverview";

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

  const plan = await getActivePlanInstance(session.user.id);

  if (!plan) {
    return (
      <main className="container">
        <div className="row" style={{ marginBottom: "1rem" }}>
          <h1 style={{ margin: 0 }}>Marathon trainer</h1>
          <SignOut />
        </div>
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          You don&apos;t have a plan yet. Pick a proven program and we&apos;ll personalize it to your goal.
        </p>
        <Link href="/setup"><button className="primary">Set up a plan</button></Link>
      </main>
    );
  }

  const activities = await prisma.activity.findMany({
    where: { userId: session.user.id },
    select: { startDate: true, distanceM: true },
  });

  const overview = buildPlanOverview(
    {
      planName: plan.template.name,
      weeks: plan.template.weeks,
      goalTimeSec: plan.goalTimeSec,
      raceDate: plan.raceDate,
      scheduled: plan.scheduled.map((s) => ({
        weekIndex: s.weekIndex,
        date: s.date,
        plannedSegments: (s.plannedSegments as { value?: number }[]) ?? [],
      })),
      activities,
    },
    new Date(),
  );

  return (
    <main className="container">
      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>{plan.template.name}</h1>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {session.user.name ?? "athlete"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/setup"><button>Change plan</button></Link>
          <SignOut />
        </div>
      </div>

      <PlanOverview o={overview} />
    </main>
  );
}
