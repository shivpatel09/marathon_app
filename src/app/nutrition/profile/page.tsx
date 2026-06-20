import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProfileForm from "../ProfileForm";

export default async function NutritionProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/");

  return (
    <main className="container">
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/nutrition" className="muted" style={{ fontSize: 13 }}>← nutrition</Link>
      </div>
      <h1>Edit nutrition profile</h1>
      <p className="muted" style={{ marginBottom: "1.5rem" }}>
        Update your details — targets recalculate immediately.
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
