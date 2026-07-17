import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActivePlanInstance } from "@/lib/plan";
import { weekConstraintWarnings, startsSunday, weekPosition } from "@/lib/schedule";
import { buildWeekStrength, phaseForMesocycle, type ExerciseInfo, type SessionTemplate } from "@/lib/strength";
import type { DerivedPaces } from "@/lib/paces";
import { hansonsPacesFor, HANSONS_HEAT_ADJ } from "@/lib/hansonsPaces";
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

  const meso = instance.template.mesocycles.find((m) => weekIndex >= m.startWeek && weekIndex <= m.endWeek);
  const mesocycle = meso?.name ?? "";

  const daysToRace = Math.max(0, Math.ceil((+instance.raceDate - +todayMid) / 86400000));

  // recommended strength sessions for this week, keyed by day
  const weekForStrength = instance.scheduled
    .filter((s) => s.weekIndex === weekIndex)
    .map((s) => ({ dayOfWeek: s.dayOfWeek, type: s.type }));
  const [exerciseRows, sessionRows] = await Promise.all([
    prisma.strengthExercise.findMany(),
    prisma.strengthSessionTemplate.findMany({ orderBy: { order: "asc" } }),
  ]);
  const exercises = new Map<string, ExerciseInfo>(
    exerciseRows.map((e) => [e.key, { key: e.key, name: e.name, pattern: e.pattern, equipment: e.equipment, cues: e.cues }]),
  );
  const sessions = sessionRows.map((s) => ({
    phase: s.phase,
    slot: s.slot,
    name: s.name,
    order: s.order,
    items: s.items as unknown as SessionTemplate["items"],
  }));
  const strengthByDay = new Map(
    buildWeekStrength(weekForStrength, phaseForMesocycle(meso?.order ?? 1), sessions, exercises).map((s) => [
      s.dayOfWeek,
      {
        name: s.name,
        items: s.items.map((i) => ({ name: i.name, sets: i.sets, reps: i.reps, note: i.note ?? null })),
      },
    ]),
  );

  // The Hansons (Indy) plan carries its own spreadsheet pace table instead of
  // the Riegel-derived paces; resolve it from the instance's goal time. The
  // per-day/strip pace text is rendered client-side in WeekView so the
  // heat-adjusted column can be toggled.
  const hansons = instance.template.key === "hansons-indy" ? hansonsPacesFor(instance.goalTimeSec) : null;

  // Sunday-start plans display Sunday first; day labels still use Monday=0.
  const sundayStart = startsSunday(instance.template.key);

  const days: DayWorkout[] = instance.scheduled
    .filter((s) => s.weekIndex === weekIndex)
    .sort((a, b) => weekPosition(a.dayOfWeek, sundayStart) - weekPosition(b.dayOfWeek, sundayStart))
    .map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      date: s.date.toISOString(),
      type: s.type,
      label: s.label,
      plannedSegments: (s.plannedSegments as DayWorkout["plannedSegments"]) ?? [],
      strength: strengthByDay.get(s.dayOfWeek),
    }));

  const warnings = weekConstraintWarnings(days.map((d) => ({ dayOfWeek: d.dayOfWeek, type: d.type })));

  return (
    <main className="container">
      <WeekView
        planName={instance.template.name}
        totalWeeks={total}
        weekIndex={weekIndex}
        mesocycle={mesocycle}
        goalLabel={formatGoal(instance.goalTimeSec)}
        daysToRace={daysToRace}
        paces={instance.derivedPaces as unknown as DerivedPaces}
        hansonsPaces={hansons}
        hansonsHeatPaces={hansons ? HANSONS_HEAT_ADJ : null}
        days={days}
        warnings={warnings}
      />
    </main>
  );
}
