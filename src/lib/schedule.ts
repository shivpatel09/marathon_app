// Pure schedule generation: maps a plan template onto real calendar dates and
// bakes in resolved paces. No DB access — easy to test in isolation.
//
// Race day is anchored to (weekIndex = weeks, dayOfWeek = 6 / Sunday), so the
// whole plan counts back from race day. Marathons are typically on a Sunday;
// if a race falls on another weekday the sequence still ends exactly on race day.

import { DerivedPaces, PaceRef, resolvePace } from "./paces";

const DAY_MS = 24 * 3600 * 1000;
const METERS_PER_MILE = 1609.34;

export interface Segment {
  paceRef?: PaceRef;
  value?: number;
  unit?: string;
  reps?: number;
  repValue?: number;
  repUnit?: string;
  recovery?: string;
  kind?: string;
}

export interface ResolvedSegment extends Segment {
  paceSecPerMile?: number;
}

export interface TemplateWorkout {
  weekIndex: number;
  dayOfWeek: number;
  type: string;
  segments: Segment[];
}

export interface ScheduledInput {
  weekIndex: number;
  dayOfWeek: number;
  date: Date;
  originalDate: Date;
  type: string;
  plannedSegments: ResolvedSegment[];
  targetRacePace?: number;
  raceDistanceM?: number;
}

export function daysBeforeRace(weeks: number, weekIndex: number, dayOfWeek: number): number {
  return (weeks - weekIndex) * 7 + (6 - dayOfWeek);
}

// ---- constraint checks for user-rescheduled weeks (warn, don't block) ----

const QUALITY_TYPES = new Set([
  "VO2MAX",
  "SPEED",
  "TEMPO_LT",
  "MARATHON_PACE",
  "STRENGTH_INTERVALS",
  "TUNE_UP_RACE",
  "RACE",
]);
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function weekConstraintWarnings(days: { dayOfWeek: number; type: string }[]): string[] {
  const sorted = [...days].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const warnings: string[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (b.dayOfWeek - a.dayOfWeek === 1 && QUALITY_TYPES.has(a.type) && QUALITY_TYPES.has(b.type)) {
      warnings.push(
        `${DAY_NAMES[a.dayOfWeek]} and ${DAY_NAMES[b.dayOfWeek]} are both hard days — leave an easy day between quality sessions.`,
      );
    }
  }

  const long = sorted.find((d) => d.type === "LONG" || d.type === "RACE");
  if (long && long.dayOfWeek < 5) {
    warnings.push(`Your long run is on ${DAY_NAMES[long.dayOfWeek]} — long runs usually sit best on the weekend.`);
  }

  return warnings;
}

export function generateSchedule(
  workouts: TemplateWorkout[],
  weeks: number,
  paces: DerivedPaces,
  raceDate: Date,
): ScheduledInput[] {
  return workouts.map((w) => {
    const offset = daysBeforeRace(weeks, w.weekIndex, w.dayOfWeek);
    const date = new Date(raceDate.getTime() - offset * DAY_MS);

    let targetRacePace: number | undefined;
    let raceDistanceM: number | undefined;

    const plannedSegments: ResolvedSegment[] = (w.segments ?? []).map((s) => {
      const seg: ResolvedSegment = { ...s };
      if (s.paceRef) seg.paceSecPerMile = resolvePace(s.paceRef, paces);
      if (s.kind === "race") {
        if (s.paceRef) targetRacePace = resolvePace(s.paceRef, paces);
        if (typeof s.value === "number") {
          raceDistanceM = s.unit === "K" ? s.value * 1000 : s.value * METERS_PER_MILE;
        }
      }
      return seg;
    });

    return {
      weekIndex: w.weekIndex,
      dayOfWeek: w.dayOfWeek,
      date,
      originalDate: date,
      type: w.type,
      plannedSegments,
      targetRacePace,
      raceDistanceM,
    };
  });
}
