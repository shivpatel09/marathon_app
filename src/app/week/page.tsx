import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActivePlanInstance } from "@/lib/plan";
import { weekConstraintWarnings } from "@/lib/schedule";
import type { DerivedPaces } from "@/lib/paces";
import WeekView from "@/components/WeekView";
import type { DayWorkout } from "@/components/WeekDays";

function formatGoal(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default async function WeekPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const instance = await getActivePlanInstance(session.user.id);
  if (!instance) {
    return (
      <main className="container">
        <h1>No active plan</h1>
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          You haven&apos;t set up a training plan yet.
        </p>
        <Link href="/setup">
          <button className="primary">Set up a plan</button>
        </Link>
      </main>
    );
  }

  const total = instance.template.weeks;

  // determine the current week: first week whose last workout is today or later
  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);
  const weekMax = (w: number) =>
    Math.max(...instance.scheduled.filter((s) => s.weekIndex === w).map((s) => +s.date));
  let computed = total;
  for (let w = 1; w <= total; w++) {
    if (weekMax(w) >= +todayMid) {
      computed = w;
      break;
    }
  }
  const requested = searchParams.week ? Number(searchParams.week) : computed;
  const weekIndex = Math.min(Math.max(requested || computed, 1), total);

  const mesocycle =
    instance.template.mesocycles.find((m) => weekIndex >= m.startWeek && weekIndex <= m.endWeek)?.name ?? "";

  const daysToRace = Math.max(0, Math.ceil((+instance.raceDate - +todayMid) / 86400000));

  const days: DayWorkout[] = instance.scheduled
    .filter((s) => s.weekIndex === weekIndex)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      date: s.date.toISOString(),
      type: s.type,
      plannedSegments: (s.plannedSegments as DayWorkout["plannedSegments"]) ?? [],
    }));

  const warnings = weekConstraintWarnings(days.map((d) => ({ dayOfWeek: d.dayOfWeek, type: d.type })));

  return (
    <main className="container">
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/"><button>← Dashboard</button></Link>
      </div>
      <WeekView
        planName={instance.template.name}
        totalWeeks={total}
        weekIndex={weekIndex}
        mesocycle={mesocycle}
        goalLabel={formatGoal(instance.goalTimeSec)}
        daysToRace={daysToRace}
        paces={instance.derivedPaces as unknown as DerivedPaces}
        days={days}
        warnings={warnings}
      />
    </main>
  );
}
