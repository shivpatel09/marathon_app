// Goal-time pace derivation (spec §6.2 / §14.3).
// A single input — goal marathon finish time — fans out to every training pace.
// Faster zones use the Riegel endurance model; easy zones are offsets off
// marathon pace (MP). All paces are in seconds per mile.

export const MARATHON_MILES = 26.2188;
const HALF_MILES = 13.1094;
const FIVEK_MILES = 3.10686;

// Riegel: race time scales with distance^1.06, so pace scales with distance^0.06.
function paceAtDistance(mpSecPerMile: number, distMiles: number): number {
  return mpSecPerMile * Math.pow(distMiles / MARATHON_MILES, 0.06);
}

export type PaceRef =
  | "RECOVERY"
  | "EASY"
  | "GENERAL_AEROBIC"
  | "LONG"
  | "MARATHON"
  | "LT"
  | "STRENGTH"
  | "VO2MAX";

export interface DerivedPaces {
  recovery: number;
  easy: number;
  generalAerobic: number;
  long: number;
  marathon: number;
  lt: number;
  strength: number;
  vo2max: number;
}

/** Derive all training paces (sec/mi) from a goal marathon time in seconds. */
export function derivePaces(goalSeconds: number): DerivedPaces {
  const mp = goalSeconds / MARATHON_MILES;
  return {
    marathon: mp,
    lt: paceAtDistance(mp, HALF_MILES), // ≈ half-marathon / 15K pace
    vo2max: paceAtDistance(mp, FIVEK_MILES), // ≈ 5K race pace
    strength: mp - 10, // Hansons strength intervals ≈ MP − 10 s/mi
    generalAerobic: mp + 50,
    easy: mp + 60,
    long: mp + 75,
    recovery: mp + 90,
  };
}

/** Map an abstract pace reference to a concrete pace (sec/mi). */
export function resolvePace(ref: PaceRef, p: DerivedPaces): number {
  switch (ref) {
    case "RECOVERY":
      return p.recovery;
    case "EASY":
      return p.easy;
    case "GENERAL_AEROBIC":
      return p.generalAerobic;
    case "LONG":
      return p.long;
    case "MARATHON":
      return p.marathon;
    case "LT":
      return p.lt;
    case "STRENGTH":
      return p.strength;
    case "VO2MAX":
      return p.vo2max;
  }
}

/** Parse "h:mm:ss" or "mm:ss" into total seconds. Returns null if invalid. */
export function parseGoalTime(input: string): number | null {
  const parts = input.trim().split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n) || n < 0)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

/** Format a pace (sec/mi) as "m:ss". */
export function formatPace(secPerMile: number): string {
  const s = Math.round(secPerMile);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
