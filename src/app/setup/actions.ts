"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createPlanInstance } from "@/lib/plan";
import { parseGoalTime } from "@/lib/paces";

export async function createPlan(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");

  const templateKey = String(formData.get("templateKey") ?? "");
  const goalSeconds = parseGoalTime(String(formData.get("goalTime") ?? ""));
  const raceRaw = String(formData.get("raceDate") ?? "");

  if (!templateKey || !goalSeconds || !raceRaw) {
    throw new Error("Please choose a plan and enter a goal time and race date.");
  }

  await createPlanInstance({
    userId: session.user.id,
    templateKey,
    goalSeconds,
    raceDate: new Date(`${raceRaw}T00:00:00`),
  });

  redirect("/week");
}
