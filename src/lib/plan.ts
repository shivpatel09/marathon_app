// DB orchestration for per-user plan instances.

import { Prisma, WorkoutType } from "@prisma/client";
import { prisma } from "./prisma";
import { derivePaces } from "./paces";
import { generateSchedule, TemplateWorkout } from "./schedule";

export async function createPlanInstance(opts: {
  userId: string;
  templateKey: string;
  goalSeconds: number;
  raceDate: Date;
}) {
  const { userId, templateKey, goalSeconds, raceDate } = opts;

  const template = await prisma.trainingPlanTemplate.findUnique({
    where: { key: templateKey },
    include: { mesocycles: { include: { workouts: true } } },
  });
  if (!template) throw new Error(`Unknown plan template: ${templateKey}`);

  const paces = derivePaces(goalSeconds);
  const workouts: TemplateWorkout[] = template.mesocycles.flatMap((m) =>
    m.workouts.map((w) => ({
      weekIndex: w.weekIndex,
      dayOfWeek: w.dayOfWeek,
      type: w.type,
      label: w.label,
      segments: (w.segments as unknown as TemplateWorkout["segments"]) ?? [],
    })),
  );
  const scheduled = generateSchedule(workouts, template.weeks, paces, raceDate);

  // one active plan at a time
  await prisma.userPlanInstance.updateMany({
    where: { userId, active: true },
    data: { active: false },
  });

  return prisma.userPlanInstance.create({
    data: {
      userId,
      templateId: template.id,
      raceDate,
      goalTimeSec: goalSeconds,
      derivedPaces: paces as unknown as Prisma.InputJsonValue,
      scheduled: {
        create: scheduled.map((s) => ({
          weekIndex: s.weekIndex,
          dayOfWeek: s.dayOfWeek,
          date: s.date,
          originalDate: s.originalDate,
          type: s.type as WorkoutType,
          label: s.label ?? null,
          plannedSegments: s.plannedSegments as unknown as Prisma.InputJsonValue,
          targetRacePace: s.targetRacePace ?? null,
          raceDistanceM: s.raceDistanceM ?? null,
        })),
      },
    },
  });
}

export async function getActivePlanInstance(userId: string) {
  return prisma.userPlanInstance.findFirst({
    where: { userId, active: true },
    include: {
      template: { include: { mesocycles: { orderBy: { order: "asc" } } } },
      scheduled: { orderBy: { date: "asc" } },
    },
  });
}
