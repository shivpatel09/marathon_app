// Plan overview for the dashboard: countdown, mileage progress, and a simple
// readiness read on whether training is tracking toward the goal. Pure function.

import { startOfToday, formatPlannedDate } from "./time";

const METERS_PER_MILE = 1609.34;
const DAY_MS = 86400000;

interface Segment {
  value?: number;
  unit?: string;
  reps?: number;
  repValue?: number;
  repUnit?: string;
  kind?: string;
}

function segMiles(segs: Segment[]): number {
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

export type ReadinessTone = "good" | "warn" | "neutral";

export interface PlanOverview {
  planName: string;
  goalLabel: string;
  raceDateLabel: string;
  daysToRace: number;
  started: boolean;
  daysToStart: number;
  currentWeek: number;
  totalWeeks: number;
  weekProgressPct: number;
  totalPlannedMiles: number;
  plannedToDateMiles: number;
  loggedMiles: number;
  journeyPct: number; // loggedMiles / totalPlannedMiles
  adherencePct: number; // loggedMiles / plannedToDateMiles
  readiness: { label: string; detail: string; tone: ReadinessTone; score: number };
}

export interface OverviewInput {
  planName: string;
  weeks: number;
  goalTimeSec: number;
  raceDate: Date;
  scheduled: { weekIndex: number; date: Date; plannedSegments: Segment[] }[];
  activities: { startDate: Date; distanceM: number }[];
}

function fmtGoal(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function buildPlanOverview(input: OverviewInput, now: Date): PlanOverview {
  const today = startOfToday(now);

  const dates = input.scheduled.map((s) => +s.date);
  const planStart = new Date(Math.min(...dates));

  const totalPlannedMiles = input.scheduled.reduce((sum, s) => sum + segMiles(s.plannedSegments), 0);
  const plannedToDateMiles = input.scheduled
    .filter((s) => +s.date <= +today)
    .reduce((sum, s) => sum + segMiles(s.plannedSegments), 0);

  const loggedMiles = input.activities
    .filter((a) => +a.startDate >= +planStart && +a.startDate <= +today + DAY_MS)
    .reduce((sum, a) => sum + a.distanceM / METERS_PER_MILE, 0);

  // current week
  const weekMax = (w: number) =>
    Math.max(...input.scheduled.filter((s) => s.weekIndex === w).map((s) => +s.date));
  let currentWeek = input.weeks;
  for (let w = 1; w <= input.weeks; w++) {
    if (weekMax(w) >= +today) {
      currentWeek = w;
      break;
    }
  }

  const started = +today >= +planStart;
  const daysToStart = started ? 0 : Math.ceil((+planStart - +today) / DAY_MS);
  const daysToRace = Math.max(0, Math.ceil((+input.raceDate - +today) / DAY_MS));

  const ratio = plannedToDateMiles > 0 ? loggedMiles / plannedToDateMiles : 0;
  const adherencePct = Math.round(ratio * 100);
  const journeyPct = totalPlannedMiles > 0 ? Math.round((loggedMiles / totalPlannedMiles) * 100) : 0;

  let readiness: PlanOverview["readiness"];
  if (!started) {
    readiness = {
      label: "Ready to begin",
      detail: `Your plan starts in ${daysToStart} day${daysToStart === 1 ? "" : "s"} — ${Math.round(totalPlannedMiles)} miles of training ahead toward your ${fmtGoal(input.goalTimeSec)} goal.`,
      tone: "neutral",
      score: 0,
    };
  } else if (ratio >= 1.05) {
    readiness = {
      label: "Ahead of plan",
      detail: `You've logged ${Math.round(loggedMiles)} of ${Math.round(plannedToDateMiles)} planned miles so far (${adherencePct}%). Strong base — keep easy days easy.`,
      tone: "good",
      score: Math.min(100, adherencePct),
    };
  } else if (ratio >= 0.9) {
    readiness = {
      label: "On track",
      detail: `${Math.round(loggedMiles)} of ${Math.round(plannedToDateMiles)} planned miles done (${adherencePct}%). You're hitting your volume — well placed to meet your goal.`,
      tone: "good",
      score: adherencePct,
    };
  } else if (ratio >= 0.75) {
    readiness = {
      label: "Slightly behind",
      detail: `${Math.round(loggedMiles)} of ${Math.round(plannedToDateMiles)} planned miles (${adherencePct}%). A bit under volume — prioritize your long runs and quality sessions.`,
      tone: "warn",
      score: adherencePct,
    };
  } else {
    readiness = {
      label: "Behind plan",
      detail: `${Math.round(loggedMiles)} of ${Math.round(plannedToDateMiles)} planned miles (${adherencePct}%). Consistency is the gap — focus on getting the key weekly sessions in.`,
      tone: "warn",
      score: adherencePct,
    };
  }

  return {
    planName: input.planName,
    goalLabel: fmtGoal(input.goalTimeSec),
    raceDateLabel: formatPlannedDate(input.raceDate, { month: "long", day: "numeric", year: "numeric" }),
    daysToRace,
    started,
    daysToStart,
    currentWeek,
    totalWeeks: input.weeks,
    weekProgressPct: Math.round((currentWeek / input.weeks) * 100),
    totalPlannedMiles: Math.round(totalPlannedMiles),
    plannedToDateMiles: Math.round(plannedToDateMiles),
    loggedMiles: Math.round(loggedMiles),
    journeyPct,
    adherencePct,
    readiness,
  };
}
