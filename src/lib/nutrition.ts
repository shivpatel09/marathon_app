// Lightweight nutrition engine (spec §9.4): estimate daily calorie + macro
// targets, periodized by that day's training, and correct against the
// bodyweight trend. Pure functions — no DB access.

const KCAL_PER_KG_FAT = 7700; // energy in 1 kg of body mass change
const KM_PER_MILE = 1.60934;
const LB_PER_KG = 2.20462;

// weight is stored in kg (Mifflin-St Jeor needs metric) but shown/entered in lb
export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}
export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

// height is stored in cm but shown/entered as feet + inches
const CM_PER_INCH = 2.54;
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalIn = cm / CM_PER_INCH;
  let feet = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}
export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH;
}

export type Sex = "MALE" | "FEMALE";
export type BodyCompGoal = "MAINTAIN" | "LOSE_FAT" | "GAIN";
export type ActivityLevel = "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE";

export interface NutritionProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  bodyCompGoal: BodyCompGoal;
  weeklyWeightChangeKg: number; // target rate (negative = lose)
  baselineActivity: ActivityLevel;
}

export interface DailyTargets {
  bmr: number;
  trainingCalories: number;
  tdee: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  carbsPerKg: number;
}

// Mifflin-St Jeor BMR (kcal/day)
export function mifflinBmr(p: Pick<NutritionProfile, "sex" | "weightKg" | "heightCm" | "age">): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "MALE" ? base + 5 : base - 161;
}

// non-exercise activity multiplier (running is added separately, so keep these
// lower than the classic Harris-Benedict factors to avoid double-counting)
function neatFactor(level: ActivityLevel): number {
  switch (level) {
    case "SEDENTARY": return 1.2;
    case "LIGHT": return 1.3;
    case "MODERATE": return 1.4;
    case "ACTIVE": return 1.5;
  }
}

// running energy ≈ 1 kcal per kg per km
export function runningCalories(weightKg: number, miles: number): number {
  return Math.round(weightKg * miles * KM_PER_MILE);
}

export function computeDailyTargets(p: NutritionProfile, trainingMiles: number): DailyTargets {
  const bmr = mifflinBmr(p);
  const trainingCalories = runningCalories(p.weightKg, trainingMiles);
  const tdee = bmr * neatFactor(p.baselineActivity) + trainingCalories;

  // goal adjustment: spread the weekly target change across the day
  const dailyDelta = (p.weeklyWeightChangeKg * KCAL_PER_KG_FAT) / 7;
  const calories = Math.round(tdee + dailyDelta);

  // protein g/kg by goal (preserve lean mass in a deficit)
  const proteinPerKg = p.bodyCompGoal === "LOSE_FAT" ? 2.0 : 1.8;
  const proteinG = Math.round(p.weightKg * proteinPerKg);

  // carbs periodized by the day's training volume
  const carbsPerKg = trainingMiles >= 10 ? 8 : trainingMiles >= 4 ? 6 : 4;
  const carbsG = Math.round(p.weightKg * carbsPerKg);

  // fat fills the remainder, with a ~0.6 g/kg floor for hormonal health
  const fatFloorG = Math.round(p.weightKg * 0.6);
  const remainderCals = calories - proteinG * 4 - carbsG * 4;
  const fatG = Math.max(fatFloorG, Math.round(remainderCals / 9));

  return { bmr: Math.round(bmr), trainingCalories, tdee: Math.round(tdee), calories, proteinG, carbsG, fatG, carbsPerKg };
}

// ---- bodyweight trend correction ----

export type TrendStatus =
  | "insufficient_data"
  | "on_track"
  | "under_fueling"
  | "losing_too_fast"
  | "gaining_unintended";

export interface WeightSample {
  date: Date;
  weightKg: number;
}

export interface TrendAnalysis {
  samples: number;
  weeklyChangeKg: number | null;
  goalChangeKg: number;
  status: TrendStatus;
  recommendation: string;
}

export function analyzeWeightTrend(
  weighIns: WeightSample[],
  goalChangeKg: number,
): TrendAnalysis {
  const sorted = weighIns
    .filter((w) => typeof w.weightKg === "number")
    .sort((a, b) => +a.date - +b.date);

  if (sorted.length < 2) {
    return {
      samples: sorted.length,
      weeklyChangeKg: null,
      goalChangeKg,
      status: "insufficient_data",
      recommendation: "Log a few morning weigh-ins so we can track your trend and fine-tune intake.",
    };
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const weeks = Math.max((+last.date - +first.date) / (7 * 86400000), 1 / 7);
  const weeklyChangeKg = Math.round(((last.weightKg - first.weightKg) / weeks) * 100) / 100;

  const drift = weeklyChangeKg - goalChangeKg; // positive = gaining faster / losing slower than goal
  let status: TrendStatus = "on_track";
  let recommendation = "Trend matches your goal — hold your current intake.";

  if (weeklyChangeKg <= -0.7 && goalChangeKg >= -0.25) {
    status = "under_fueling";
    recommendation = "You're losing weight in a training block where you shouldn't be — add ~300-400 kcal/day, mostly carbs around hard days.";
  } else if (drift < -0.3) {
    status = "losing_too_fast";
    recommendation = "Trending down faster than your goal — add ~200-300 kcal/day to protect training quality.";
  } else if (drift > 0.3) {
    status = "gaining_unintended";
    recommendation = "Trending up faster than your goal — trim ~200 kcal/day, keeping protein and carbs around hard sessions.";
  }

  return { samples: sorted.length, weeklyChangeKg, goalChangeKg, status, recommendation };
}

export function profileComplete(u: {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: string | null;
}): boolean {
  return u.weightKg != null && u.heightCm != null && u.age != null && u.sex != null;
}
