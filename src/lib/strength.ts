// Strength engine (spec §9.3): pick two strength days that complement the run
// schedule (paired with hard-run days so easy days stay true recovery), and
// resolve phase-appropriate sessions. Pure — takes data, returns structures.

export type Phase = "base" | "build" | "peak" | "taper";

// run types that are already "hard" — pair strength here, not on easy days
const QUALITY = new Set([
  "VO2MAX",
  "SPEED",
  "TEMPO_LT",
  "MARATHON_PACE",
  "STRENGTH_INTERVALS",
]);
// never stack strength on these
const AVOID = new Set(["REST", "LONG", "TUNE_UP_RACE", "RACE"]);

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface WeekDay {
  dayOfWeek: number;
  type: string;
}

export interface ExerciseInfo {
  key: string;
  name: string;
  pattern: string;
  equipment: string | null;
  cues: string | null;
}

export interface SessionItem {
  exerciseKey: string;
  sets: number;
  reps: string;
  note?: string;
}

export interface SessionTemplate {
  phase: string;
  slot: string;
  name: string;
  order: number;
  items: SessionItem[];
}

export interface ResolvedItem {
  name: string;
  pattern: string;
  equipment: string | null;
  cues: string | null;
  sets: number;
  reps: string;
  note?: string;
}

export interface StrengthSession {
  dayOfWeek: number;
  dayName: string;
  pairedWith: string; // the run type it's stacked with
  name: string;
  slot: string;
  items: ResolvedItem[];
}

export function phaseForMesocycle(order: number): Phase {
  if (order <= 1) return "base";
  if (order === 2) return "build";
  if (order === 3) return "peak";
  return "taper";
}

/** Choose up to two well-spaced strength days, preferring hard-run days. */
export function pickStrengthDays(week: WeekDay[]): number[] {
  const quality = week.filter((w) => QUALITY.has(w.type)).map((w) => w.dayOfWeek);
  const picks: number[] = [];

  if (quality.length >= 2) {
    picks.push(quality[0], quality[quality.length - 1]); // most spread-out pair
  } else if (quality.length === 1) {
    picks.push(quality[0]);
  }

  if (picks.length < 2) {
    // fill from other run days, maximizing spacing from existing picks
    const others = week
      .filter((w) => !AVOID.has(w.type) && !picks.includes(w.dayOfWeek))
      .map((w) => w.dayOfWeek);
    while (picks.length < 2 && others.length) {
      others.sort((a, b) => spacing(b, picks) - spacing(a, picks));
      picks.push(others.shift()!);
    }
  }
  return picks.sort((a, b) => a - b);
}

function spacing(day: number, picks: number[]): number {
  if (!picks.length) return 99;
  return Math.min(...picks.map((p) => Math.abs(p - day)));
}

export function buildWeekStrength(
  week: WeekDay[],
  phase: Phase,
  sessions: SessionTemplate[],
  exercises: Map<string, ExerciseInfo>,
): StrengthSession[] {
  const days = pickStrengthDays(week);
  const bySlot = (slot: string) => sessions.find((s) => s.phase === phase && s.slot === slot);
  const slots = ["A", "B"];
  const typeByDay = new Map(week.map((w) => [w.dayOfWeek, w.type]));

  const out: StrengthSession[] = [];
  days.forEach((day, i) => {
    const tmpl = bySlot(slots[i]);
    if (!tmpl) return;
    out.push({
      dayOfWeek: day,
      dayName: DAYS[day],
      pairedWith: typeByDay.get(day) ?? "EASY",
      name: tmpl.name,
      slot: tmpl.slot,
      items: tmpl.items.map((item) => {
        const ex = exercises.get(item.exerciseKey);
        return {
          name: ex?.name ?? item.exerciseKey,
          pattern: ex?.pattern ?? "",
          equipment: ex?.equipment ?? null,
          cues: ex?.cues ?? null,
          sets: item.sets,
          reps: item.reps,
          note: item.note,
        };
      }),
    });
  });
  return out;
}
