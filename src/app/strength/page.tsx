import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActivePlanInstance } from "@/lib/plan";
import { startOfToday } from "@/lib/time";
import {
  buildWeekStrength,
  phaseForMesocycle,
  type ExerciseInfo,
  type SessionTemplate,
  type WeekDay,
} from "@/lib/strength";
import StrengthView from "@/components/StrengthView";

export default async function StrengthPage({
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
          Set up a plan to get strength sessions matched to your training.
        </p>
        <Link href="/setup"><button className="primary">Set up a plan</button></Link>
      </main>
    );
  }

  const total = instance.template.weeks;
  const today = startOfToday();
  const weekMax = (w: number) =>
    Math.max(...instance.scheduled.filter((s) => s.weekIndex === w).map((s) => +s.date));
  let computed = total;
  for (let w = 1; w <= total; w++) {
    if (weekMax(w) >= +today) {
      computed = w;
      break;
    }
  }
  const weekIndex = Math.min(Math.max((searchParams.week ? Number(searchParams.week) : computed) || computed, 1), total);

  const meso = instance.template.mesocycles.find((m) => weekIndex >= m.startWeek && weekIndex <= m.endWeek);
  const phase = phaseForMesocycle(meso?.order ?? 1);

  const week: WeekDay[] = instance.scheduled
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

  const built = buildWeekStrength(week, phase, sessions, exercises);
  const prev = weekIndex > 1 ? weekIndex - 1 : null;
  const next = weekIndex < total ? weekIndex + 1 : null;

  return (
    <main className="container">
      <div className="row" style={{ marginBottom: 6 }}>
        <h1 style={{ margin: 0 }}>Strength</h1>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {prev ? <Link href={`/strength?week=${prev}`}><button>‹</button></Link> : <button disabled>‹</button>}
          <span className="muted" style={{ fontSize: 13 }}>wk {weekIndex}</span>
          {next ? <Link href={`/strength?week=${next}`}><button>›</button></Link> : <button disabled>›</button>}
        </div>
      </div>

      <StrengthView phase={phase} weekIndex={weekIndex} mesocycle={meso?.name ?? ""} sessions={built} />
    </main>
  );
}
