"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Swap two scheduled workouts within a week: each takes the other's date +
// dayOfWeek. originalDate is preserved for audit; both are flagged movedByUser.
export async function moveWorkout(idA: string, idB: string) {
  if (idA === idB) return;
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");

  const [a, b] = await Promise.all([
    prisma.scheduledWorkout.findUnique({ where: { id: idA }, include: { planInstance: true } }),
    prisma.scheduledWorkout.findUnique({ where: { id: idB }, include: { planInstance: true } }),
  ]);
  if (!a || !b) throw new Error("workout not found");
  if (a.planInstanceId !== b.planInstanceId) throw new Error("cannot move across plans");
  if (a.planInstance.userId !== session.user.id) throw new Error("forbidden");

  await prisma.$transaction([
    prisma.scheduledWorkout.update({
      where: { id: a.id },
      data: { date: b.date, dayOfWeek: b.dayOfWeek, movedByUser: true },
    }),
    prisma.scheduledWorkout.update({
      where: { id: b.id },
      data: { date: a.date, dayOfWeek: a.dayOfWeek, movedByUser: true },
    }),
  ]);

  revalidatePath("/week");
}
