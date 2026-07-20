"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActivityLevel, BodyCompGoal, IntakeSignal, Sex } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { todayKey } from "@/lib/time";
import { feetInchesToCm, lbToKg } from "@/lib/nutrition";

function num(v: FormDataEntryValue | null): number | null {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
}

function lb(v: FormDataEntryValue | null): number | null {
  const n = num(v);
  return n == null ? null : lbToKg(n);
}

export async function saveProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");

  const dietary = String(formData.get("dietaryPrefs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const ft = num(formData.get("heightFeet"));
  const inch = num(formData.get("heightInches"));
  const heightCm = ft != null || inch != null ? feetInchesToCm(ft ?? 0, inch ?? 0) : null;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      weightKg: lb(formData.get("weightLb")),
      heightCm,
      age: num(formData.get("age")),
      sex: (String(formData.get("sex")) as Sex) || null,
      baselineActivity: (String(formData.get("baselineActivity")) as ActivityLevel) || null,
      bodyCompGoal: (String(formData.get("bodyCompGoal")) as BodyCompGoal) || null,
      weeklyWeightChangeKg: lb(formData.get("weeklyWeightChangeLb")) ?? 0,
      dietaryPrefs: dietary,
    },
  });

  revalidatePath("/nutrition");
  redirect("/nutrition");
}

export async function saveCheckIn(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");

  // The form supplies today's Eastern calendar date (yyyy-mm-dd); store it at
  // midnight UTC so it keys the same way as planned workout dates.
  const raw = String(formData.get("date") ?? "") || todayKey();
  const date = new Date(`${raw}T00:00:00.000Z`);
  const signal = String(formData.get("intakeSignal") ?? "");

  const data = {
    weightKg: lb(formData.get("weightLb")),
    intakeSignal: signal ? (signal as IntakeSignal) : null,
    proteinHit: formData.get("proteinHit") === "on",
    energyLevel: num(formData.get("energyLevel")),
    sleepHours: num(formData.get("sleepHours")),
    notes: String(formData.get("notes") ?? "") || null,
  };

  await prisma.dailyCheckIn.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    create: { userId: session.user.id, date, ...data },
    update: data,
  });

  revalidatePath("/nutrition");
}

export async function deleteCheckIn(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // userId guard: a user can only delete their own check-ins
  await prisma.dailyCheckIn.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/nutrition");
}
