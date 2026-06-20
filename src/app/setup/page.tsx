import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PlanSetupForm from "./PlanSetupForm";

export default async function SetupPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const templates = await prisma.trainingPlanTemplate.findMany({
    orderBy: { name: "asc" },
    select: {
      key: true,
      name: true,
      author: true,
      weeks: true,
      daysPerWeek: true,
      peakMileage: true,
      longRunCap: true,
      description: true,
    },
  });

  return (
    <main className="container">
      <h1>Set up your plan</h1>
      <p className="muted" style={{ marginBottom: "1.5rem" }}>
        Pick a program and enter your goal — we derive every pace and date.
      </p>
      <PlanSetupForm templates={templates} />
    </main>
  );
}
