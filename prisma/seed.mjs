// Seeds the three v1 training plans: Pfitzinger 18/55, Hansons Beginner,
// Hansons Advanced.
//
// IMPORTANT: workout *structure* here is faithful to each plan's published
// methodology (mesocycle phases, which workout type falls on which day, pace
// anchors, Hansons' 16-mile long-run cap, Pfitz's tune-up race). The exact
// daily *distances* are representative defaults — verify/adjust them against
// your own copies of "Advanced Marathoning" and the "Hansons Marathon Method".
//
// dayOfWeek: 0 = Monday .. 6 = Sunday.
// Intensity is stored as an abstract `paceRef`, resolved per-user from goal
// time at plan-instance time (see src/lib/paces.ts).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---- segment helpers ----
const run = (paceRef, value, unit = "mi") => ({ paceRef, value, unit });
const strides = (n) => ({ kind: "strides", paceRef: "VO2MAX", reps: n, repValue: 100, repUnit: "m" });
const intervals = (paceRef, reps, repValue, repUnit, recovery) => ({
  kind: "intervals",
  paceRef,
  reps,
  repValue,
  repUnit,
  recovery,
});

// ---- Pfitzinger 18/55 ----
function pfitz() {
  const longRun = [11, 12, 13, 14, 15, 12, 16, 17, 18, 15, 20, 20, 16, 22, 18, 14, 12, 8];
  const medium = [7, 8, 8, 9, 10, 8, 9, 10, 11, 9, 11, 11, 9, 11, 10, 8, 7, 5];
  const satGA = [5, 6, 6, 6, 7, 5, 6, 7, 7, 6, 7, 7, 6, 7, 6, 5, 5, 4];
  const thuRec = [4, 5, 5, 5, 5, 4, 5, 5, 6, 5, 6, 5, 5, 6, 5, 4, 4, 3];
  const friGA = [0, 4, 4, 5, 5, 0, 5, 5, 6, 0, 6, 6, 0, 6, 5, 0, 0, 0];
  const ltMiles = { 7: 4, 8: 5, 9: 6, 10: 4, 11: 7 };

  const meso = [
    { name: "Endurance", startWeek: 1, endWeek: 6, order: 1, workouts: [] },
    { name: "Lactate threshold + endurance", startWeek: 7, endWeek: 11, order: 2, workouts: [] },
    { name: "Race preparation", startWeek: 12, endWeek: 15, order: 3, workouts: [] },
    { name: "Taper and race", startWeek: 16, endWeek: 18, order: 4, workouts: [] },
  ];
  const mesoFor = (w) => meso.find((m) => w >= m.startWeek && w <= m.endWeek);

  for (let w = 1; w <= 18; w++) {
    const i = w - 1;
    const m = mesoFor(w);
    const add = (dayOfWeek, type, segments) => m.workouts.push({ weekIndex: w, dayOfWeek, type, segments });

    add(0, "REST", []);

    // Tue — quality, by phase
    if (w <= 6) add(1, "GENERAL_AEROBIC", [run("GENERAL_AEROBIC", 7), strides(8)]);
    else if (w <= 11) add(1, "TEMPO_LT", [run("EASY", 2), run("LT", ltMiles[w]), run("EASY", 2)]);
    else if (w <= 15) add(1, "VO2MAX", [run("EASY", 2), intervals("VO2MAX", 6, 1000, "m", "jog 2-3 min"), run("EASY", 2)]);
    else add(1, "GENERAL_AEROBIC", [run("GENERAL_AEROBIC", 6), strides(6)]);

    add(2, "MEDIUM_LONG", [run("GENERAL_AEROBIC", medium[i])]);
    add(3, "RECOVERY", [run("RECOVERY", thuRec[i]), strides(6)]);
    add(4, friGA[i] > 0 ? "GENERAL_AEROBIC" : "REST", friGA[i] > 0 ? [run("GENERAL_AEROBIC", friGA[i])] : []);
    add(5, "GENERAL_AEROBIC", [run("GENERAL_AEROBIC", satGA[i]), strides(6)]);

    // Sun — race day (week 18), a tune-up race (week 14), else the long run
    if (w === 18) {
      add(6, "RACE", [{ kind: "race", paceRef: "MARATHON", value: 26.2, unit: "mi" }]);
    } else if (w === 14) {
      add(6, "TUNE_UP_RACE", [run("EASY", 3), { kind: "race", paceRef: "LT", value: 10, unit: "K" }, run("EASY", 2)]);
    } else {
      add(6, "LONG", [run("LONG", longRun[i])]);
    }
  }

  return {
    key: "pfitz-18-55",
    name: "Pfitzinger 18/55",
    author: "Pete Pfitzinger",
    weeks: 18,
    daysPerWeek: 6,
    peakMileage: 55,
    longRunCap: null,
    description: "Mesocycle structure with a lactate-threshold focus; peaks at 55 mpw.",
    mesocycles: meso,
  };
}

// ---- Hansons (Beginner & Advanced) ----
function hansons(variant) {
  const adv = variant === "advanced";
  const easyBase = adv ? 8 : 6;

  // Tuesday SOS — speed phase (weeks 6-10): reps x meters
  const speed = { 6: [12, 400], 7: [8, 600], 8: [6, 800], 9: [5, 1000], 10: [4, 1200] };
  // Tuesday SOS — strength phase (weeks 11-16): reps x miles at MP−10
  const strength = { 11: [6, 1], 12: [4, 1.5], 13: [3, 2], 14: [2, 3], 15: [6, 1], 16: [4, 1.5] };
  // Thursday tempo at marathon pace (weeks 6-16): miles
  const tempo = { 6: 5, 7: 6, 8: 7, 9: 8, 10: 9, 11: 6, 12: 7, 13: 8, 14: 9, 15: 10, 16: 8 };
  // Sunday long run (16-mile cap)
  const longRun = { 1: 6, 2: 8, 3: 10, 4: 8, 5: 10, 6: 10, 7: 12, 8: 15, 9: 10, 10: 15, 11: 16, 12: 16, 13: 16, 14: 16, 15: 16, 16: 16, 17: 10, 18: 8 };

  const meso = [
    { name: "Base", startWeek: 1, endWeek: 5, order: 1, workouts: [] },
    { name: "Speed", startWeek: 6, endWeek: 10, order: 2, workouts: [] },
    { name: "Strength", startWeek: 11, endWeek: 16, order: 3, workouts: [] },
    { name: "Taper", startWeek: 17, endWeek: 18, order: 4, workouts: [] },
  ];
  const mesoFor = (w) => meso.find((m) => w >= m.startWeek && w <= m.endWeek);
  const easyMi = (w) => (w <= 2 ? easyBase - 1 : easyBase + (w >= 11 ? 1 : 0));

  for (let w = 1; w <= 18; w++) {
    const m = mesoFor(w);
    const e = easyMi(w);
    const add = (dayOfWeek, type, segments) => m.workouts.push({ weekIndex: w, dayOfWeek, type, segments });

    add(0, "EASY", [run("EASY", e)]);

    // Tue — SOS (speed or strength); easy during base
    if (speed[w]) {
      const [reps, d] = speed[w];
      add(1, "SPEED", [run("EASY", 1.5), intervals("VO2MAX", reps, d, "m", "equal jog"), run("EASY", 1.5)]);
    } else if (strength[w]) {
      const [reps, d] = strength[w];
      add(1, "STRENGTH_INTERVALS", [run("EASY", 1.5), intervals("STRENGTH", reps, d, "mi", "400m float"), run("EASY", 1.5)]);
    } else {
      add(1, "EASY", [run("EASY", e)]);
    }

    add(2, "REST", []); // Hansons mid-week rest

    // Thu — tempo at marathon pace; easy during base
    if (tempo[w]) add(3, "MARATHON_PACE", [run("EASY", 1.5), run("MARATHON", tempo[w]), run("EASY", 1.5)]);
    else add(3, "EASY", [run("EASY", e)]);

    add(4, "EASY", [run("EASY", e)]);
    add(5, "EASY", [run("EASY", adv ? e : Math.max(e - 1, 4))]);
    if (w === 18) add(6, "RACE", [{ kind: "race", paceRef: "MARATHON", value: 26.2, unit: "mi" }]);
    else add(6, "LONG", [run("LONG", longRun[w])]);
  }

  return {
    key: adv ? "hansons-advanced" : "hansons-beginner",
    name: adv ? "Hansons Advanced" : "Hansons Beginner",
    author: "Luke Humphrey / Hansons",
    weeks: 18,
    daysPerWeek: 6,
    peakMileage: adv ? 63 : 50,
    longRunCap: 16,
    description: adv
      ? "Cumulative fatigue, higher volume; three SOS workouts a week, 16-mile cap."
      : "Cumulative fatigue with a gentler mileage ramp; 16-mile long-run cap.",
    mesocycles: meso,
  };
}

async function upsertPlan(plan) {
  // Upsert the template by key so its id stays stable — existing
  // UserPlanInstance rows reference templateId (FK RESTRICT), so the template
  // row must not be deleted. We replace only the child mesocycles/workouts.
  const meta = {
    name: plan.name,
    author: plan.author,
    weeks: plan.weeks,
    daysPerWeek: plan.daysPerWeek,
    peakMileage: plan.peakMileage,
    longRunCap: plan.longRunCap,
    description: plan.description,
  };
  const tpl = await prisma.trainingPlanTemplate.upsert({
    where: { key: plan.key },
    create: { key: plan.key, ...meta },
    update: meta,
  });

  await prisma.mesocycle.deleteMany({ where: { templateId: tpl.id } }); // cascades to workouts

  let workouts = 0;
  for (const m of plan.mesocycles) {
    await prisma.mesocycle.create({
      data: {
        templateId: tpl.id,
        name: m.name,
        startWeek: m.startWeek,
        endWeek: m.endWeek,
        order: m.order,
        workouts: {
          create: m.workouts.map((w) => ({
            weekIndex: w.weekIndex,
            dayOfWeek: w.dayOfWeek,
            type: w.type,
            segments: w.segments,
          })),
        },
      },
    });
    workouts += m.workouts.length;
  }
  console.log(`  ${plan.name}: ${plan.mesocycles.length} mesocycles, ${workouts} workouts`);
}

async function main() {
  console.log("Seeding training plans...");
  for (const plan of [pfitz(), hansons("beginner"), hansons("advanced")]) {
    await upsertPlan(plan);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
