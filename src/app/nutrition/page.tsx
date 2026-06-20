import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  analyzeWeightTrend,
  computeDailyTargets,
  profileComplete,
  type ActivityLevel,
  type BodyCompGoal,
  type NutritionProfile,
  type Sex,
} from "@/lib/nutrition";
import ProfileForm from "./ProfileForm";
import CheckInForm from "./CheckInForm";
import NutritionView, { CheckInRow, WeighIn } from "@/components/NutritionView";

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

export default async function NutritionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toISOString().slice(0, 10);

  if (!profileComplete(user)) {
    return (
      <main className="container">
        <div style={{ marginBottom: "1rem" }}>
          <Link href="/" className="muted" style={{ fontSize: 13 }}>← dashboard</Link>
        </div>
        <h1>Nutrition setup</h1>
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          A few details let us estimate your daily calorie and macro targets. We refine them from your weigh-in trend.
        </p>
        <ProfileForm
          defaults={{
            weightKg: user.weightKg,
            heightCm: user.heightCm,
            age: user.age,
            sex: user.sex,
            baselineActivity: user.baselineActivity,
            bodyCompGoal: user.bodyCompGoal,
            weeklyWeightChangeKg: user.weeklyWeightChangeKg,
            dietaryPrefs: user.dietaryPrefs,
          }}
        />
      </main>
    );
  }

  // today's training volume from the active plan
  const instance = await prisma.userPlanInstance.findFirst({
    where: { userId: session.user.id, active: true },
    include: { scheduled: true },
  });
  let trainingMiles = 0;
  let todayLabel = "rest day";
  const todaySW = instance?.scheduled.find((s) => s.date.toISOString().slice(0, 10) === todayKey);
  if (todaySW) {
    trainingMiles = segmentMiles((todaySW.plannedSegments as Segment[]) ?? []);
    todayLabel =
      todaySW.type === "REST"
        ? "rest day"
        : `${todaySW.type.toLowerCase().replace(/_/g, " ")} · ${trainingMiles.toFixed(1)} mi`;
  }

  const profile: NutritionProfile = {
    weightKg: user.weightKg!,
    heightCm: user.heightCm!,
    age: user.age!,
    sex: user.sex as Sex,
    bodyCompGoal: (user.bodyCompGoal ?? "MAINTAIN") as BodyCompGoal,
    weeklyWeightChangeKg: user.weeklyWeightChangeKg ?? 0,
    baselineActivity: (user.baselineActivity ?? "LIGHT") as ActivityLevel,
  };
  const targets = computeDailyTargets(profile, trainingMiles);

  const checkIns = await prisma.dailyCheckIn.findMany({
    where: { userId: session.user.id, date: { gte: new Date(+today - 28 * DAY_MS) } },
    orderBy: { date: "asc" },
  });
  const weighIns: WeighIn[] = checkIns
    .filter((c) => c.weightKg != null)
    .map((c) => ({ date: c.date.toISOString(), weightKg: c.weightKg as number }));
  const trend = analyzeWeightTrend(
    weighIns.map((w) => ({ date: new Date(w.date), weightKg: w.weightKg })),
    profile.weeklyWeightChangeKg,
  );
  const recent: CheckInRow[] = checkIns
    .slice(-7)
    .reverse()
    .map((c) => ({
      date: c.date.toISOString(),
      weightKg: c.weightKg,
      intakeSignal: c.intakeSignal,
      energyLevel: c.energyLevel,
      proteinHit: c.proteinHit,
    }));

  return (
    <main className="container">
      <div className="row" style={{ marginBottom: "1rem" }}>
        <div>
          <h1 style={{ marginBottom: 2 }}>Nutrition</h1>
          <p className="muted" style={{ margin: 0 }}>
            estimate &amp; correct · goal {profile.bodyCompGoal.toLowerCase().replace("_", " ")}
          </p>
        </div>
        <Link href="/nutrition/profile" className="muted" style={{ fontSize: 13 }}>edit profile</Link>
      </div>

      <NutritionView targets={targets} trend={trend} todayLabel={todayLabel} weighIns={weighIns} recent={recent} />
      <CheckInForm today={todayKey} />
    </main>
  );
}
