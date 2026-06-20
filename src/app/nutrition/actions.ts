"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActivityLevel, BodyCompGoal, IntakeSignal, Sex } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lbToKg } from "@/lib/nutrition";

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

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      weightKg: lb(formData.get("weightLb")),
      heightCm: num(formData.get("heightCm")),
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

  const raw = String(formData.get("date") ?? "");
  const date = new Date(`${raw || new Date().toISOString().slice(0, 10)}T00:00:00`);
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
