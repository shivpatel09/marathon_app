// Assembles the deterministic WeeklyReviewInput (spec §9.5) from the plan +
// synced Strava activities. Every number here is computed — the LLM only
// turns this struct into prose (see coach.ts).

import { prisma } from "./prisma";
import { formatPace, type DerivedPaces } from "./paces";
import { startOfToday, easternDateKey, plannedDateKey } from "./time";
import { acwrValueAt, intensitySplit } from "./weekMetrics";
import { resolveHrMax } from "./predictions";

const METERS_PER_MILE = 1609.34;
const DAY_MS = 86400000;

export interface GradedWorkout {
  day: string; // "Tue"
  type: string;
  verdict: string;
  onTarget: boolean;
}

export interface WeeklyReviewInput {
  planName: string;
  weekIndex: number;
  mesocycle: string;
  goalLabel: string;
  mileage: { planned: number; actual: number };
  workouts: { onTarget: number; total: number; graded: GradedWorkout[] };
  acwr: { value: number; inRange: boolean; trend: number[] };
  intensitySplit: { easyPct: number; hardPct: number };
  weekAhead: { focus: string; keyWorkouts: string[] };
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Segment {
  value?: number;
  unit?: string;
  reps?: number;
  repValue?: number;
  repUnit?: string;
  kind?: string;
  paceSecPerMile?: number;
}

function segmentMiles(segs: Segment[]): number {
  let mi = 0;
  for (const s of segs) {
    if (s.kind === "intervals") {
      const each = s.repUnit === "mi" ? s.repValue ?? 0 : (s.repValue ?? 0) / METERS_PER_MILE;
      mi += (s.reps ?? 0) * each;
    } else if (s.kind === "strides") {
      mi += ((s.reps ?? 0) * (s.repValue ?? 0)) / METERS_PER_MILE;
    } else if (s.kind === "race") {
      mi += s.unit === "K" ? ((s.value ?? 0) * 1000) / METERS_PER_MILE : s.value ?? 0;
    } else if (typeof s.value === "number") {
      mi += s.value;
    }
  }
  return mi;
}

// representative target pace = pace of the longest-distance segment that has one
function targetPace(segs: Segment[]): number | null {
  let best: { miles: number; pace: number } | null = null;
  for (const s of segs) {
    if (typeof s.paceSecPerMile !== "number") continue;
    const miles = typeof s.value === "number" ? s.value : 0;
    if (!best || miles > best.miles) best = { miles, pace: s.paceSecPerMile };
  }
  return best?.pace ?? null;
}

const EASY_TYPES = new Set(["RECOVERY", "EASY", "GENERAL_AEROBIC", "LONG", "MEDIUM_LONG"]);

export async function assembleWeeklyReview(
  userId: string,
  requestedWeek?: number,
): Promise<WeeklyReviewInput | null> {
  const instance = await prisma.userPlanInstance.findFirst({
    where: { userId, active: true },
    include: {
      template: { include: { mesocycles: { orderBy: { order: "asc" } } } },
      scheduled: { orderBy: { date: "asc" } },
    },
  });
  if (!instance) return null;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { maxHr: true, age: true } });
  const hrMax = resolveHrMax(user?.maxHr ?? null, user?.age ?? null);

  const total = instance.template.weeks;
  const today = startOfToday();

  // current week = first week whose last workout is today or later
  const weekMax = (w: number) =>
    Math.max(...instance.scheduled.filter((s) => s.weekIndex === w).map((s) => +s.date));
  let computed = total;
  for (let w = 1; w <= total; w++) {
    if (weekMax(w) >= +today) {
      computed = w;
      break;
    }
  }
  const weekIndex = Math.min(Math.max(requestedWeek || computed, 1), total);

  const weekWorkouts = instance.scheduled
    .filter((s) => s.weekIndex === weekIndex)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const weekStart = new Date(Math.min(...weekWorkouts.map((s) => +s.date)));
  const weekEnd = new Date(Math.max(...weekWorkouts.map((s) => +s.date)));

  // all activities (already filtered to runs at sync time)
  const activities = await prisma.activity.findMany({
    where: { userId },
    orderBy: { startDate: "asc" },
  });
  const actByDate = new Map<string, (typeof activities)[number]>();
  for (const a of activities) actByDate.set(easternDateKey(a.startDate), a);

  // planned vs actual mileage for the week
  const planned = weekWorkouts.reduce(
    (s, w) => s + segmentMiles((w.plannedSegments as Segment[]) ?? []),
    0,
  );
  const actualThisWeek = activities.filter(
    (a) => +a.startDate >= +weekStart && +a.startDate <= +weekEnd + DAY_MS,
  );
  const actual = actualThisWeek.reduce((s, a) => s + a.distanceM / METERS_PER_MILE, 0);

  const paces = instance.derivedPaces as unknown as DerivedPaces;

  // adherence grading
  const runDays = weekWorkouts.filter((w) => w.type !== "REST");
  const graded: GradedWorkout[] = [];
  for (const w of runDays) {
    const act = actByDate.get(plannedDateKey(w.date));
    const segs = (w.plannedSegments as Segment[]) ?? [];
    if (!act) {
      if (+w.date < +today) graded.push({ day: DAYS[w.dayOfWeek], type: w.type, verdict: "missed", onTarget: false });
      continue; // future day — not graded
    }
    const plannedMi = segmentMiles(segs);
    const actualMi = act.distanceM / METERS_PER_MILE;
    const tgt = targetPace(segs);
    const actPace = act.avgSpeed ? METERS_PER_MILE / act.avgSpeed : null;

    const distOk = plannedMi === 0 || (actualMi >= plannedMi * 0.85 && actualMi <= plannedMi * 1.2);
    let paceNote = "";
    let paceOk = true;
    if (tgt && actPace) {
      if (EASY_TYPES.has(w.type) && actPace < tgt - 20) {
        paceNote = `${Math.round(tgt - actPace)}s/mi too fast`;
        paceOk = false;
      } else if (!EASY_TYPES.has(w.type) && actPace > tgt + 12) {
        paceNote = "off goal pace";
        paceOk = false;
      }
    }
    const onTarget = distOk && paceOk;
    const verdict = paceNote || (!distOk ? `${actualMi.toFixed(1)}/${plannedMi.toFixed(0)} mi` : "on pace");
    graded.push({ day: DAYS[w.dayOfWeek], type: w.type, verdict, onTarget });
  }
  const onTargetCount = graded.filter((g) => g.onTarget).length;

  // ACWR from the actual Strava history, anchored at week end
  const acwrValue = acwrValueAt(activities, +weekEnd);
  const trend = [4, 3, 2, 1, 0].map((k) => Math.round(acwrValueAt(activities, +weekEnd - k * 7 * DAY_MS) * 100) / 100);

  // intensity split over the week's actual runs (hard = at/under threshold pace)
  const split = intensitySplit(actualThisWeek, hrMax, paces.lt);
  const easyPct = split?.easyPct ?? 0;

  // week ahead
  const nextWeek = Math.min(weekIndex + 1, total);
  const nextWorkouts = instance.scheduled
    .filter((s) => s.weekIndex === nextWeek && !["REST", "EASY", "RECOVERY"].includes(s.type))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const keyWorkouts = nextWorkouts.slice(0, 3).map((w) => {
    const segs = (w.plannedSegments as Segment[]) ?? [];
    const mi = segmentMiles(segs).toFixed(segs.length > 1 ? 0 : 1);
    const tgt = targetPace(segs);
    return `${DAYS[w.dayOfWeek]} — ${w.type.toLowerCase().replace(/_/g, " ")} ${mi} mi${tgt ? ` @ ${formatPace(tgt)}` : ""}`;
  });
  const mesocycle =
    instance.template.mesocycles.find((m) => nextWeek >= m.startWeek && nextWeek <= m.endWeek)?.name ?? "";

  const goalLabel = `${Math.floor(instance.goalTimeSec / 3600)}:${String(
    Math.floor((instance.goalTimeSec % 3600) / 60),
  ).padStart(2, "0")}:${String(instance.goalTimeSec % 60).padStart(2, "0")}`;

  return {
    planName: instance.template.name,
    weekIndex,
    mesocycle:
      instance.template.mesocycles.find((m) => weekIndex >= m.startWeek && weekIndex <= m.endWeek)?.name ?? "",
    goalLabel,
    mileage: { planned: Math.round(planned * 10) / 10, actual: Math.round(actual * 10) / 10 },
    workouts: { onTarget: onTargetCount, total: runDays.length, graded },
    acwr: { value: Math.round(acwrValue * 100) / 100, inRange: acwrValue >= 0.8 && acwrValue <= 1.3, trend },
    intensitySplit: { easyPct, hardPct: 100 - easyPct },
    weekAhead: { focus: mesocycle, keyWorkouts },
  };
}
