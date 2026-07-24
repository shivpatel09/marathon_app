// Shared weekly training metrics (used by both the week view and the review).

const METERS_PER_MILE = 1609.34;
const DAY_MS = 86400000;

export interface AcwrActivity {
  startDate: Date;
  distanceM: number;
}

export interface IntensityActivity {
  distanceM: number;
  avgHr: number | null;
  avgSpeed: number | null; // m/s
}

// Easy/hard boundary as a fraction of max HR: at/above threshold-ish effort
// (~85% HRmax) counts as "hard". Effort (HR) is a better intensity signal than
// pace measured against a goal you haven't reached yet.
export const HARD_HR_FRACTION = 0.85;

/** Acute:chronic workload ratio (mileage) anchored at an instant.
 *  acute = last 7 days; chronic = last 28 days averaged per week. */
export function acwrValueAt(activities: AcwrActivity[], endMs: number): number {
  const load = (days: number) =>
    activities
      .filter((a) => +a.startDate > endMs - days * DAY_MS && +a.startDate <= endMs)
      .reduce((s, a) => s + a.distanceM / METERS_PER_MILE, 0);
  const acute = load(7);
  const chronic = load(28) / 4;
  return chronic > 0 ? acute / chronic : 0;
}

/** ACWR value + whether it sits in the 0.8–1.3 "safe" band. Null if no history
 *  yet (chronic load is zero). */
export function weeklyAcwr(activities: AcwrActivity[], endMs: number): { value: number; inRange: boolean } | null {
  const v = acwrValueAt(activities, endMs);
  if (v === 0) return null;
  return { value: Math.round(v * 100) / 100, inRange: v >= 0.8 && v <= 1.3 };
}

/** Easy/hard mileage split by effort: a run is "hard" when its average HR is at
 *  or above HARD_HR_FRACTION of max HR. Falls back to pace vs threshold (+10s)
 *  for runs without HR data. Null when there are no runs to classify. */
export function intensitySplit(
  runs: IntensityActivity[],
  hrMax: number,
  thresholdSecPerMile: number,
): { easyPct: number; hardPct: number } | null {
  let easy = 0;
  let hard = 0;
  for (const a of runs) {
    const mi = a.distanceM / METERS_PER_MILE;
    let isHard: boolean;
    if (a.avgHr && hrMax > 0) {
      isHard = a.avgHr >= hrMax * HARD_HR_FRACTION;
    } else {
      const pace = a.avgSpeed ? METERS_PER_MILE / a.avgSpeed : Infinity;
      isHard = pace <= thresholdSecPerMile + 10;
    }
    if (isHard) hard += mi;
    else easy += mi;
  }
  const total = easy + hard;
  if (total === 0) return null;
  const easyPct = Math.round((easy / total) * 100);
  return { easyPct, hardPct: 100 - easyPct };
}

/** "4h 20m" / "45m" from seconds. */
export function fmtOnFeet(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
