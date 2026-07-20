// In-app race predictions from synced activities — no external services.
//
// Method (the same family Runalyze's "effective VO2max" uses):
//  1. For each recent run with heart-rate data, estimate the oxygen cost of
//     the pace (Daniels/Gilbert: VO2 = -4.60 + 0.182258·v + 0.000104·v²,
//     v in m/min) and divide by the fraction of VO2max implied by average HR
//     (Swain: %VO2max = (%HRmax·100 − 37) / 64). Running easy at a low HR and
//     running hard at a high HR should land on the same estimated VO2max.
//  2. Aggregate with the median (robust to bad HR samples / hilly runs).
//  3. Predict race times by solving Daniels' sustainable-fraction curve
//     F(t) = 0.8 + 0.1894393·e^(−0.012778·t) + 0.2989558·e^(−0.1932605·t)
//     for the time t where VO2max·F(t) equals the oxygen cost of d/t.
//
// Fallback without HR data: Riegel-equivalent times from the best recent
// training performance (T2 = T1·(D2/D1)^1.06) — conservative, since training
// runs aren't all-out efforts.

const RIEGEL_EXP = 1.06;

export interface RunSample {
  startDate: Date;
  distanceM: number;
  movingTime: number; // seconds
  avgHr: number | null;
}

export interface RaceDistance {
  key: string;
  label: string;
  meters: number;
}

export const RACE_DISTANCES: RaceDistance[] = [
  { key: "5k", label: "5K", meters: 5000 },
  { key: "10k", label: "10K", meters: 10000 },
  { key: "half", label: "Half marathon", meters: 21097.5 },
  { key: "marathon", label: "Marathon", meters: 42195 },
];

export interface Prediction {
  key: string;
  label: string;
  meters: number;
  seconds: number;
  paceSecPerMile: number;
}

export interface PredictionResult {
  method: "vo2max" | "riegel";
  effectiveVo2max: number | null;
  vo2maxTrend: number | null; // vs the previous window; + = improving
  sampleCount: number;
  hrMax: number;
  predictions: Prediction[];
}

const METERS_PER_MILE = 1609.34;

/** Daniels/Gilbert oxygen cost of running at v m/min. */
function vo2AtVelocity(v: number): number {
  return -4.6 + 0.182258 * v + 0.000104 * v * v;
}

/** Fraction of VO2max sustainable for t minutes (Daniels). */
function sustainableFraction(tMin: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);
}

/** Tanaka estimate when the user hasn't measured HRmax. */
export function estimateHrMax(age: number | null): number {
  return Math.round(208 - 0.7 * (age ?? 30));
}

/** Estimated VO2max from one run's pace + average HR; null if unusable. */
export function effectiveVo2maxForRun(run: RunSample, hrMax: number): number | null {
  if (!run.avgHr || run.movingTime < 15 * 60 || run.distanceM < 3000) return null;
  const pctHrMax = run.avgHr / hrMax;
  if (pctHrMax < 0.55 || pctHrMax > 1.02) return null; // walk / bad strap data
  const pctVo2max = Math.min(1, Math.max(0.4, (pctHrMax * 100 - 37) / 64));
  const v = run.distanceM / (run.movingTime / 60);
  const value = vo2AtVelocity(v) / pctVo2max;
  return value > 20 && value < 90 ? value : null;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Solve for the race time (seconds) at a distance given VO2max. */
export function raceTimeForVo2max(vo2max: number, meters: number): number {
  let lo = meters / 700; // ~ world-record pace, minutes
  let hi = meters / 80; // slower than any race effort
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const need = vo2AtVelocity(meters / mid);
    const have = vo2max * sustainableFraction(mid);
    if (have >= need) hi = mid;
    else lo = mid;
  }
  return hi * 60;
}

function toPredictions(secondsFor: (m: RaceDistance) => number): Prediction[] {
  return RACE_DISTANCES.map((d) => {
    const seconds = secondsFor(d);
    return {
      key: d.key,
      label: d.label,
      meters: d.meters,
      seconds,
      paceSecPerMile: seconds / (d.meters / METERS_PER_MILE),
    };
  });
}

export function buildPredictions(runs: RunSample[], age: number | null, now = new Date()): PredictionResult | null {
  const hrMax = estimateHrMax(age);
  const cutoffRecent = new Date(+now - 28 * 86400000);

  const samples = runs
    .map((r) => ({ run: r, vo2: effectiveVo2maxForRun(r, hrMax) }))
    .filter((s): s is { run: RunSample; vo2: number } => s.vo2 != null);

  if (samples.length >= 3) {
    const recent = samples.filter((s) => s.run.startDate >= cutoffRecent);
    const used = recent.length >= 3 ? recent : samples;
    const vo2max = median(used.map((s) => s.vo2));

    const older = samples.filter((s) => s.run.startDate < cutoffRecent);
    const trend = recent.length >= 3 && older.length >= 3 ? vo2max - median(older.map((s) => s.vo2)) : null;

    return {
      method: "vo2max",
      effectiveVo2max: Math.round(vo2max * 10) / 10,
      vo2maxTrend: trend == null ? null : Math.round(trend * 10) / 10,
      sampleCount: used.length,
      hrMax,
      predictions: toPredictions((d) => raceTimeForVo2max(vo2max, d.meters)),
    };
  }

  // Riegel fallback from the best recent training performance
  const candidates = runs.filter((r) => r.distanceM >= 5000 && r.movingTime > 0);
  if (candidates.length === 0) return null;
  const best = candidates.reduce((a, b) =>
    a.movingTime * Math.pow(42195 / a.distanceM, RIEGEL_EXP) <
    b.movingTime * Math.pow(42195 / b.distanceM, RIEGEL_EXP)
      ? a
      : b,
  );
  return {
    method: "riegel",
    effectiveVo2max: null,
    vo2maxTrend: null,
    sampleCount: candidates.length,
    hrMax,
    predictions: toPredictions((d) => best.movingTime * Math.pow(d.meters / best.distanceM, RIEGEL_EXP)),
  };
}

export function fmtRaceTime(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}
